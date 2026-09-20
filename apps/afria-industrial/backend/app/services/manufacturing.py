from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict

from app.domain.manufacturing import (
    ExternalOption,
    ManufacturingDecision,
    ManufacturingDesign,
    ManufacturingNeed,
    ManufacturingNode,
    resolve_manufacturing,
)
from app.services.evidence import EvidenceService


def _json_tuple(raw: str) -> tuple[str, ...]:
    return tuple(json.loads(raw))


class ManufacturingService:
    def __init__(self, conn: sqlite3.Connection, evidence: EvidenceService) -> None:
        self.conn = conn
        self.evidence = evidence

    def register_node(self, node: ManufacturingNode, actor: str) -> ManufacturingNode:
        try:
            self.conn.execute(
                '''INSERT INTO manufacturing_nodes(
                    node_id,name,country,jurisdiction,status,available_capacity,lead_time_hours,unit_cost,
                    local_content_ratio,energy_state,connectivity_state,quality_state,machine_types_json,
                    processes_json,materials_json,workforce_skills_json,certifications_json,permissions_json,
                    constraints_json,evidence_refs_json
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                (
                    node.node_id,node.name,node.country,node.jurisdiction,node.status,node.available_capacity,
                    node.lead_time_hours,node.unit_cost,node.local_content_ratio,node.energy_state,
                    node.connectivity_state,node.quality_state,json.dumps(node.machine_types),json.dumps(node.processes),
                    json.dumps(node.materials),json.dumps(node.workforce_skills),json.dumps(node.certifications),
                    json.dumps(node.permissions),json.dumps(node.constraints),json.dumps(node.evidence_refs)
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError('manufacturing node already exists') from exc
        self.evidence._append_no_commit(
            'MANUFACTURING_NODE_REGISTERED',
            actor,
            {'node_id': node.node_id},
            asdict(node),
            list(node.evidence_refs),
        )
        self.conn.commit()
        return node

    def list_nodes(self) -> list[ManufacturingNode]:
        rows = self.conn.execute('SELECT * FROM manufacturing_nodes ORDER BY node_id').fetchall()
        return [
            ManufacturingNode(
                row['node_id'],row['name'],row['country'],row['jurisdiction'],row['status'],
                row['available_capacity'],row['lead_time_hours'],row['unit_cost'],row['local_content_ratio'],
                row['energy_state'],row['connectivity_state'],row['quality_state'],
                _json_tuple(row['machine_types_json']),_json_tuple(row['processes_json']),
                _json_tuple(row['materials_json']),_json_tuple(row['workforce_skills_json']),
                _json_tuple(row['certifications_json']),_json_tuple(row['permissions_json']),
                _json_tuple(row['constraints_json']),_json_tuple(row['evidence_refs_json'])
            )
            for row in rows
        ]

    def register_design(self, design: ManufacturingDesign, actor: str) -> ManufacturingDesign:
        try:
            self.conn.execute(
                '''INSERT INTO manufacturing_designs(
                    design_id,owner,version,ip_rights_status,expired,bom_json,allowed_materials_json,
                    allowed_machine_types_json,allowed_jurisdictions_json,required_certifications_json,
                    authorized_uses_json,evidence_refs_json
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
                (
                    design.design_id,design.owner,design.version,design.ip_rights_status,int(design.expired),
                    json.dumps(design.bom),json.dumps(design.allowed_materials),json.dumps(design.allowed_machine_types),
                    json.dumps(design.allowed_jurisdictions),json.dumps(design.required_certifications),
                    json.dumps(design.authorized_uses),json.dumps(design.evidence_refs)
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError('manufacturing design already exists') from exc
        self.evidence._append_no_commit(
            'MANUFACTURING_DESIGN_REGISTERED',
            actor,
            {'design_id': design.design_id},
            asdict(design),
            list(design.evidence_refs),
        )
        self.conn.commit()
        return design

    def list_designs(self) -> list[ManufacturingDesign]:
        rows = self.conn.execute('SELECT * FROM manufacturing_designs ORDER BY design_id').fetchall()
        return [
            ManufacturingDesign(
                row['design_id'],row['owner'],row['version'],row['ip_rights_status'],bool(row['expired']),
                _json_tuple(row['bom_json']),_json_tuple(row['allowed_materials_json']),
                _json_tuple(row['allowed_machine_types_json']),_json_tuple(row['allowed_jurisdictions_json']),
                _json_tuple(row['required_certifications_json']),_json_tuple(row['authorized_uses_json']),
                _json_tuple(row['evidence_refs_json'])
            )
            for row in rows
        ]

    def get_design(self, design_id: str | None) -> ManufacturingDesign | None:
        if design_id is None:
            return None
        row = self.conn.execute('SELECT * FROM manufacturing_designs WHERE design_id=?', (design_id,)).fetchone()
        if row is None:
            return None
        return ManufacturingDesign(
            row['design_id'],row['owner'],row['version'],row['ip_rights_status'],bool(row['expired']),
            _json_tuple(row['bom_json']),_json_tuple(row['allowed_materials_json']),
            _json_tuple(row['allowed_machine_types_json']),_json_tuple(row['allowed_jurisdictions_json']),
            _json_tuple(row['required_certifications_json']),_json_tuple(row['authorized_uses_json']),
            _json_tuple(row['evidence_refs_json'])
        )

    def resolve(
        self,
        need: ManufacturingNeed,
        design_id: str | None,
        external_options: list[ExternalOption],
        actor: str,
    ) -> ManufacturingDecision:
        design = self.get_design(design_id)
        result = resolve_manufacturing(need, self.list_nodes(), design, external_options)
        payload = {
            'need': asdict(need),
            'design_id': design_id,
            'external_options': [asdict(item) for item in external_options],
            'decision': asdict(result),
        }
        source_refs = []
        if design is not None:
            source_refs.extend(design.evidence_refs)
        for item in external_options:
            source_refs.extend(item.evidence_refs)
        self.evidence.append(
            'MANUFACTURING_DECISION_GENERATED',
            actor,
            {'need_id': need.need_id, 'decision': result.decision},
            payload,
            source_refs,
        )
        return result
