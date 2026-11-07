/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HintFlowResponse, SolutionCode } from '../types';

/**
 * Minimal client for OrcaRouter's OpenAI-compatible Chat Completions API,
 * backed by DeepSeek V4.1 Flash (free tier). OrcaRouter answers browser
 * preflights with
 * `access-control-allow-origin: *`, so the app can call it directly.
 *
 * `response_format` is limited to `json_object` here rather than `json_schema`:
 * the gateway documents both, but schema support varies per upstream model, so
 * the response shapes live in the system prompts and are enforced client-side
 * by `coerceHintFlow`.
 */

const ORCAROUTER_ENDPOINT = 'https://api.orcarouter.ai/v1/chat/completions';

export const LLM_MODEL = 'deepseek/deepseek-v4.1-flash-free';

export type ReasoningEffort = 'low' | 'high' | 'max';

export interface GenerateJsonOptions {
  /** System prompt. Must describe the JSON shape the model should return. */
  system: string;
  user: string;
  /**
   * DeepSeek V4.1 Flash thinks by default. `disabled` skips reasoning entirely
   * and is several times faster, which is what latency-sensitive callers want;
   * DeepSeek requires omitting `reasoning_effort` in that mode.
   */
  thinking?: 'enabled' | 'disabled';
  /** Only sent when thinking is enabled; ignored by the API otherwise. */
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
}

export class LlmError extends Error {
  readonly detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'LlmError';
    this.detail = detail;
  }
}

const apiKey = (): string => import.meta.env.VITE_ORCAROUTER_API_KEY || '';

/** Strips ```json fences and any prose wrapped around the JSON body. */
const extractJson = (text: string): string => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return candidate.trim();
  }

  return candidate.slice(start, end + 1);
};

const requestCompletion = async (options: GenerateJsonOptions): Promise<string> => {
  const key = apiKey();

  if (!key) {
    throw new LlmError(
      'VITE_ORCAROUTER_API_KEY is not set. Add VITE_ORCAROUTER_API_KEY to your .env file and restart the dev server.',
    );
  }

  let response: Response;

  try {
    response = await fetch(ORCAROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.user },
        ],
        response_format: { type: 'json_object' },
        ...(options.thinking === 'disabled'
          ? { thinking: { type: 'disabled' } }
          : { thinking: { type: 'enabled' }, reasoning_effort: options.reasoningEffort ?? 'low' }),
        temperature: options.temperature ?? 1,
        stream: false,
      }),
    });
  } catch (error) {
    throw new LlmError('Could not reach the OrcaRouter API.', String(error));
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LlmError(
      `OrcaRouter request failed with HTTP ${response.status}.`,
      detail.slice(0, 300),
    );
  }

  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new LlmError('OrcaRouter returned an empty completion.');
  }

  return content;
};

/**
 * Requests a JSON object and parses it, retrying once on malformed output.
 * `json_object` mode guarantees valid JSON syntax, but says nothing about the
 * fields we actually need — hence `coerceHintFlow` below.
 */
export async function generateJson<T>(options: GenerateJsonOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await requestCompletion(options);

    try {
      return JSON.parse(extractJson(raw)) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw new LlmError('OrcaRouter returned malformed JSON.', String(lastError));
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const strings = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );

  return strings.length > 0 ? strings : undefined;
};

const asScore = (value: unknown, min: number, max: number): number | undefined => {
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) return undefined;

  return Math.min(max, Math.max(min, numeric));
};

const asSolutions = (value: unknown): SolutionCode[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const solutions = value.flatMap((item) => {
    const source = asRecord(item);
    const code = asString(source.code);

    if (!code) return [];

    return [{ language: (asString(source.language) ?? 'text').toLowerCase(), code }];
  });

  return solutions.length > 0 ? solutions : undefined;
};

/**
 * Normalizes a raw model response into a `HintFlowResponse`. This provides the
 * type guarantees a JSON schema would: every field the UI indexes into is
 * guaranteed to exist with the expected shape, so a partial response degrades
 * instead of crashing the terminal.
 */
export function coerceHintFlow(raw: unknown): HintFlowResponse {
  const source = asRecord(raw);

  const resources = asRecord(source.resources);
  const complexity = asRecord(source.complexity);

  const books = Array.isArray(resources.books)
    ? resources.books.flatMap((item) => {
        const book = asRecord(item);
        const title = asString(book.title);

        if (!title) return [];

        return [{ title, author: asString(book.author) ?? 'Unknown' }];
      })
    : [];

  const websites = Array.isArray(resources.websites)
    ? resources.websites.flatMap((item) => {
        const site = asRecord(item);
        const url = asString(site.url);

        if (!url) return [];

        return [{ name: asString(site.name) ?? url, url }];
      })
    : [];

  const time = asString(complexity.time);
  const space = asString(complexity.space);

  return {
    isRelevant: source.isRelevant !== false,
    overview: asString(source.overview) ?? '',
    hints: asStringArray(source.hints) ?? [],
    topic_tags: asStringArray(source.topic_tags),
    reflective_question: asString(source.reflective_question),
    difficulty_score: asScore(source.difficulty_score, 1, 10),
    technical_depth_score: asScore(source.technical_depth_score, 1, 5),
    solutions: asSolutions(source.solutions),
    solution: asString(source.solution),
    language: asString(source.language),
    complexity: time && space ? { time, space } : undefined,
    explanation: asString(source.explanation),
    pitfalls: asStringArray(source.pitfalls),
    resources: books.length > 0 || websites.length > 0 ? { books, websites } : undefined,
  };
}
