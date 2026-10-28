import type { Ref } from 'react';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';
import type { PostEventHeroCopy, PostEventProgress, PostEventStepKey } from '../../utils/post-event-steps';

/**
 * Fixed brand teal (the light-theme anchor and cta-deep values) so the white type keeps its
 * contrast in both themes; the theme tokens lighten in dark mode.
 */
const HERO_GRADIENT = 'bg-[linear-gradient(135deg,hsl(193_63%_28%)_0%,hsl(193_63%_38%)_100%)]';
const HERO_INK = 'text-[hsl(193_63%_28%)]';

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" stroke="rgba(255,255,255,0.25)" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        stroke="#fff"
        strokeDasharray={`${(done / total) * c} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="33" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="15" fontWeight="600">
        {done}/{total}
      </text>
    </svg>
  );
}

/**
 * Post-event hero (SCRUM-288): the next step to get paid, a progress ring and one button.
 * The step pills open done steps for review; future steps are not focusable.
 */
export function PostEventHero(props: {
  progress: PostEventProgress;
  copy: PostEventHeroCopy;
  onOpen: (key?: PostEventStepKey) => void;
  ctaRef?: Ref<HTMLButtonElement>;
}) {
  const { progress, copy, onOpen, ctaRef } = props;
  const { steps, active } = progress;
  const done = steps.filter((s) => s.state === 'complete').length;

  return (
    <div className={`overflow-hidden rounded-card text-white shadow-card ${HERO_GRADIENT}`}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-7">
        <ProgressRing done={done} total={steps.length} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/85">{copy.eyebrow}</p>
          <p className="mt-1 text-xl font-semibold leading-tight text-white sm:text-2xl">{copy.title}</p>
          <p className="mt-1.5 text-sm text-white">{copy.helper}</p>
        </div>
        {copy.cta ? (
          <button
            ref={ctaRef}
            type="button"
            onClick={() => onOpen()}
            className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white px-5 text-base font-semibold shadow-card transition-transform duration-150 hover:bg-white/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${HERO_INK}`}
          >
            {copy.cta}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <ol className="flex flex-wrap gap-2 border-t border-white/20 bg-black/10 px-5 py-3 sm:px-7" aria-label="Post-event progress">
        {steps.map((s) => {
          const isActive = s.key === active.key;
          const stateText =
            s.state === 'complete' ? 'complete' : s.state === 'attention' ? 'needs attention' : s.state === 'current' ? 'current step' : 'not started';
          const body = (
            <>
              {s.state === 'complete' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {s.state === 'attention' ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : null}
              <span className="sr-only">{`Step ${s.number} of ${steps.length}:`}</span> {s.label}
              <span className="sr-only">{`, ${stateText}`}</span>
            </>
          );
          const pill = [
            'inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold',
            isActive ? `bg-white ${HERO_INK}` : s.state === 'complete' ? 'bg-white/20 text-white' : 'text-white/85 ring-1 ring-white/40',
          ].join(' ');
          return (
            <li key={s.key}>
              {s.state === 'not_started' ? (
                <span className={pill} aria-current={isActive ? 'step' : undefined}>
                  {body}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(s.key)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`${pill} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
