import { Link } from 'react-router-dom';
import { ArrowRight, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import type { PostEventProgressItem } from '../../api/programs';
import {
  derivePostEventProgress,
  postEventFactsFromProgressItem,
  postEventProgramPath,
  type PostEventStep,
} from '../../utils/post-event-steps';
import { PostEventStepMap } from '../programs/PostEventStepMap';

function ctaLabel(step: PostEventStep): string {
  switch (step.key) {
    case 'attend':
      return 'View session';
    case 'survey':
      return 'Continue to survey';
    case 'payment':
      return step.state === 'attention' ? 'Finish payment setup' : 'Confirm payment info';
    default:
      return 'View payment status';
  }
}

/**
 * Dashboard card for a session with an unpaid honorarium (SCRUM-288): the same step map as the
 * program page, with done steps linking to their review and one button to the step in progress.
 */
export function PostEventProgressCard({ item }: { item: PostEventProgressItem }) {
  const progress = derivePostEventProgress(postEventFactsFromProgressItem(item));
  const path = postEventProgramPath(item.programId, item.zoomSessionType);
  const when = item.startDate ? format(new Date(item.startDate), 'MMM d, yyyy') : null;
  const headingId = `post-event-card-${item.programId}`;

  return (
    <section className="card space-y-4 p-5 sm:p-6" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow inline-flex items-center gap-2 text-muted2">
            <Banknote className="h-3.5 w-3.5 shrink-0 text-anchor" aria-hidden />
            Honorarium steps
          </p>
          <h3 id={headingId} className="display mt-1 text-body-l text-text">
            {item.title}
          </h3>
          {when ? <p className="meta mt-0.5 text-dim">Session on {when}</p> : null}
        </div>
      </div>

      <PostEventStepMap
        steps={progress.steps}
        active={progress.active}
        stepHref={(key) => `${path}?step=${key}`}
        label={`Post-event progress for ${item.title}`}
      />

      <div className="flex justify-end">
        <Link
          to={`${path}?step=${progress.active.key}`}
          className="press inline-flex min-h-[40px] items-center gap-2 rounded-[6px] bg-cta px-4 text-body-s font-medium text-ground shadow-card hover:bg-cta-deep"
        >
          {ctaLabel(progress.active)}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
