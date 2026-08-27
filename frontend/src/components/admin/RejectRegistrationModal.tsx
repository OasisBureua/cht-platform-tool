import { useEffect, useState } from 'react';

export type RejectEmailReason = 'GENERIC' | 'INCOMPLETE_INTAKE';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (o: { rejectEmailReason: RejectEmailReason; adminNotes: string }) => void;
  isSubmitting?: boolean;
  /** Number of registration rows this reject applies to. */
  count: number;
};

export default function RejectRegistrationModal({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
  count,
}: Props) {
  const [reason, setReason] = useState<RejectEmailReason>('GENERIC');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (open) {
      setReason('GENERIC');
      setAdminNotes('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const title = count === 1 ? 'Reject registration' : `Reject ${count} registrations`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
    >
      <div className="w-full max-w-md rounded-card border border-border bg-card p-5 shadow-lg">
        <h2 id="reject-modal-title" className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The learner will receive an email. Choose the type of message, and add an optional note (shown in the email).
        </p>

        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Rejection email type</legend>
          <label className="flex cursor-pointer gap-2 rounded-[6px] border border-border p-3 has-[:checked]:border-gray-400 has-[:checked]:bg-muted">
            <input
              type="radio"
              name="reject-reason"
              className="mt-0.5"
              checked={reason === 'GENERIC'}
              onChange={() => setReason('GENERIC')}
            />
            <span className="text-sm text-foreground">
              <span className="font-semibold">Not approved (general)</span>
              <span className="block text-muted-foreground">
                Standard message about not approving this time (capacity, eligibility, or review).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-2 rounded-[6px] border border-border p-3 has-[:checked]:border-gray-400 has-[:checked]:bg-muted">
            <input
              type="radio"
              name="reject-reason"
              className="mt-0.5"
              checked={reason === 'INCOMPLETE_INTAKE'}
              onChange={() => setReason('INCOMPLETE_INTAKE')}
            />
            <span className="text-sm text-foreground">
              <span className="font-semibold">Incomplete registration or survey</span>
              <span className="block text-muted-foreground">
                Tells them to re-register and complete all required questions and forms.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="reject-admin-notes" className="text-xs font-semibold text-muted-foreground">
            Optional note to learner
          </label>
          <textarea
            id="reject-admin-notes"
            rows={3}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            maxLength={2000}
            className="mt-1 w-full rounded-[6px] border border-border px-3 py-2 text-sm"
            placeholder="e.g. Please complete the intake Jotform in full before resubmitting."
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[6px] border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ rejectEmailReason: reason, adminNotes: adminNotes.trim() })}
            disabled={isSubmitting}
            className="rounded-[6px] bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {isSubmitting ? 'Sending…' : 'Confirm reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
