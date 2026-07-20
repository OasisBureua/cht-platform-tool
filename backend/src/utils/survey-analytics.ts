/**
 * Pure survey-response analytics aggregator.
 *
 * Turns a survey's `questions` schema + a list of responses into chart-ready
 * aggregates: per-question distributions/stats, response totals, an optional
 * completion rate, a response-level score summary, and a daily time series.
 *
 * Deterministic and side-effect free (no DB, no clock, no randomness) so it is
 * trivially unit-testable. The NestJS service (BE-3) is responsible for loading
 * rows and supplying `eligibleCount`; the controller (BE-4) exposes it.
 *
 * Shares the BE-1 schema normalizer so it agrees with the CSV exporter on
 * question ids, order, prompts, types, and options.
 */
import { stripIdentityFieldsFromSurveyAnswers } from './survey-answer-sanitizer';
import {
  hasNativeSurveySchema,
  listNativeSurveyQuestions,
  type NativeSurveyQuestion,
} from './survey-schema';

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

/** Cross-cut dimensions responses can be segmented by. */
export type SurveySegmentDimension = 'specialty' | 'status' | 'attendance';

export interface SurveyAnalyticsResponseInput {
  /** ISO timestamp; drives time series + first/last. */
  submittedAt: string;
  /** For unique-respondent counting. Anonymous rows each count once. */
  userId?: string | null;
  /** Response-level score (PRE_TEST/POST_TEST). Feeds the totals.score summary. */
  score?: number | null;
  answers: Record<string, unknown>;
  /** Per-response segment values; consumed only when `segmentBy` is set. */
  segment?: Partial<Record<SurveySegmentDimension, string | null>>;
}

