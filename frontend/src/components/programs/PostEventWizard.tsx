import type { ReactNode, Ref } from 'react';
import { AlertTriangle, Clock3, X } from 'lucide-react';
import type { PostEventProgress, PostEventStep, PostEventStepKey } from '../../utils/post-event-steps';

function segmentTone(step: PostEventStep) {
  if (step.state === 'complete') return 'bg-success';
  if (step.state === 'current') return 'bg-cta';
  if (step.state === 'attention') return 'bg-orange-400';
  return 'bg-border';
}

const STATE_TEXT = {
  complete: 'complete',
  current: 'current step',
  attention: 'needs attention',
  not_started: 'not started',
} as const;

/**
 * Labelled progress bar for the wizard header. Doubles as the step map inside the drawer:
 * done steps (and the step in progress) are buttons, future steps are plain text.
 */
function WizardSteps({
  progress,
  shownKey,
  onSelect,
}: {
  progress: PostEventProgress;
  shownKey: PostEventStepKey;
  onSelect: (key: PostEventStepKey) => void;
}) {
  const { steps, active } = progress;
  return (
    <ol className="flex gap-1.5" aria-label="Post-event progress">
      {steps.map((s) => {
        const body = (
          <>
            <span aria-hidden className={`block h-1.5 rounded-full ${segmentTone(s)}`} />
            <span
              className={[
                'mt-1.5 flex items-center gap-1 truncate text-xs',
                s.key === shownKey ? 'font-semibold text-foreground' : s.state === 'not_started' ? 'text-muted-foreground' : 'font-medium text-foreground',
              ].join(' ')}
            >
              {s.state === 'attention' ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber" aria-hidden /> : null}
              <span className="sr-only">{`Step ${s.number} of ${steps.length}:`}</span> {s.label}
              <span className="sr-only">{`, ${STATE_TEXT[s.state]}`}</span>
            </span>
          </>
        );
        const isActive = s.key === active.key;
        return (
          <li key={s.key} className="min-w-0 flex-1">
            {s.state === 'not_started' ? (
              <span className="block" aria-current={isActive ? 'step' : undefined}>
                {body}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                aria-current={isActive ? 'step' : undefined}
                className="block w-full rounded-[4px] text-left outline-none focus-visible:ring-2 focus-visible:ring-anchor focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Focused one-step-at-a-time wizard shown inside the post-event drawer (SCRUM-288).
 */
export function PostEventWizard(props: {
  progress: PostEventProgress;
  shown: PostEventStep;
  reviewing: boolean;
  titleId: string;
  headingRef: Ref<HTMLHeadingElement>;
  onSelect: (key: PostEventStepKey) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { progress, shown, reviewing, titleId, headingRef, onSelect, onClose, children } = props;
  const { steps, active } = progress;
  const total = steps.length;
  const prevDone = steps.filter((s) => s.state === 'complete' && s.number < shown.number).pop();

  return (
    <>
      <div className="border-b border-border px-5 pb-4 pt-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-anchor">
              {reviewing ? 'Reviewing step' : 'Step'} {shown.number} of {total}
            </p>
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-semibold leading-tight text-foreground outline-none sm:text-2xl">
              {shown.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-anchor"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4">
          <WizardSteps progress={progress} shownKey={shown.key} onSelect={onSelect} />
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
        <p
          className={`inline-flex items-start gap-1.5 text-sm ${
            shown.state === 'attention' && !reviewing ? 'font-medium text-amber' : 'text-muted-foreground'
          }`}
        >
          {shown.state === 'attention' && !reviewing ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
          {reviewing ? 'You finished this step. Here is what you sent.' : shown.helper}
        </p>
        {children}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5 text-sm sm:px-7">
        {reviewing ? (
          <button type="button" onClick={() => onSelect(active.key)} className="font-semibold text-anchor underline underline-offset-2">
            Back to step {active.number}: {active.label}
          </button>
        ) : prevDone ? (
          <button
            type="button"
            onClick={() => onSelect(prevDone.key)}
            className="font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Review step {prevDone.number}: {prevDone.label}
          </button>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock3 className="h-4 w-4" aria-hidden /> Close anytime. Finished steps are saved.
        </span>
      </div>
    </>
  );
}
