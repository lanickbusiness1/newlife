import type { ExperienceFact } from '../repositories/candidate-context.js';
import type { RecruiterLensItem } from './recruiter-lens.js';

export type ConfirmedFactStatus = 'DECLARED' | 'EVIDENCED' | 'VERIFIED';

export interface ConfirmedFact {
  key: string;
  value: string;
  status: ConfirmedFactStatus;
  sourceRef: string;
}

export interface ElicitationQuestion {
  id: string;
  key: 'scope' | 'result' | 'evidence';
  question: string;
  sourceRef: string;
  requirementId: string | null;
}

function safeLabel(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function buildElicitationQuestions(
  experience: ExperienceFact,
  recruiterLens: RecruiterLensItem[],
): ElicitationQuestion[] {
  const sourceRef = `experience:${experience.id}`;
  const risk = recruiterLens.find((item) => item.coverage === 'GAP' || item.coverage === 'PARTIAL') ?? null;
  const requirement = risk ? safeLabel(risk.requirement) : null;

  const questions: ElicitationQuestion[] = [
    {
      id: `${experience.id}:scope`,
      key: 'scope',
      question: requirement
        ? `Quel était précisément votre périmètre réel dans cette expérience en lien avec « ${requirement} » ?`
        : 'Quel était précisément votre périmètre réel dans cette expérience ?',
      sourceRef,
      requirementId: risk?.requirementId ?? null,
    },
    {
      id: `${experience.id}:result`,
      key: 'result',
      question: 'Quel résultat avez-vous personnellement observé, sans ajouter de chiffre dont vous ne disposez pas ?',
      sourceRef,
      requirementId: risk?.requirementId ?? null,
    },
    {
      id: `${experience.id}:evidence`,
      key: 'evidence',
      question: 'Disposez-vous d’un document, portfolio, certificat, référence ou autre preuve pouvant soutenir ce fait ?',
      sourceRef,
      requirementId: risk?.requirementId ?? null,
    },
  ];

  return questions;
}