export interface BuildSurveyAnalyticsInput {
  surveyType: string;
  /** Raw `Survey.questions` blob (native sections, top-level array, or Jotform). */
  questionsSchema: unknown;
  responses: SurveyAnalyticsResponseInput[];
  /** Denominator for completion rate (e.g. approved registrations). Omit to skip. */
  eligibleCount?: number | null;
  /**
   * Emit redacted free-text sample answers (default false = counts only).
   *
   * Even when true, samples are only produced for author-declared text/long_text
   * questions, identity fields are stripped, and email/phone values are redacted.
   * Note: identity *values* typed inline in prose (e.g. a name) cannot be reliably
   * scrubbed, which is why samples are opt-in.
   */
  includeTextSamples?: boolean;
  /** Max free-text samples per text question (default 5). */
  textSampleLimit?: number;
  /**
   * When set, also emit a per-segment breakdown grouped by this dimension.
   * Segment groups are always counts-only (no free-text samples).
   */
  segmentBy?: SurveySegmentDimension | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

export interface ChoiceOptionCount {
  label: string;
  count: number;
  /** Share of respondents who answered this question (0–100). Multi can sum >100. */
  percentage: number;
}

export interface ChoiceQuestionAnalytics {
  id: string;
  prompt: string;
  type: string;
  kind: 'choice';
  multiSelect: boolean;
  maxSelections?: number;
  /** Inferred from data (no native schema type). */
  inferred?: boolean;
  totalAnswered: number;
  options: ChoiceOptionCount[];
}

export interface NumericStats {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  histogram: Array<{ value: number; count: number }>;
}

export interface RatingQuestionAnalytics extends NumericStats {
  id: string;
  prompt: string;
  type: string;
  kind: 'rating';
  inferred?: boolean;
}

export interface TextQuestionAnalytics {
  id: string;
  prompt: string;
  type: string;
  kind: 'text';
  inferred?: boolean;
  responseCount: number;
  /** PII-safe (identity stripped + email/phone redacted). Empty for inferred/unknown keys. */
  samples: string[];
}

export type QuestionAnalytics =
  | ChoiceQuestionAnalytics
  | RatingQuestionAnalytics
  | TextQuestionAnalytics;

export interface SurveyAnalyticsTotals {
  totalResponses: number;
  uniqueRespondents: number;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  completionRate: { eligible: number; completed: number; rate: number } | null;
  /** Response-level score summary (test surveys); null when no numeric scores. */
  score: NumericStats | null;
}

/** One segment value (e.g. a specialty, registration status) and its aggregates. */
export interface SurveySegmentGroup {
  /** Raw segment value ('unknown' when missing/empty). */
  key: string;
  /** Display label (same as key, except 'unknown' → 'Unknown'). */
  label: string;
  totalResponses: number;
  /** Counts-only per-question aggregates for this segment (no free-text samples). */
  questions: QuestionAnalytics[];
}

export interface SurveySegmentBreakdown {
  dimension: SurveySegmentDimension;
  groups: SurveySegmentGroup[];
}

export interface SurveyResponseAnalytics {
  surveyType: string;
  hasNativeSchema: boolean;
  totals: SurveyAnalyticsTotals;
  timeSeries: Array<{ date: string; count: number }>;
  questions: QuestionAnalytics[];
  /** Per-segment breakdown when `segmentBy` was provided; otherwise null. */
  segments: SurveySegmentBreakdown | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TEXT_SAMPLE_LIMIT = 5;
const SAMPLE_MAX_LEN = 200;

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);
const TEXT_TYPES = new Set(['text', 'long_text']);
const RATING_TYPES = new Set(['rating', 'scale', 'number', 'numeric']);
/** Display-only; carries no answer data. */
const SKIP_TYPES = new Set(['info']);

function round(value: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function isAnswered(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return '';
}

function redactPii(text: string): string {
  return text
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(PHONE_RE, '[redacted-phone]')
    .slice(0, SAMPLE_MAX_LEN);
}

function numericStats(values: number[]): NumericStats {
  const count = values.length;
  if (count === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      min: null,
      max: null,
      histogram: [],
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mid = Math.floor(count / 2);
  const median =
    count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const histMap = new Map<number, number>();
  for (const v of sorted) histMap.set(v, (histMap.get(v) ?? 0) + 1);
  const histogram = [...histMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, c]) => ({ value, count: c }));
  return {
    count,
    mean: round(sum / count, 2),
    median: round(median, 2),
    min: sorted[0],
    max: sorted[count - 1],
    histogram,
  };
}

function buildChoiceOptions(
  values: unknown[],
  declaredOptions: string[] | undefined,
  multiSelect: boolean,
): { totalAnswered: number; options: ChoiceOptionCount[] } {
  const counts = new Map<string, number>();
  const order: string[] = [];
  const bump = (label: string) => {
    if (!counts.has(label)) order.push(label);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  };

  // Seed declared options so they render even at zero.
  for (const opt of declaredOptions ?? []) {
    const label = String(opt);
    if (!counts.has(label)) {
      counts.set(label, 0);
      order.push(label);
    }
  }

  let totalAnswered = 0;
  for (const raw of values) {
    if (!isAnswered(raw)) continue;
    totalAnswered += 1;
    const selections = multiSelect ? (Array.isArray(raw) ? raw : [raw]) : [raw];
    for (const sel of selections) {
      const label = toText(sel).trim();
      if (label) bump(label);
    }
  }

  const options = order.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    percentage:
      totalAnswered > 0
        ? round(((counts.get(label) ?? 0) / totalAnswered) * 100)
        : 0,
  }));

  return { totalAnswered, options };
}

function buildTextAnalytics(
  base: { id: string; prompt: string; type: string; inferred?: boolean },
  values: unknown[],
  includeSamples: boolean,
  sampleLimit: number,
): TextQuestionAnalytics {
  const answered = values.filter(isAnswered);
  const samples: string[] = [];
  if (includeSamples) {
    const seen = new Set<string>();
    for (const raw of answered) {
      const text = redactPii(toText(raw).trim());
      if (!text || seen.has(text)) continue;
      seen.add(text);
      samples.push(text);
      if (samples.length >= sampleLimit) break;
    }
  }
  return {
    ...base,
    kind: 'text',
    responseCount: answered.length,
    samples,
  };
}

/** Column of answers for a question id across responses. */
function columnFor(
  answersById: Record<string, unknown>[],
  id: string,
): unknown[] {
  return answersById.map((a) => a[id]);
}

