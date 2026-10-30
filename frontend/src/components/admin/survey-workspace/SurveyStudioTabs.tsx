import { SegmentedControl, type Segment } from '../../ui/SegmentedControl';
import { cn } from '../../../lib/cn';

/** Detail-studio tab ids for SCRUM-291 shell (wired in Chunk 4). */
export type SurveyStudioTab =
  | 'overview'
  | 'questions'
  | 'responses'
  | 'results'
  | 'preview'
  | 'settings';

export const SURVEY_STUDIO_SEGMENTS: Segment<SurveyStudioTab>[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'questions', label: 'Questions' },
  { value: 'responses', label: 'Responses' },
  { value: 'results', label: 'Results' },
  { value: 'preview', label: 'Preview' },
  { value: 'settings', label: 'Settings' },
];

export function surveyStudioPanelId(tab: SurveyStudioTab): string {
  return `survey-studio-panel-${tab}`;
}

export function SurveyStudioTabs({
  value,
  onChange,
  className,
}: {
  value: SurveyStudioTab;
  onChange: (next: SurveyStudioTab) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        '-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <SegmentedControl
        label="Survey detail sections"
        segments={SURVEY_STUDIO_SEGMENTS}
        value={value}
        onChange={onChange}
        panelId={surveyStudioPanelId}
        className="min-w-max"
      />
    </div>
  );
}
