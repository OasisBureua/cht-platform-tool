import { useState } from 'react';
import type { Survey } from '../../../api/surveys';
import { NativeSurveyForm } from '../../surveys/NativeSurveyForm';
import { surveyHasNativeQuestions } from '../../../utils/survey-questions';
import { SurveyDeviceFrame, type SurveyDeviceMode } from './SurveyDeviceFrame';

/**
 * SCRUM-291 Chunk 5: participant preview in desktop / mobile chrome.
 * Uses the same NativeSurveyForm learners see; never persists drafts or submits.
 */
export function SurveyStudioPreview({ survey }: { survey: Survey }) {
  const [device, setDevice] = useState<SurveyDeviceMode>('desktop');
  const hasNative = surveyHasNativeQuestions(survey.questions);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Participant preview</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Same form learners get on desktop and phone. Nothing is saved from this tab.
          </p>
        </div>
        <div
          className="inline-flex self-start rounded-[8px] bg-muted p-1"
          role="group"
          aria-label="Preview device width"
        >
          {(['desktop', 'mobile'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDevice(mode)}
              aria-pressed={device === mode}
              className={[
                'rounded-[6px] px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'motion-safe:active:scale-[0.98]',
                device === mode
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {!hasNative ? (
        <div className="rounded-card border border-amber-200/80 bg-amber-50/80 px-4 py-5 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">No native preview for this survey</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/80">
            {survey.jotformFormId
              ? `This survey is still linked to Jotform (${survey.jotformFormId}). Analytics and the participant preview require a native question schema.`
              : 'This survey has no native question schema yet, so there is nothing to preview here.'}
          </p>
        </div>
      ) : (
        <SurveyDeviceFrame mode={device}>
          <div className="space-y-4">
            <div className="rounded-[6px] border border-brand-200 bg-brand-50/80 px-3 py-2 text-xs font-semibold text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100">
              Preview only — no response saved
            </div>
            {survey.description ? (
              <p className="text-sm text-muted-foreground">{survey.description}</p>
            ) : null}
            <NativeSurveyForm
              key={`${survey.id}-${device}`}
              surveyId={`preview:${survey.id}`}
              title={survey.title}
              questions={survey.questions}
              authenticated
              userSummary={{
                firstName: 'Preview',
                lastName: 'Admin',
                email: 'preview@example.com',
              }}
              previewMode
              showPayoutNotice={survey.type === 'FEEDBACK'}
            />
          </div>
        </SurveyDeviceFrame>
      )}
    </div>
  );
}