/**
 * Build per-question aggregates for a set of (already identity-stripped) answer
 * maps: schema questions first (in order), then inferred aggregates for any
 * answer keys not present in the schema. Shared by the overall analytics and
 * each per-segment group.
 */
function buildQuestionsForResponses(
  schemaQuestions: NativeSurveyQuestion[],
  answersById: Record<string, unknown>[],
  includeTextSamples: boolean,
  sampleLimit: number,
): QuestionAnalytics[] {
  const questions: QuestionAnalytics[] = [];
  const handledIds = new Set<string>();

  for (const q of schemaQuestions) {
    const id = String(q.id ?? '').trim();
    if (!id || handledIds.has(id)) continue;
    const type = String(q.type ?? '')
      .trim()
      .toLowerCase();
    if (SKIP_TYPES.has(type)) {
      handledIds.add(id);
      continue;
    }
    handledIds.add(id);
    const agg = aggregateSchemaQuestion(
      q,
      id,
      columnFor(answersById, id),
      includeTextSamples,
      sampleLimit,
    );
    if (agg) questions.push(agg);
  }

  // Extra answer keys not present in the schema (Jotform-sourced or drift).
  const extraIds = new Set<string>();
  for (const answers of answersById) {
    for (const key of Object.keys(answers)) {
      if (!handledIds.has(key)) extraIds.add(key);
    }
  }
  for (const id of [...extraIds].sort()) {
    handledIds.add(id);
    questions.push(aggregateInferredQuestion(id, columnFor(answersById, id)));
  }

  return questions;
}

/**
 * Group responses (by aligned answer-map index) into per-segment aggregates.
 * Groups are counts-only (samples suppressed) and sorted by size desc, key asc.
 */
function buildSegmentBreakdown(
  dimension: SurveySegmentDimension,
  responses: SurveyAnalyticsResponseInput[],
  answersById: Record<string, unknown>[],
  schemaQuestions: NativeSurveyQuestion[],
  sampleLimit: number,
): SurveySegmentBreakdown {
  const buckets = new Map<string, Record<string, unknown>[]>();
  responses.forEach((r, i) => {
    const raw = (r.segment?.[dimension] ?? '').toString().trim();
    const key = raw || 'unknown';
    const bucket = buckets.get(key) ?? [];
    bucket.push(answersById[i]);
    buckets.set(key, bucket);
  });

  const groups: SurveySegmentGroup[] = [...buckets.entries()]
    .map(([key, groupAnswers]) => ({
      key,
      label: key === 'unknown' ? 'Unknown' : key,
      totalResponses: groupAnswers.length,
      questions: buildQuestionsForResponses(
        schemaQuestions,
        groupAnswers,
        false,
        sampleLimit,
      ),
    }))
    .sort((a, b) =>
      b.totalResponses !== a.totalResponses
        ? b.totalResponses - a.totalResponses
        : a.key < b.key
          ? -1
          : a.key > b.key
            ? 1
            : 0,
    );

  return { dimension, groups };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function buildSurveyResponseAnalytics(
  input: BuildSurveyAnalyticsInput,
): SurveyResponseAnalytics {
  const sampleLimit = input.textSampleLimit ?? DEFAULT_TEXT_SAMPLE_LIMIT;
  const includeTextSamples = input.includeTextSamples ?? false;
  const responses = input.responses ?? [];

  // Defense-in-depth: strip identity fields even though submit already does.
  const answersById = responses.map((r) =>
    stripIdentityFieldsFromSurveyAnswers(r.answers ?? {}),
  );

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalResponses = responses.length;

  const userIds = new Set<string>();
  let anonymous = 0;
  for (const r of responses) {
    const uid = (r.userId ?? '').trim();
    if (uid) userIds.add(uid);
    else anonymous += 1;
  }
  const uniqueRespondents = userIds.size + anonymous;

  const timestamps = responses
    .map((r) => r.submittedAt)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .sort();
  const firstResponseAt = timestamps[0] ?? null;
  const lastResponseAt = timestamps[timestamps.length - 1] ?? null;

  const eligible = input.eligibleCount;
  const completionRate =
    typeof eligible === 'number' && Number.isFinite(eligible) && eligible > 0
      ? {
          eligible,
          completed: uniqueRespondents,
          rate: round((uniqueRespondents / eligible) * 100),
        }
      : null;

  const scoreValues = responses
    .map((r) => toNumber(r.score))
    .filter((n): n is number => n != null);
  const score = scoreValues.length > 0 ? numericStats(scoreValues) : null;

  // ── Time series (daily, UTC) ────────────────────────────────────────────────
  const byDay = new Map<string, number>();
  for (const t of timestamps) {
    const date = t.slice(0, 10);
    byDay.set(date, (byDay.get(date) ?? 0) + 1);
  }
  const timeSeries = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, count]) => ({ date, count }));

  // ── Questions ───────────────────────────────────────────────────────────────
  const schemaQuestions = listNativeSurveyQuestions(input.questionsSchema);
  const questions = buildQuestionsForResponses(
    schemaQuestions,
    answersById,
    includeTextSamples,
    sampleLimit,
  );

  // ── Segments (optional cross-cut) ────────────────────────────────────────────
  const segments = input.segmentBy
    ? buildSegmentBreakdown(
        input.segmentBy,
        responses,
        answersById,
        schemaQuestions,
        sampleLimit,
      )
    : null;

  return {
    surveyType: input.surveyType,
    hasNativeSchema: hasNativeSurveySchema(input.questionsSchema),
    totals: {
      totalResponses,
      uniqueRespondents,
      firstResponseAt,
      lastResponseAt,
      completionRate,
      score,
    },
    timeSeries,
    questions,
    segments,
  };
}

