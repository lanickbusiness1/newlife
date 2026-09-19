import type { DecisionTrace } from './types.js';

export interface LegalAuditRecord {
  id: string;
  decisionTrace: DecisionTrace;
  createdAt: string;
}

const ledger = new Map<string, LegalAuditRecord>();

function cloneRecord(record: LegalAuditRecord): LegalAuditRecord {
  return structuredClone(record);
}

export function appendLegalAuditRecord(record: LegalAuditRecord): LegalAuditRecord {
  const id = record.id.trim();
  if (!id) throw new Error('Legal audit record id is required');
  if (ledger.has(id)) {
    throw new Error(`Legal audit ledger is append-only: record ${id} already exists`);
  }
  if (!record.decisionTrace.auditHash) {
    throw new Error('Legal audit record requires a hashed decision trace');
  }
  const stored = cloneRecord({ ...record, id });
  ledger.set(id, stored);
  return cloneRecord(stored);
}

export function readLegalAuditRecord(id: string): LegalAuditRecord | null {
  const record = ledger.get(id);
  return record ? cloneRecord(record) : null;
}
