import { useState, type ReactNode } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { postProductionApi, type ClipLookSuggestion, type PostProductionCapabilities } from '../../../api/postProduction';
import { formatTime, type Clip, type ClipLook, type Cue } from './clipperCore';
import { STYLES, type CutFormat, type CutStyle } from './socialCut';
import { logClipper } from './clipperLog';

/**
 * The look of a cut: a style for everything, then per clip an AI pass
 * that picks words to stress, numbers worth calling out, moments to push
 * in on and a few title options. It only ever points at things the
 * speaker said; nothing lands on the clip until it's ticked and applied.
 */

type Pick = { titles: Set<number>; emphasis: Set<number>; callouts: Set<number>; punchIns: Set<number> };
const allOf = (s: ClipLookSuggestion): Pick => ({
  titles: new Set(),
  emphasis: new Set(s.emphasis.map((_, i) => i)),
  callouts: new Set(s.callouts.map((_, i) => i)),
  punchIns: new Set(s.punchIns.map((_, i) => i)),
});

function Tick({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={['flex w-full items-start gap-2 rounded-[8px] px-2 py-1.5 text-left text-xs', on ? 'bg-anchor/10 text-text' : 'text-muted2 hover:bg-surface-2'].join(' ')}>
      <span className={['mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border', on ? 'border-anchor bg-anchor text-ground' : 'border-hairline-strong'].join(' ')}>{on ? <Check className="size-3" aria-hidden /> : null}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function LookPanel({
  format,
  onChange,
  clip,
  cues,
  caps,
  onUpdateClip,
}: {
  format: CutFormat;
  onChange: (patch: Partial<CutFormat>) => void;
  clip: Clip | null;
  cues: Cue[];
  caps: PostProductionCapabilities | undefined;
  onUpdateClip: (id: string, patch: Partial<Clip>) => void;
}) {
  const [modelId, setModelId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ clipId: string; s: ClipLookSuggestion; pick: Pick } | null>(null);
  const model = modelId || caps?.defaultModelId || caps?.models[0]?.id || '';
  const mine = result && clip && result.clipId === clip.id ? result : null;

  const suggest = async () => {
    if (!clip) return;
    const lines = cues.filter((c) => c.end > clip.start && c.start < clip.end);
    if (!lines.length) {
      setError('This clip has no transcript lines to work from.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await postProductionApi.suggestLook({ modelId: model || undefined, title: clip.title, style: format.style, start: clip.start, end: clip.end, cues: lines });
      setResult({ clipId: clip.id, s, pick: allOf(s) });
    } catch (err) {
      setError('The AI pass didn’t come back. Try again, or pick another model.');
      logClipper('look-suggest', err, { clip: clip.title, model });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: keyof Pick, i: number) =>
    setResult((r) => {
      if (!r) return r;
      const next = new Set(r.pick[k]);
      if (k === 'titles') {
        next.clear();
        if (!r.pick.titles.has(i)) next.add(i);
      } else if (next.has(i)) next.delete(i);
      else next.add(i);
      return { ...r, pick: { ...r.pick, [k]: next } };
    });

  const apply = () => {
    if (!mine || !clip) return;
    const { s, pick } = mine;
    const look: ClipLook = {
      emphasis: s.emphasis.filter((_, i) => pick.emphasis.has(i)),
      callouts: s.callouts.filter((_, i) => pick.callouts.has(i)),
      punchIns: s.punchIns.filter((_, i) => pick.punchIns.has(i)),
    };
    const title = [...pick.titles].map((i) => s.titles[i])[0];
    onUpdateClip(clip.id, { look, ...(title ? { openingTitle: title } : {}) });
    setResult(null);
  };

  return (
    <section className="space-y-2">
      <p className="meta text-faint">Style</p>
      <div role="group" aria-label="Style" className="flex gap-1 rounded-[9px] bg-surface-2 p-1">
        {(Object.keys(STYLES) as CutStyle[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={format.style === k}
            onClick={() => onChange({ style: k })}
            className={['h-8 min-w-0 flex-1 truncate rounded-[7px] px-2 text-xs', format.style === k ? 'bg-surface font-medium text-text shadow-card' : 'text-muted2 hover:text-text'].join(' ')}
          >
            {STYLES[k].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted2">{STYLES[format.style]?.hint}</p>

      <div className="space-y-2 rounded-[10px] bg-surface-2/60 p-2.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-text">
          <Sparkles className="size-3.5 text-anchor" aria-hidden /> AI look for this clip
        </p>
        {!caps?.ai ? (
          <p className="text-xs text-muted2">AI isn’t switched on for this environment yet.</p>
        ) : !clip ? (
          <p className="text-xs text-muted2">Select a clip to style it.</p>
        ) : !cues.length ? (
          <p className="text-xs text-muted2">Needs a transcript: the AI works from what was said.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Model</span>
                <select value={model} onChange={(e) => setModelId(e.target.value)} className="h-8 w-full rounded-[6px] bg-surface px-2 text-xs">
                  {caps.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.note ? ` · ${m.note}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void suggest()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-anchor px-3 text-xs font-medium text-ground disabled:opacity-50">
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />} Suggest
              </button>
            </div>
            {clip.look && !mine ? (
              <p className="text-xs text-muted2">
                Applied: {clip.look.emphasis.length} stressed words, {clip.look.callouts.length} callouts, {clip.look.punchIns.length} push-ins.{' '}
                <button type="button" onClick={() => onUpdateClip(clip.id, { look: undefined })} className="text-anchor hover:underline">
                  Remove
                </button>
              </p>
            ) : null}
            {error ? <p className="text-xs text-dim">{error}</p> : null}
            {mine ? (
              <div className="space-y-2">
                {mine.s.titles.length ? (
                  <div>
                    <p className="meta text-faint">Opening title (pick one, or keep yours)</p>
                    {mine.s.titles.map((t, i) => (
                      <Tick key={i} on={mine.pick.titles.has(i)} onClick={() => toggle('titles', i)}>
                        {t}
                      </Tick>
                    ))}
                  </div>
                ) : null}
                {mine.s.emphasis.length ? (
                  <div>
                    <p className="meta text-faint">Words to stress in the captions</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {mine.s.emphasis.map((w, i) => (
                        <button key={i} type="button" aria-pressed={mine.pick.emphasis.has(i)} onClick={() => toggle('emphasis', i)} className={['h-7 rounded-full px-2.5 text-xs', mine.pick.emphasis.has(i) ? 'bg-anchor text-ground' : 'bg-surface text-muted2'].join(' ')}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {mine.s.callouts.length ? (
                  <div>
                    <p className="meta text-faint">Number callouts{STYLES[format.style].callouts ? '' : ' (shown in Bold social and Explainer)'}</p>
                    {mine.s.callouts.map((c, i) => (
                      <Tick key={i} on={mine.pick.callouts.has(i)} onClick={() => toggle('callouts', i)}>
                        <span className="font-medium">{c.text}</span> {c.label ? <span className="text-muted2">{c.label}</span> : null} <span className="meta tabular-nums text-faint">at {formatTime(c.at, 0)}</span>
                      </Tick>
                    ))}
                  </div>
                ) : null}
                {mine.s.punchIns.length ? (
                  <div>
                    <p className="meta text-faint">Push-ins{STYLES[format.style].punch ? '' : ' (shown in Bold social)'}</p>
                    {mine.s.punchIns.map((p, i) => (
                      <Tick key={i} on={mine.pick.punchIns.has(i)} onClick={() => toggle('punchIns', i)}>
                        <span className="meta tabular-nums">
                          {formatTime(p.start, 1)} – {formatTime(p.end, 1)}
                        </span>
                      </Tick>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setResult(null)} className="h-8 flex-1 rounded-[6px] bg-surface text-xs text-dim">
                    Discard
                  </button>
                  <button type="button" onClick={apply} className="h-8 flex-1 rounded-[6px] bg-anchor text-xs font-medium text-ground">
                    Apply to clip
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