function aggregateSchemaQuestion(
  q: NativeSurveyQuestion,
  id: string,
  values: unknown[],
  includeTextSamples: boolean,
  sampleLimit: number,
): QuestionAnalytics | null {
  const prompt = String(q.prompt ?? id).trim() || id;
  const type = String(q.type ?? '')
    .trim()
    .toLowerCase();
  const base = { id, prompt, type: type || 'unknown' };

  if (CHOICE_TYPES.has(type)) {
    const multiSelect = type === 'multi_choice';
    const { totalAnswered, options } = buildChoiceOptions(
      values,
      q.options,
      multiSelect,
    );
    return {
      ...base,
      kind: 'choice',
      multiSelect,
      ...(typeof q.maxSelections === 'number'
        ? { maxSelections: q.maxSelections }
        : {}),
      totalAnswered,
      options,
    };
  }

  if (RATING_TYPES.has(type)) {
    const nums = values.map(toNumber).filter((n): n is number => n != null);
    return { ...base, kind: 'rating', ...numericStats(nums) };
  }

  if (TEXT_TYPES.has(type)) {
    return buildTextAnalytics(base, values, includeTextSamples, sampleLimit);
  }

  // Unknown/legacy schema type → infer from the data (samples suppressed).
  return aggregateInferredQuestion(id, values, prompt);
}

/**
 * Aggregate a key with no known type: infer choice vs rating vs text from data.
 * Samples are suppressed (we can't assume the field is non-identifying free text).
 */
function aggregateInferredQuestion(
  id: string,
  values: unknown[],
  prompt = id,
): QuestionAnalytics {
  const base = { id, prompt, type: 'unknown', inferred: true as const };
  const answered = values.filter(isAnswered);

  if (answered.length === 0) {
    return { ...base, kind: 'text', responseCount: 0, samples: [] };
  }

  const anyArray = answered.some((v) => Array.isArray(v));
  const allNumeric = answered.every((v) => toNumber(v) != null);

  if (allNumeric && !anyArray) {
    const nums = answered.map(toNumber).filter((n): n is number => n != null);
    return { ...base, kind: 'rating', ...numericStats(nums) };
  }

  // Low-cardinality → treat as a choice distribution; otherwise free text.
  const distinct = new Set(answered.map((v) => toText(v).trim()));
  if (anyArray || distinct.size <= 20) {
    const { totalAnswered, options } = buildChoiceOptions(
      values,
      undefined,
      anyArray,
    );
    return {
      ...base,
      kind: 'choice',
      multiSelect: anyArray,
      totalAnswered,
      options,
    };
  }

  return buildTextAnalytics(base, values, false, 0);
}
