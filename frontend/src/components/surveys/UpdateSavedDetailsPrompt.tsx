import { PROFILE_FIELD_LABELS } from '../../utils/survey-field-autocomplete';

type Props = {
  updates: Record<string, string>;
  saving?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onSkip: () => void;
};

/**
 * Post-submit opt-in: update CHT profile from registration/survey answers.
 * Never shown unless values actually differ from the saved profile.
 */
export function UpdateSavedDetailsPrompt({
  updates,
  saving,
  error,
  onConfirm,
  onSkip,
}: Props) {
  const entries = Object.entries(updates);
  if (entries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-saved-details-title"
        className="w-full max-w-md space-y-4 rounded-card bg-card p-6 shadow-card-hover"
      >
        <div className="space-y-1">
          <h3
            id="update-saved-details-title"
            className="text-lg font-semibold text-foreground"
          >
            Update my saved details?
          </h3>
          <p className="text-sm text-muted-foreground">
            You changed some values on this form. Save them to your profile for
            next time? This only updates your account — never other users or
            events.
          </p>
        </div>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-[6px] border border-border bg-muted px-3 py-2 text-sm">
          {entries.map(([field, value]) => (
            <li key={field} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
              <span className="font-medium text-foreground">
                {PROFILE_FIELD_LABELS[field] ?? field}
              </span>
              <span className="break-all text-muted-foreground">{value}</span>
            </li>
          ))}
        </ul>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-[6px] border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-[6px] bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update my saved details'}
          </button>
        </div>
      </div>
    </div>
  );
}
