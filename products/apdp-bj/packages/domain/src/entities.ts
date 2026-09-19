import { z } from 'zod';
import { dossierStates } from './workflow.js';

export const actorTypes = ['APPLICANT', 'APDP_INTERNAL', 'AI_AGENT', 'SYSTEM'] as const;
export const roleCodes = [
  'APPLICANT',
  'RECEPTION_AGENT',
  'INSTRUCTOR',
  'LEGAL_ANALYST',
  'TECHNICAL_ANALYST',
  'SUPERVISOR',
  'DECISION_AUTHORITY',
  'AUDITOR',
  'SYSTEM_ADMIN',
] as const;

export const organizationSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string().min(2),
  registrationNumber: z.string().min(2).optional(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(2),
  actorType: z.enum(actorTypes),
  roles: z.array(z.enum(roleCodes)).min(1),
});

export const dossierSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().min(6),
  organizationId: z.string().uuid().nullable(),
  applicantId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
  requestType: z.string().min(2),
  status: z.enum(dossierStates),
  version: z.number().int().positive(),
});

export const documentSchema = z.object({
  id: z.string().uuid(),
  dossierId: z.string().uuid(),
  documentType: z.string().min(2),
  fileName: z.string().min(1),
  storageKey: z.string().min(1),
  mimeType: z.string().min(3),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  version: z.number().int().positive(),
  uploadedBy: z.string().uuid(),
});

export const decisionSchema = z.object({
  id: z.string().uuid(),
  dossierId: z.string().uuid(),
  decisionType: z.string().min(2),
  status: z.enum(['DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'SIGNED', 'NOTIFIED']),
  reasoning: z.string().min(10),
  conditions: z.array(z.string()),
  preparedBy: z.string().uuid(),
  validatedBy: z.string().uuid().nullable(),
  validatedAt: z.string().datetime().nullable(),
  signedHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
}).superRefine((decision, context) => {
  const requiresHumanValidation = ['VALIDATED', 'SIGNED', 'NOTIFIED'].includes(decision.status);
  if (requiresHumanValidation && (!decision.validatedBy || !decision.validatedAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A validated decision requires a human validator and timestamp.',
      path: ['validatedBy'],
    });
  }
});

export type Organization = z.infer<typeof organizationSchema>;
export type User = z.infer<typeof userSchema>;
export type Dossier = z.infer<typeof dossierSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Decision = z.infer<typeof decisionSchema>;