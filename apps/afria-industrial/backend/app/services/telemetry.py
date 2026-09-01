from __future__ import annotations
import sqlite3
from dataclasses import dataclass
from datetime import datetime,timedelta,timezone
from typing import Callable
from app.domain.models import TelemetryPoint
from app.persistence.repositories import TelemetryRepository
MAX_BATCH_POINTS=1000;ALLOWED_SOURCES={'SIMULATOR','MQTT','OPCUA'};CLOCK_SKEW_TOLERANCE=timedelta(minutes=5)
class BatchTooLarge(ValueError):pass
@dataclass(frozen=True)
class SourceState:
    data_state:str;live:bool;last_receipt_timestamp:str|None
@dataclass(frozen=True)
class IngestionResult:
    batch_id:str;accepted:int;rejected:int;duplicate:bool;points:tuple[TelemetryPoint,...]
class TelemetryService:
    def __init__(self,conn:sqlite3.Connection,now:Callable[[],datetime]|None=None)->None:self.conn=conn;self.repo=TelemetryRepository(conn);self._now=now or (lambda:datetime.now(timezone.utc))
    @staticmethod
    def _parse_timestamp(value:str)->datetime:
        try:parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
        except ValueError as exc:raise ValueError('invalid telemetry timestamp') from exc
        if parsed.tzinfo is None:parsed=parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    def source_state(self,asset_id:str)->SourceState:
        row=self.conn.execute('SELECT quality, receipt_timestamp FROM telemetry WHERE asset_id=? ORDER BY receipt_timestamp DESC LIMIT 1',(asset_id,)).fetchone()
        if row is None:return SourceState('MISSING',False,None)
        state=row['quality'];return SourceState(state,state=='GOOD',row['receipt_timestamp'])
    def ingest_batch(self,batch_id:str,points:list[TelemetryPoint])->IngestionResult:
        if not batch_id.strip():raise ValueError('batch_id is required')
        if len(points)>MAX_BATCH_POINTS:raise BatchTooLarge(f'batch exceeds {MAX_BATCH_POINTS} points')
        existing=self.conn.execute('SELECT accepted_count,rejected_count FROM ingestion_batches WHERE batch_id=?',(batch_id,)).fetchone()
        if existing:return IngestionResult(batch_id,existing['accepted_count'],existing['rejected_count'],True,())
        received_at=self._now().astimezone(timezone.utc);received_text=received_at.isoformat().replace('+00:00','Z');normalized=[];accepted=rejected=0
        for point in points:
            if point.source not in ALLOWED_SOURCES:raise ValueError(f'unsupported telemetry source: {point.source}')
            event_time=self._parse_timestamp(point.timestamp);quality='SUSPECT' if event_time>received_at+CLOCK_SKEW_TOLERANCE else point.quality;normalized_point=TelemetryPoint(point.point_id,point.asset_id,point.metric,point.unit,point.timestamp,point.value,quality,point.source,point.provenance_id,received_text)
            if self.repo.insert(batch_id,normalized_point,received_text):accepted+=1;normalized.append(normalized_point)
            else:rejected+=1
        self.conn.execute('INSERT INTO ingestion_batches(batch_id,accepted_count,rejected_count,created_at) VALUES(?,?,?,?)',(batch_id,accepted,rejected,received_text));self.conn.commit();return IngestionResult(batch_id,accepted,rejected,False,tuple(normalized))
