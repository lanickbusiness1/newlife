from __future__ import annotations

import hashlib
import hmac
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from threading import RLock

from pydantic import BaseModel

from .models import AcceptedEvent, AuditRecord, CrawlTarget, SourceRecord


SCHEMA_VERSION = "3"


def _canonical_json(model: BaseModel) -> str:
    return json.dumps(
        model.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def _sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class SQLiteStateRepository:
    """Durable state store for trusted sources, accepted events, crawl operations and audit evidence."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._connection = sqlite3.connect(str(self.path), check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._connection.execute("PRAGMA synchronous=FULL")
        self._initialize_schema()

    def _initialize_schema(self) -> None:
        with self._connection:
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sources (
                    id TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    payload_sha256 TEXT NOT NULL
                )
                """
            )
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    payload_sha256 TEXT NOT NULL
                )
                """
            )
            current = self._connection.execute(
                "SELECT value FROM metadata WHERE key = 'schema_version'"
            ).fetchone()
            if current is None:
                self._create_v2_tables()
                self._create_v3_tables()
                self._connection.execute(
                    "INSERT INTO metadata(key, value) VALUES('schema_version', ?)",
                    (SCHEMA_VERSION,),
                )
            elif current[0] == "1":
                self._migrate_v1_to_v2()
                self._migrate_v2_to_v3()
            elif current[0] == "2":
                self._migrate_v2_to_v3()
            elif current[0] == SCHEMA_VERSION:
                self._create_v2_tables()
                self._create_v3_tables()
            else:
                raise RuntimeError(
                    f"unsupported state schema version: {current[0]}"
                )

    def _create_v2_tables(self) -> None:
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS crawl_targets (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                payload_sha256 TEXT NOT NULL
            )
            """
        )

    def _create_v3_tables(self) -> None:
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_records (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                payload_sha256 TEXT NOT NULL
            )
            """
        )

    def _migrate_v1_to_v2(self) -> None:
        self._create_v2_tables()
        self._connection.execute(
            "UPDATE metadata SET value = '2' WHERE key = 'schema_version'"
        )

    def _migrate_v2_to_v3(self) -> None:
        self._create_v3_tables()
        self._connection.execute(
            "UPDATE metadata SET value = '3' WHERE key = 'schema_version'"
        )

    def schema_version(self) -> str:
        row = self._connection.execute(
            "SELECT value FROM metadata WHERE key = 'schema_version'"
        ).fetchone()
        if row is None:
            raise RuntimeError("state schema version is missing")
        return str(row[0])

    def rollback_schema_to_v2(self) -> None:
        """Revert v3 only when no append-only audit evidence would be lost."""
        with self._lock, self._connection:
            if self.schema_version() != "3":
                raise RuntimeError("schema rollback requires version 3")
            count = self._connection.execute(
                "SELECT COUNT(*) FROM audit_records"
            ).fetchone()[0]
            if count:
                raise RuntimeError("cannot rollback schema with audit records present")
            self._connection.execute("DROP TABLE audit_records")
            self._connection.execute(
                "UPDATE metadata SET value = '2' WHERE key = 'schema_version'"
            )

    def rollback_schema_to_v1(self) -> None:
        """Revert v2 only when no crawl state would be lost."""
        with self._lock, self._connection:
            if self.schema_version() != "2":
                raise RuntimeError("schema rollback requires version 2")
            count = self._connection.execute(
                "SELECT COUNT(*) FROM crawl_targets"
            ).fetchone()[0]
            if count:
                raise RuntimeError("cannot rollback schema with crawl targets present")
            self._connection.execute("DROP TABLE crawl_targets")
            self._connection.execute(
                "UPDATE metadata SET value = '1' WHERE key = 'schema_version'"
            )

    def save_source(self, source: SourceRecord) -> SourceRecord:
        payload = _canonical_json(source)
        digest = _sha256(payload)
        with self._lock, self._connection:
            existing = self._connection.execute(
                "SELECT payload_json, payload_sha256 FROM sources WHERE id = ?",
                (source.id,),
            ).fetchone()
            if existing is not None:
                self._verify_payload(existing[0], existing[1], "source", source.id)
                if existing[0] == payload:
                    return source
                raise ValueError("source id conflict")
            self._connection.execute(
                "INSERT INTO sources(id, payload_json, payload_sha256) VALUES(?, ?, ?)",
                (source.id, payload, digest),
            )
        return source

    def save_event(self, accepted: AcceptedEvent) -> AcceptedEvent:
        payload = _canonical_json(accepted)
        digest = _sha256(payload)
        with self._lock, self._connection:
            existing = self._connection.execute(
                "SELECT 1 FROM events WHERE id = ?",
                (accepted.event.id,),
            ).fetchone()
            if existing is not None:
                raise ValueError("duplicate event id")
            self._connection.execute(
                "INSERT INTO events(id, payload_json, payload_sha256) VALUES(?, ?, ?)",
                (accepted.event.id, payload, digest),
            )
        return accepted

    def save_crawl_target(self, target: CrawlTarget) -> CrawlTarget:
        if self.schema_version() not in {"2", "3"}:
            raise RuntimeError("crawl target persistence requires schema version 2+")
        payload = _canonical_json(target)
        digest = _sha256(payload)
        with self._lock, self._connection:
            existing = self._connection.execute(
                "SELECT payload_json, payload_sha256 FROM crawl_targets WHERE id = ?",
                (target.id,),
            ).fetchone()
            if existing is not None:
                self._verify_payload(existing[0], existing[1], "crawl_target", target.id)
                self._connection.execute(
                    "UPDATE crawl_targets SET payload_json = ?, payload_sha256 = ? WHERE id = ?",
                    (payload, digest, target.id),
                )
            else:
                self._connection.execute(
                    "INSERT INTO crawl_targets(id, payload_json, payload_sha256) VALUES(?, ?, ?)",
                    (target.id, payload, digest),
                )
        return target

    def save_audit_record(self, record: AuditRecord) -> AuditRecord:
        if self.schema_version() != "3":
            raise RuntimeError("audit persistence requires schema version 3")
        payload = _canonical_json(record)
        digest = _sha256(payload)
        with self._lock, self._connection:
            existing = self._connection.execute(
                "SELECT 1 FROM audit_records WHERE id = ?",
                (record.id,),
            ).fetchone()
            if existing is not None:
                raise ValueError("duplicate audit id")
            self._connection.execute(
                "INSERT INTO audit_records(id, payload_json, payload_sha256) VALUES(?, ?, ?)",
                (record.id, payload, digest),
            )
        return record

    def list_sources(self) -> list[SourceRecord]:
        rows = self._connection.execute(
            "SELECT id, payload_json, payload_sha256 FROM sources ORDER BY rowid"
        ).fetchall()
        result: list[SourceRecord] = []
        for source_id, payload, digest in rows:
            self._verify_payload(payload, digest, "source", source_id)
            result.append(SourceRecord.model_validate_json(payload))
        return result

    def list_events(self) -> list[AcceptedEvent]:
        rows = self._connection.execute(
            "SELECT id, payload_json, payload_sha256 FROM events ORDER BY rowid"
        ).fetchall()
        result: list[AcceptedEvent] = []
        for event_id, payload, digest in rows:
            self._verify_payload(payload, digest, "event", event_id)
            result.append(AcceptedEvent.model_validate_json(payload))
        return result

    def list_crawl_targets(self) -> list[CrawlTarget]:
        if self.schema_version() not in {"2", "3"}:
            return []
        rows = self._connection.execute(
            "SELECT id, payload_json, payload_sha256 FROM crawl_targets ORDER BY rowid"
        ).fetchall()
        result: list[CrawlTarget] = []
        for target_id, payload, digest in rows:
            self._verify_payload(payload, digest, "crawl_target", target_id)
            result.append(CrawlTarget.model_validate_json(payload))
        return result

    def get_crawl_target(self, target_id: str) -> CrawlTarget | None:
        if self.schema_version() not in {"2", "3"}:
            return None
        row = self._connection.execute(
            "SELECT payload_json, payload_sha256 FROM crawl_targets WHERE id = ?",
            (target_id,),
        ).fetchone()
        if row is None:
            return None
        self._verify_payload(row[0], row[1], "crawl_target", target_id)
        return CrawlTarget.model_validate_json(row[0])

    def list_due_crawl_targets(self, now: datetime) -> list[CrawlTarget]:
        due = [
            target
            for target in self.list_crawl_targets()
            if target.enabled and target.next_due_at <= now
        ]
        return sorted(due, key=lambda target: (target.next_due_at, target.id))

    def list_audit_records(self) -> list[AuditRecord]:
        if self.schema_version() != "3":
            return []
        rows = self._connection.execute(
            "SELECT id, payload_json, payload_sha256 FROM audit_records ORDER BY rowid"
        ).fetchall()
        result: list[AuditRecord] = []
        for record_id, payload, digest in rows:
            self._verify_payload(payload, digest, "audit", record_id)
            result.append(AuditRecord.model_validate_json(payload))
        return result

    def backup(self, destination: str | Path) -> Path:
        destination_path = Path(destination)
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            target = sqlite3.connect(str(destination_path))
            try:
                self._connection.backup(target)
            finally:
                target.close()
        return destination_path

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    @staticmethod
    def _verify_payload(
        payload: str,
        expected_digest: str,
        object_type: str,
        object_id: str,
    ) -> None:
        actual = _sha256(payload)
        if not hmac.compare_digest(actual, expected_digest):
            raise ValueError(
                f"integrity check failed for {object_type}:{object_id}"
            )
