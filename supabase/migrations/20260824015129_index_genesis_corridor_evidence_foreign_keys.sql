create index if not exists corridor_evidence_evidence_idx
  on genesis_corridor.corridor_evidence(evidence_id);

create index if not exists economic_components_evidence_idx
  on genesis_corridor.economic_components(evidence_id);

create index if not exists strategic_score_evidence_evidence_idx
  on genesis_corridor.strategic_score_evidence(evidence_id);
