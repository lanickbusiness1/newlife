import sqlite3
from app.services.evidence import EvidenceService
from app.services.sync import SyncService
class OperationalMetrics:
    def __init__(self,conn:sqlite3.Connection,evidence:EvidenceService,sync:SyncService)->None:self.conn,self.evidence,self.sync=conn,evidence,sync;self.persistence_errors=0
    def snapshot(self)->dict:
        totals=self.conn.execute('SELECT COALESCE(SUM(accepted_count),0),COALESCE(SUM(rejected_count),0) FROM ingestion_batches').fetchone();freshness=self.conn.execute('SELECT MAX(receipt_timestamp) FROM telemetry').fetchone()[0];anomalies={r['severity']:r['count'] for r in self.conn.execute('SELECT severity,COUNT(*) AS count FROM anomalies GROUP BY severity')};backlog=self.conn.execute("SELECT COUNT(*) FROM alerts WHERE state='OPEN'").fetchone()[0];status=self.sync.status()
        return {'ingestion_accepted':totals[0],'ingestion_rejected':totals[1],'telemetry_freshness':freshness,'anomalies_by_severity':anomalies,'alert_backlog':backlog,'sync_queue_depth':status.queue_depth,'persistence_errors':self.persistence_errors,'adapter_health':{'SIMULATOR':'AVAILABLE','MQTT':'PROVIDER_PENDING','OPCUA':'PROVIDER_PENDING'},'system_mode':status.mode,'evidence_integrity':self.evidence.verify_chain()}
