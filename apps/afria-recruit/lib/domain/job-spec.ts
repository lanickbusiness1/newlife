import type { CanonicalJobInput, JobSpec } from './types.js';

export function buildJobSpec(job: CanonicalJobInput): JobSpec {
  const requirements = [
    ...(job.skills ?? []).map((skill) => ({
      id: `skill:${skill.skillId}`,
      kind: 'skill' as const,
      label: skill.label,
      required: skill.required,
      skillId: skill.skillId,
      minimumYears: skill.minimumYears ?? undefined,
    })),
    ...(job.languages ?? []).map((language) => ({
      id: `language:${language.languageCode}`,
      kind: 'language' as const,
      label: language.label,
      required: language.required,
      languageCode: language.languageCode,
      minimumLevel: language.minimumLevel,
    })),
  ];

  return {
    id: job.id,
    title: job.title,
    countryCode: job.countryCode ?? null,
    requirements,
  };
}
