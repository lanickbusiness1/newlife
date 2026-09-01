from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from app.domain.models import EvidenceRecord

GENESIS_HASH = '0' * 64


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


class EvidenceService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    def append(self, event_type: str, actor: str, scope: dict[str, Any], payload: dict[str, Any], source_refs: list[str] | tuple[str, ...]) -> EvidenceRecord:
        record = self._append_no_commit(event_type, actor, scope, payload, source_refs)
        self.conn.commit()
        return record

    def _append_no_commit(self, event_type: str, actor: str, scope: dict[str, Any], payload: dict[str, Any], source_refs: list[str] | tuple[str, ...]) -> EvidenceRecord:
        previous = self.conn.execute('SELECT output_hash FROM evidence ORDER BY sequence DESC LIMIT 1').fetchone()
        previous_hash = previous['output_hash'] if previous else GENESIS_HASH
        timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        input_hash = hashlib.sha256(_canonical(payload).encode()).hexdigest()
        envelope = {'event_type': event_type, 'actor': actor, 'scope': scope, 'timestamp': timestamp, 'input_hash': input_hash, 'previous_hash': previous_hash, 'source_refs': list(source_refs)}
        output_hash = hashlib.sha256(_canonical(envelope).encode()).hexdigest()
        evidence_id = str(uuid.uuid4())
        cur = self.conn.execute('''INSERT INTO evidence
            (evidence_id, event_type, actor, scope_json, event_timestamp, input_hash, output_hash, previous_hash, source_refs_json, decision, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (evidence_id, event_type, actor, _canonical(scope), timestamp, input_hash, output_hash, previous_hash, _canonical(list(source_refs)), None, _canonical(payload)))
        return EvidenceRecord(evidence_id, int(cur.lastrowid), event_type, actor, scope, timestamp, input_hash, output_hash, previous_hash, tuple(source_refs), None, payload)

    def verify_chain(self) -> bool:
        previous_hash = GENESIS_HASH
        rows = self.conn.execute('SELECT * FROM evidence ORDER BY sequence').fetchall()
        for row in rows:
            if row['previous_hash'] != previous_hash:
                return False
            payload = json.loads(row['metadata_json'])
            input_hash = hashlib.sha256(_canonical(payload).encode()).hexdigest()
            if input_hash != row['input_hash']:
                return False
            envelope = {'event_type': row['event_type'], 'actor': row['actor'], 'scope': json.loads(row['scope_json']), 'timestamp': row['event_timestamp'], 'input_hash': input_hash, 'previous_hash': previous_hash, 'source_refs': json.loads(row['source_refs_json'])}
            expected = hashlib.sha256(_canonical(envelope).encode()).hexdigest()
            if expected != row['output_hash']:
                return False
            previous_hash = row['output_hash']
        return True

    def list_all(self) -> list[dict[str, Any]]:
        return [dict(row) for row in self.conn.execute('SELECT * FROM evidence ORDER BY sequence')]
