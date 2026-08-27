import type { SurveySegmentDimension } from '../../../api/admin';

interface SegmentFilterProps {
  value: SurveySegmentDimension | null;
  onChange: (value: SurveySegmentDimension | null) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: '' | SurveySegmentDimension; label: string }> = [
  { value: '', label: 'No segmentation' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'status', label: 'Registration status' },
  { value: 'attendance', label: 'Attendance' },
];

export function SegmentFilter({ value, onChange, disabled }: SegmentFilterProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
      <span className="font-medium">Segment by</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange((e.target.value || null) as SurveySegmentDimension | null)}
        className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
        aria-label="Segment analytics by"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
