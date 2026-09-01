from app.domain.readiness import DIMENSION_KEYS, DimensionInput, score_dimension, score_readiness

def test_observed_evidence_has_higher_confidence_than_declared():
    observed=score_dimension(DimensionInput(80,'OBSERVED',[])); declared=score_dimension(DimensionInput(80,'DECLARED',[])); assert observed.confidence>declared.confidence

def test_readiness_requires_exact_twelve_dimensions():
    inputs={key:DimensionInput(70,'OBSERVED',[]) for key in DIMENSION_KEYS}; result=score_readiness(inputs); assert len(result.dimensions)==12; assert set(result.dimensions)==set(DIMENSION_KEYS); assert result.overall_score==70

def test_readiness_rejects_missing_dimension():
    import pytest
    inputs={key:DimensionInput(70,'OBSERVED',[]) for key in DIMENSION_KEYS[:-1]}
    with pytest.raises(ValueError,match='exactly the 12 canonical dimensions'): score_readiness(inputs)

def test_readiness_service_persists_and_appends_evidence(tmp_path):
    from app.api.readiness import ReadinessService
    from app.persistence.sqlite import connect_sqlite,initialize_schema
    from app.services.evidence import EvidenceService
    conn=connect_sqlite(str(tmp_path/'readiness.db')); initialize_schema(conn); service=ReadinessService(conn,EvidenceService(conn))
    inputs={key:DimensionInput(75,'DECLARED',['verify']) for key in DIMENSION_KEYS}; assessment=service.create('site-demo','engineer',inputs)
    row=conn.execute('SELECT assessment_id, overall_score FROM readiness_assessments').fetchone(); assert row['assessment_id']==assessment.assessment_id; assert row['overall_score']==75
    assert conn.execute('SELECT event_type FROM evidence ORDER BY sequence DESC LIMIT 1').fetchone()['event_type']=='READINESS_ASSESSMENT_GENERATED'
