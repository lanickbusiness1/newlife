import type { CandidateContext } from '../repositories/candidate-context.js';
import { normalizeEvidenceLevel } from './evidence.js';
import { findTruthConflicts } from './truth-consistency.js';
import type { DiagnosticFinding } from './types.js';

export function diagnoseCv(context: CandidateContext): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  if (!context.candidate.professionalTitle?.trim()) {
    findings.push({ code: 'MISSING_PROFESSIONAL_TITLE', severity: 'warning', message: 'Le titre professionnel est absent.', evidenceRefs: [], blocking: false });
  }
  if (!context.candidate.summary?.trim()) {
    findings.push({ code: 'MISSING_SUMMARY', severity: 'warning', message: 'Le résumé professionnel est absent.', evidenceRefs: [], blocking: false });
  }
  if (!context.experiences.length) {
    findings.push({ code: 'NO_EXPERIENCE', severity: 'warning', message: 'Aucune expérience n’est structurée dans le Talent Passport™.', evidenceRefs: [], blocking: false });
  }
  const declaredSkills = context.skills.filter((skill) => normalizeEvidenceLevel(skill.evidenceStatus) === 'DECLARED');
  if (declaredSkills.length) {
    findings.push({
      code: 'DECLARED_SKILLS_NEED_EVIDENCE',
      severity: 'info',
      message: `${declaredSkills.length} compétence(s) restent déclaratives et ne doivent pas être présentées comme vérifiées.`,
      evidenceRefs: declaredSkills.map((skill) => `skill:${skill.skillId}`),
      blocking: false,
    });
  }

  for (const conflict of findTruthConflicts(context)) {
    findings.push({
      code: conflict.code,
      severity: conflict.blocking ? 'blocking' : 'warning',
      message: conflict.message,
      evidenceRefs: conflict.evidenceRefs,
      blocking: conflict.blocking,
    });
  }

  return findings;
}

export { scoreApplicationReadiness } from './application-readiness.js';
export type {
  ApplicationReadinessDimensions,
  ApplicationReadinessEvidenceSignal,
  ApplicationReadinessInput,
  ApplicationReadinessResult,
  ApplicationReadinessTechnicalSignals,
} from './application-readiness.js';
