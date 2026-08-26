import type { ZoomWebinarSettings } from '../../api/admin';

export const DEFAULT_ZOOM_WEBINAR_SETTINGS: ZoomWebinarSettings = {
  questionAndAnswer: true,
  backstage: false,
  hdVideoScreenShare: true,
  hdVideo1080p: false,
  emailInAttendeeReport: false,
  autoRecordCloud: true,
};

const ROWS: Array<{
  key: keyof ZoomWebinarSettings;
  label: string;
}> = [
  { key: 'questionAndAnswer', label: 'Q&A' },
  {
    key: 'backstage',
    label: 'Before webinar starts, hosts and panelists can access Backstage',
  },
  { key: 'hdVideoScreenShare', label: 'Enable HD Video for screen shared video' },
  { key: 'hdVideo1080p', label: 'Webinar — HD Video quality (1080P)' },
  {
    key: 'emailInAttendeeReport',
    label: 'Include email address in attendee report',
  },
  { key: 'autoRecordCloud', label: 'Automatically record webinar in the cloud' },
];

function Toggle({
  checked,
  disabled,
  onChange,
  labelledBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function ZoomWebinarSettingsFields({
  value,
  onChange,
  disabled,
  warning,
}: {
  value: ZoomWebinarSettings;
  onChange: (next: ZoomWebinarSettings) => void;
  disabled?: boolean;
  warning?: string | null;
}) {
  return (
    <div className="space-y-3 rounded-card border border-border bg-card px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Zoom webinar settings</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          These options are written to the Zoom webinar. Backstage is where hosts and
          panelists can join before attendees.
        </p>
      </div>
      {warning ? (
        <p className="rounded-[6px] bg-warning/10 px-3 py-2 text-xs text-warning">{warning}</p>
      ) : null}
      <ul className="divide-y divide-gray-100">
        {ROWS.map((row) => {
          const id = `zoom-setting-${row.key}`;
          return (
            <li key={row.key} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <span id={id} className="text-sm text-foreground">
                {row.label}
              </span>
              <Toggle
                checked={value[row.key]}
                disabled={disabled}
                labelledBy={id}
                onChange={(next) => onChange({ ...value, [row.key]: next })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
