from __future__ import annotations

import json
import sqlite3
from dataclasses import replace

from app.domain.models import Alert
from app.services.evidence import EvidenceService


class AlertService:
    def __init__(self, conn: sqlite3.Connection, evidence: EvidenceService) -> None:
        self.conn = conn
        self.evidence = evidence

    def create(self, alert: Alert) -> Alert:
        self.conn.execute('''INSERT INTO alerts
            (alert_id, anomaly_id, rule_id, site_id, asset_id, severity, state, raised_at, acknowledged_at, acknowledged_by, recommendation, evidence_refs_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (alert.alert_id, alert.anomaly_id, alert.rule_id, alert.site_id, alert.asset_id, alert.severity, alert.state, alert.raised_at, alert.acknowledged_at, alert.acknowledged_by, alert.recommendation, json.dumps(list(alert.evidence_refs))))
        self.conn.commit()
        return alert

    def acknowledge(self, alert_id: str, actor: str, acknowledged_at: str) -> Alert:
        row = self.conn.execute('SELECT * FROM alerts WHERE alert_id=?', (alert_id,)).fetchone()
        if not row:
            raise KeyError(alert_id)
        if row['state'] == 'ACKNOWLEDGED':
            return self._row_to_alert(row)
        try:
            self.conn.execute('BEGIN')
            self.conn.execute("UPDATE alerts SET state='ACKNOWLEDGED', acknowledged_at=?, acknowledged_by=? WHERE alert_id=?", (acknowledged_at, actor, alert_id))
            self.evidence._append_no_commit('ALERT_ACKNOWLEDGED', actor, {'alert_id': alert_id}, {'alert_id': alert_id, 'acknowledged_at': acknowledged_at}, [])
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        return replace(self._row_to_alert(row), state='ACKNOWLEDGED', acknowledged_at=acknowledged_at, acknowledged_by=actor)

    @staticmethod
    def _row_to_alert(row: sqlite3.Row) -> Alert:
        return Alert(alert_id=row['alert_id'], site_id=row['site_id'], asset_id=row['asset_id'], severity=row['severity'], state=row['state'], raised_at=row['raised_at'], recommendation=row['recommendation'], anomaly_id=row['anomaly_id'], rule_id=row['rule_id'], acknowledged_at=row['acknowledged_at'], acknowledged_by=row['acknowledged_by'], evidence_refs=tuple(json.loads(row['evidence_refs_json'])))
