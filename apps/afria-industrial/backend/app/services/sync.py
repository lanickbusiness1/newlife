from __future__ import annotations
import json,sqlite3
from dataclasses import dataclass
from datetime import datetime,timezone
from typing import Any
from app.services.evidence import EvidenceService
@dataclass(frozen=True)
class SyncEnvelope:
    event_id:str; destination:str; purpose:str; data_class:str; retention:str; authority:str; encryption_state:str; payload:dict[str,Any]
@dataclass(frozen=True)
class EnqueueResult: status:str
@dataclass(frozen=True)
class ReplayResult: sent_event_ids:list[str]
@dataclass(frozen=True)
class SyncStatus: mode:str; queue_depth:int; upstream_available:bool
class MockUpstreamTransport:
    def __init__(self,available:bool=True)->None: self.available=available; self.received=[]
    def send(self,envelope:SyncEnvelope)->None:
        if not self.available: raise ConnectionError('mock upstream unavailable')
        self.received.append(envelope)
class SyncService:
    def __init__(self,conn:sqlite3.Connection,transport:MockUpstreamTransport,evidence:EvidenceService)->None:
        self.conn=conn; self.transport=transport; self.evidence=evidence; self._last_available=transport.available
    @staticmethod
    def _payload_json(envelope:SyncEnvelope)->str: return json.dumps(envelope.payload,sort_keys=True,separators=(',',':'))
    def enqueue(self,envelope:SyncEnvelope)->EnqueueResult:
        if not all((envelope.event_id,envelope.destination,envelope.purpose,envelope.data_class,envelope.retention,envelope.authority,envelope.encryption_state)): raise ValueError('all sovereignty metadata fields are required')
        existing=self.conn.execute('SELECT * FROM sync_queue WHERE envelope_id=?',(envelope.event_id,)).fetchone(); payload_json=self._payload_json(envelope)
        if existing:
            same=all((existing['payload_json']==payload_json,existing['destination']==envelope.destination,existing['purpose']==envelope.purpose,existing['data_class']==envelope.data_class,existing['retention']==envelope.retention,existing['authority']==envelope.authority,existing['encryption_state']==envelope.encryption_state))
            return EnqueueResult('DUPLICATE' if same else 'CONFLICT')
        created_at=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
        self.conn.execute('''INSERT INTO sync_queue(envelope_id,payload_json,destination,purpose,data_class,retention,authority,encryption_state,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)''',(envelope.event_id,payload_json,envelope.destination,envelope.purpose,envelope.data_class,envelope.retention,envelope.authority,envelope.encryption_state,'QUEUED',created_at))
        if not self.transport.available and self._last_available: self.evidence._append_no_commit('SYNC_OUTAGE','system',{'destination':envelope.destination},{'mode':'OFFLINE_EDGE'},[])
        self._last_available=self.transport.available; self.conn.commit(); return EnqueueResult('QUEUED')
    def replay(self)->ReplayResult:
        if not self.transport.available: self._last_available=False; return ReplayResult([])
        if not self._last_available: self.evidence._append_no_commit('SYNC_RECOVERY','system',{'destination':'upstream'},{'mode':'ONLINE'},[])
        sent=[]
        for row in self.conn.execute("SELECT * FROM sync_queue WHERE state='QUEUED' ORDER BY sequence").fetchall():
            envelope=SyncEnvelope(row['envelope_id'],row['destination'],row['purpose'],row['data_class'],row['retention'],row['authority'],row['encryption_state'],json.loads(row['payload_json'])); self.transport.send(envelope)
            replayed_at=datetime.now(timezone.utc).isoformat().replace('+00:00','Z'); self.conn.execute("UPDATE sync_queue SET state='SENT', replayed_at=? WHERE envelope_id=?",(replayed_at,envelope.event_id)); self.evidence._append_no_commit('SYNC_REPLAYED','system',{'event_id':envelope.event_id},{'destination':envelope.destination},[]); sent.append(envelope.event_id)
        self.conn.commit(); self._last_available=True; return ReplayResult(sent)
    def status(self)->SyncStatus:
        depth=self.conn.execute("SELECT COUNT(*) FROM sync_queue WHERE state='QUEUED'").fetchone()[0]; return SyncStatus('ONLINE' if self.transport.available else 'OFFLINE_EDGE',depth,self.transport.available)
