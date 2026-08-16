import { DeterministicCandidateAiAdapter } from './deterministic-adapter.js';
import { validateInterviewTurnOutput, validateRewriteOutput } from './validators.js';
import type { CandidateAiAdapter, InterviewTurnInput, RewriteInput } from './contracts.js';

export interface OpenAIRequestSpec {
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
}

export function buildOpenAIRequest(spec: OpenAIRequestSpec) {
  return {
    model: spec.model,
    store: false,
    instructions: spec.instructions,
    input: spec.input,
    max_output_tokens: 1200,
    text: {
      format: {
        type: 'json_schema' as const,
        name: spec.schemaName,
        strict: true,
        schema: spec.schema,
      },
    },
  };
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new Error('AI provider returned an invalid response');
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error('AI provider returned no output');
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'output_text') {
        const value = (part as { text?: unknown }).text;
        if (typeof value === 'string' && value.trim()) return value;
      }
    }
  }
  throw new Error('AI provider returned no usable structured output');
}

async function requestStructured(
  apiKey: string,
  spec: OpenAIRequestSpec,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const body = buildOpenAIRequest(spec);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Error('AI provider request failed safely');
    }

    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt === 0) continue;
    if (!response.ok) throw new Error('AI provider request failed safely');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('AI provider returned invalid JSON');
    }
    try {
      return JSON.parse(extractOutputText(payload));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('AI provider structured output was invalid');
      throw error;
    }
  }
  throw new Error('AI provider request failed safely');
}

const rewriteSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'usedMetrics'],
  properties: {
    text: { type: 'string', maxLength: 3000 },
    usedMetrics: { type: 'array', items: { type: 'string' }, maxItems: 20 },
  },
};

const interviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['question', 'feedback', 'focusRequirementIds', 'evidenceRefs'],
  properties: {
    question: { type: 'string', maxLength: 1200 },
    feedback: { anyOf: [{ type: 'string', maxLength: 2500 }, { type: 'null' }] },
    focusRequirementIds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    evidenceRefs: { type: 'array', items: { type: 'string' }, maxItems: 30 },
  },
};

export class OpenAICandidateAiAdapter implements CandidateAiAdapter {
  readonly providerName = 'openai' as const;
  private readonly deterministic = new DeterministicCandidateAiAdapter();

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  diagnose(input: Parameters<CandidateAiAdapter['diagnose']>[0]) {
    return this.deterministic.diagnose(input);
  }

  analyzeJob(input: Parameters<CandidateAiAdapter['analyzeJob']>[0]) {
    return this.deterministic.analyzeJob(input);
  }

  async rewrite(input: RewriteInput) {
    if (!input.externalProcessingConsentId?.trim()) {
      return this.deterministic.rewrite(input);
    }
    const raw = await requestStructured(this.apiKey, {
      model: this.model,
      schemaName: 'candidate_rewrite',
      schema: rewriteSchema,
      instructions: 'Réécris uniquement les faits fournis. N’invente aucun chiffre, compétence, employeur, diplôme ou résultat. Utilise uniquement les métriques explicitement fournies.',
      input: JSON.stringify({ sourceStatement: input.sourceStatement, verifiedMetrics: input.verifiedMetrics }),
    }, this.fetchImpl);
    return validateRewriteOutput(raw, input);
  }

  async interviewTurn(input: InterviewTurnInput) {
    const deterministic = await this.deterministic.analyzeJob({ context: input.context, jobSpec: input.jobSpec });
    const raw = await requestStructured(this.apiKey, {
      model: this.model,
      schemaName: 'candidate_interview_turn',
      schema: interviewSchema,
      instructions: 'Agis comme coach d’entretien. Pose une question réaliste fondée uniquement sur les exigences fournies. Le feedback doit demander des preuves lorsqu’un résultat n’est pas soutenu. Ne prétends pas prédire exactement les questions d’un employeur.',
      input: JSON.stringify({
        job: { id: input.jobSpec.id, title: input.jobSpec.title, countryCode: input.jobSpec.countryCode },
        requirements: deterministic.requirements,
        turn: input.turn,
        candidateAnswer: input.candidateAnswer ?? null,
      }),
    }, this.fetchImpl);
    return validateInterviewTurnOutput(raw, input.jobSpec.requirements.map((requirement) => requirement.id));
  }
}
