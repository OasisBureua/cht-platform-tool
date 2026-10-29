import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import { cleanCues, type TranscriptCue } from './transcribe-output.util';

export type LookModel = { id: string; label: string; note?: string };

export type LookSuggestion = {
  titles: string[];
  emphasis: string[];
  callouts: { at: number; text: string; label?: string }[];
  punchIns: { start: number; end: number }[];
};

const STYLE_BRIEF: Record<string, string> = {
  clean: 'Clean: understated. Few stressed words, no push-ins.',
  bold: 'Bold social: punchy short-form for TikTok and Reels. Stress the words that carry the claim, call out every number that matters, push in on the line that lands hardest.',
  explainer:
    'Explainer: calm and educational. Stress key terms, call out numbers as facts to remember, no push-ins.',
};

const SYSTEM = `You are a short-form video editor for Community Health Media, which publishes clips of physicians (KOLs) talking to other clinicians. You style one clip from its transcript.

You never change or invent what anyone said. Everything you point at must be in the transcript:
- emphasis: single words copied exactly from the transcript that carry the point (drug names, numbers, "never", "always"). At most 8.
- callouts: numbers or short figures the speaker says, shown big on screen when they say them. "text" is the figure as a viewer reads it ("10%", "1 in 10", "3–6 months"); it must be something said in the line at that time, written compactly. "label" is 1 to 4 words of context taken from the same line. "at" is the start time of the line it's said in. At most 4; none if no figures are said.
- punchIns: start and end times (seconds, inside the clip) of the one or two lines that land hardest, 2 to 6 seconds each. Empty for styles that don't use them.
- titles: three opening-title options, 3 to 8 words, plain and specific to what is said, no clickbait, no claims beyond the transcript. You may wrap one key phrase in [square brackets] to highlight it.

Medical accuracy matters more than punch: don't sharpen a hedged statement into a stronger claim.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titles', 'emphasis', 'callouts', 'punchIns'],
  properties: {
    titles: { type: 'array', items: { type: 'string' } },
    emphasis: { type: 'array', items: { type: 'string' } },
    callouts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['at', 'text', 'label'],
        properties: {
          at: { type: 'number' },
          text: { type: 'string' },
          label: { type: 'string' },
        },
      },
    },
    punchIns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end'],
        properties: { start: { type: 'number' }, end: { type: 'number' } },
      },
    },
  },
} as const;

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  fifteen: '15',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  hundred: '100',
};

const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, '');
/** The digits a line contains, with spelled-out numbers turned into digits. */
const digitsOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b[a-z]+\b/g, (w) => NUMBER_WORDS[w] ?? w)
    .match(/\d+(?:\.\d+)?/g) ?? [];

/**
 * AI suggestions for a clip's look, from Claude on Amazon Bedrock. The
 * model only points at the transcript; everything it returns is checked
 * against the lines before it goes back, and the editor still ticks what
 * to keep.
 */
@Injectable()
export class PostProductionLookService {
  private readonly logger = new Logger(PostProductionLookService.name);
  private client: AnthropicBedrockMantle | null = null;

  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return (
      !!this.config.get<boolean>('postProduction.aiEnabled') &&
      this.models().length > 0
    );
  }

  models(): LookModel[] {
    return this.config.get<LookModel[]>('postProduction.models') ?? [];
  }

  private bedrock(): AnthropicBedrockMantle {
    if (!this.client) {
      this.client = new AnthropicBedrockMantle({
        awsRegion:
          this.config.get<string>('postProduction.bedrockRegion') ||
          'us-east-1',
      });
    }
    return this.client;
  }

  async suggest(body: {
    modelId?: string;
    title?: string;
    style?: string;
    start: number;
    end: number;
    cues: unknown;
  }): Promise<LookSuggestion> {
    if (!this.enabled()) {
      throw new ServiceUnavailableException(
        'AI looks are not switched on for this environment.',
      );
    }
    const models = this.models();
    const model = models.find((m) => m.id === body.modelId) ?? models[0];
    const start = Number(body.start),
      end = Number(body.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new BadRequestException('start and end are required');
    }
    const lines = cleanCues(body.cues).filter(
      (c) => c.end > start && c.start < end,
    );
    if (!lines.length)
      throw new BadRequestException('No transcript lines inside the clip');
    if (lines.length > 400)
      throw new BadRequestException(
        'That clip is too long to style; keep it under about ten minutes.',
      );
    const style = STYLE_BRIEF[body.style ?? ''] ? body.style! : 'bold';

    const transcript = lines
      .map(
        (c) =>
          `[${c.start.toFixed(2)}–${c.end.toFixed(2)}] ${c.speaker ? `${c.speaker}: ` : ''}${c.text}`,
      )
      .join('\n');
    const prompt = `Clip "${(body.title ?? '').slice(0, 120)}", from ${start.toFixed(2)}s to ${end.toFixed(2)}s.\nStyle: ${STYLE_BRIEF[style]}\n\nTranscript (seconds):\n${transcript}`;

    let response: Message;
    try {
      response = await this.bedrock().messages.create({
        model: model.id,
        max_tokens: 4000,
        system: SYSTEM,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: SCHEMA },
        },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Bedrock ${model.id} failed: ${message}`);
      throw new BadGatewayException(
        `The AI model didn't answer: ${message.slice(0, 200)}`,
      );
    }
    if (response.stop_reason === 'refusal') {
      this.logger.warn(
        `Bedrock ${model.id} declined a look request (${response.stop_details?.category ?? 'no category'})`,
      );
      throw new UnprocessableEntityException(
        'The model declined this clip. Try another model.',
      );
    }
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text')
      throw new BadGatewayException('The AI model returned nothing.');
    let raw: LookSuggestion;
    try {
      raw = JSON.parse(text.text) as LookSuggestion;
    } catch {
      throw new BadGatewayException(
        'The AI model returned something that wasn’t JSON.',
      );
    }
    return this.check(raw, lines, start, end, style);
  }

  /** Keeps only suggestions that point at what was actually said, inside the clip. */
  check(
    raw: LookSuggestion,
    lines: TranscriptCue[],
    start: number,
    end: number,
    style: string,
  ): LookSuggestion {
    const said = new Set(
      lines.flatMap((c) => c.text.split(/\s+/).map(bare)).filter(Boolean),
    );
    const emphasis = [
      ...new Set(
        (raw.emphasis ?? [])
          .map((w) => String(w).trim())
          .filter((w) => w && said.has(bare(w))),
      ),
    ].slice(0, 8);
    const callouts = (raw.callouts ?? [])
      .map((c) => {
        const at = Number(c.at);
        const line = lines.find(
          (l) => at >= l.start - 0.5 && at <= l.end + 0.5,
        );
        const digits = digitsOf(String(c.text));
        if (!line || !Number.isFinite(at) || !digits.length) return null;
        const lineDigits = new Set(digitsOf(line.text));
        if (!digits.every((d) => lineDigits.has(d))) return null;
        const label = String(c.label ?? '')
          .trim()
          .slice(0, 40);
        return {
          at: Math.max(start, line.start),
          text: String(c.text).trim().slice(0, 16),
          ...(label ? { label } : {}),
        };
      })
      .filter((c): c is LookSuggestion['callouts'][number] => !!c)
      .slice(0, 4);
    const punchIns =
      style === 'bold'
        ? (raw.punchIns ?? [])
            .map((p) => ({
              start: Math.max(start, Number(p.start)),
              end: Math.min(end, Number(p.end)),
            }))
            .filter(
              (p) =>
                Number.isFinite(p.start) &&
                Number.isFinite(p.end) &&
                p.end - p.start >= 1 &&
                p.end - p.start <= 8,
            )
            .slice(0, 2)
        : [];
    const titles = (raw.titles ?? [])
      .map((t) => String(t).replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 3 && t.length <= 80)
      .slice(0, 3);
    return { titles, emphasis, callouts, punchIns };
  }
}
