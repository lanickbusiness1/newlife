from app.persistence.sqlite import connect_sqlite,initialize_schema
def _service(tmp_path):
    from app.services.evidence import EvidenceService
    from app.services.sync import MockUpstreamTransport,SyncService
    conn=connect_sqlite(str(tmp_path/'sync.db')); initialize_schema(conn); transport=MockUpstreamTransport(available=True); return conn,transport,SyncService(conn,transport,EvidenceService(conn))
def _envelope(event_id,payload):
    from app.services.sync import SyncEnvelope
    return SyncEnvelope(event_id,'central-control-plane','operational-proof','telemetry-derived','30d','pilot-contract','TLS',payload)
def test_queue_replays_in_order(tmp_path):
    conn,transport,sync_service=_service(tmp_path); transport.available=False; sync_service.enqueue(_envelope('e1',{'n':1})); sync_service.enqueue(_envelope('e2',{'n':2})); assert sync_service.status().mode=='OFFLINE_EDGE'; transport.available=True; result=sync_service.replay(); assert result.sent_event_ids==['e1','e2']; assert sync_service.status().queue_depth==0; assert [item.event_id for item in transport.received]==['e1','e2']; assert conn.execute("SELECT COUNT(*) FROM evidence WHERE event_type LIKE 'SYNC_%'").fetchone()[0]>=1
def test_same_event_id_with_different_payload_is_conflict(tmp_path):
    _,_,sync_service=_service(tmp_path); assert sync_service.enqueue(_envelope('e1',{'n':1})).status=='QUEUED'; assert sync_service.enqueue(_envelope('e1',{'n':2})).status=='CONFLICT'
def test_identical_duplicate_is_idempotent(tmp_path):
    _,_,sync_service=_service(tmp_path); env=_envelope('e1',{'n':1}); assert sync_service.enqueue(env).status=='QUEUED'; assert sync_service.enqueue(env).status=='DUPLICATE'; assert sync_service.status().queue_depth==1
