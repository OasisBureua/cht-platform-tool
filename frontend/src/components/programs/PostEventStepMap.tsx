import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ChevronDown } from 'lucide-react';
import {
  isPostEventStepSelectable,
  type PostEventStep,
  type PostEventStepKey,
  type PostEventStepState,
} from '../../utils/post-event-steps';

const STATE_TEXT: Record<PostEventStepState, string> = {
  complete: 'complete',
  current: 'current step',
  attention: 'needs attention',
  not_started: 'not started',
};

function StepDot({ step, size = 'md' }: { step: PostEventStep; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-7 w-7 text-xs';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const tone =
    step.state === 'complete'
      ? 'bg-success text-card'
      : step.state === 'current'
        ? 'bg-foreground text-card ring-2 ring-foreground/25 ring-offset-2 ring-offset-card'
        : step.state === 'attention'
          ? 'bg-warning text-card ring-2 ring-warning/30 ring-offset-2 ring-offset-card'
          : 'border border-border bg-card text-muted-foreground';
  return (
    <span
      aria-hidden
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ${tone}`}
    >
      {step.state === 'complete' ? (
        <Check className={icon} strokeWidth={3} />
      ) : step.state === 'attention' ? (
        <AlertTriangle className={icon} strokeWidth={2.5} />
      ) : (
        step.number
      )}
    </span>
  );
}

function labelTone(state: PostEventStepState) {
  if (state === 'attention') return 'font-semibold text-warning';
  if (state === 'current') return 'font-semibold text-foreground';
  if (state === 'complete') return 'font-medium text-foreground';
  return 'font-medium text-muted-foreground';
}

/**
 * Numbered post-event step map (SCRUM-288). Horizontal on desktop; a compact
 * "Step 2 of 4" bar with an expandable list on phones.
 *
 * Done steps and the step in progress can be opened: in place via `onSelect`
 * (program page) or as links via `stepHref` (dashboard card, Surveys tab).
 * Steps that are not started yet are plain text, so they are not focusable.
 */
export function PostEventStepMap(props: {
  steps: PostEventStep[];
  /** The step in progress (first incomplete). Carries aria-current. */
  active: PostEventStep;
  /** Step shown in the panel below when the learner is reviewing an earlier step. */
  viewingKey?: PostEventStepKey | null;
  onSelect?: (key: PostEventStepKey) => void;
  stepHref?: (key: PostEventStepKey) => string;
  label?: string;
  className?: string;
}) {
  const { steps, active, viewingKey, onSelect, stepHref, label = 'Post-event progress', className = '' } = props;
  const [listOpen, setListOpen] = useState(false);
  const listId = useId();
  const total = steps.length;

  const stepTarget = (step: PostEventStep, children: ReactNode, extraClass: string) => {
    const isActive = step.key === active.key;
    const viewing = viewingKey === step.key && !isActive;
    // The space sits outside the sr-only span so the accessible name reads "Step 2 of 4: Survey".
    const srPrefix = (
      <>
        <span className="sr-only">{`Step ${step.number} of ${total}:`}</span>{' '}
      </>
    );
    const srSuffix = (
      <span className="sr-only">{`, ${STATE_TEXT[step.state]}${viewing ? ', showing below' : ''}`}</span>
    );
    const body = (
      <>
        {srPrefix}
        {children}
        {srSuffix}
      </>
    );
    const focusRing =
      'rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-card';
    if (isPostEventStepSelectable(step) && stepHref) {
      return (
        <Link
          to={stepHref(step.key)}
          aria-current={isActive ? 'step' : undefined}
          className={`${extraClass} ${focusRing} hover:bg-muted`}
        >
          {body}
        </Link>
      );
    }
    if (isPostEventStepSelectable(step) && onSelect) {
      return (
        <button
          type="button"
          onClick={() => onSelect(step.key)}
          aria-current={isActive ? 'step' : undefined}
          className={`${extraClass} ${focusRing} text-left hover:bg-muted ${viewing ? 'bg-muted' : ''}`}
        >
          {body}
        </button>
      );
    }
    return (
      <span aria-current={isActive ? 'step' : undefined} className={extraClass}>
        {body}
      </span>
    );
  };

  return (
    <nav aria-label={label} className={className}>
      {/* Desktop and tablet: horizontal stepper. */}
      <ol
        className="hidden sm:grid gap-x-2"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {steps.map((step, idx) => {
          const isActive = step.key === active.key;
          const nextDone = steps[idx + 1] && step.state === 'complete';
          return (
            <li key={step.key} className="min-w-0">
              <div className="flex items-center gap-2">
                {stepTarget(
                  step,
                  <span className="flex min-w-0 items-center gap-2">
                    <StepDot step={step} />
                    <span className={`truncate text-sm ${labelTone(step.state)}`}>{step.label}</span>
                  </span>,
                  '-m-1 inline-flex min-w-0 max-w-full p-1',
                )}
                {idx < total - 1 ? (
                  <span
                    aria-hidden
                    className={['h-0.5 min-w-4 flex-1 rounded-full', nextDone ? 'bg-success' : 'bg-border'].join(' ')}
                  />
                ) : null}
              </div>
              {isActive ? (
                <p className="mt-1.5 pl-9 pr-2 text-xs leading-snug text-muted-foreground text-pretty">
                  {step.helper}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Phones: compact bar. */}
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step {active.number} of {total}
            </p>
            <p className={`mt-0.5 inline-flex items-center gap-1.5 text-base ${labelTone(active.state)}`}>
              {active.state === 'attention' ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> : null}
              {active.state === 'complete' ? <Check className="h-4 w-4 shrink-0 text-success" aria-hidden /> : null}
              {active.label}
              {active.state === 'attention' ? <span className="sr-only">, needs attention</span> : null}
              {active.state === 'complete' ? <span className="sr-only">, complete</span> : null}
            </p>
          </div>
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls={listId}
            onClick={() => setListOpen((v) => !v)}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          >
            All steps
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-150 ${listOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {steps.map((step) => (
            <span
              key={step.key}
              className={[
                'h-1.5 flex-1 rounded-full',
                step.state === 'complete'
                  ? 'bg-success'
                  : step.state === 'current'
                    ? 'bg-foreground'
                    : step.state === 'attention'
                      ? 'bg-warning'
                      : 'bg-border',
              ].join(' ')}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">{active.helper}</p>
        <ol id={listId} hidden={!listOpen} className="mt-3 space-y-1 border-t border-border pt-3">
          {steps.map((step) => (
            <li key={step.key}>
              {stepTarget(
                step,
                <span className="flex items-center gap-3">
                  <StepDot step={step} size="sm" />
                  <span className={`text-sm ${labelTone(step.state)}`}>{step.title}</span>
                </span>,
                'flex min-h-[44px] w-full items-center px-2',
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
