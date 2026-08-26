import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Mail, X } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';

export type OperationalEmailRecipient = {
  email: string;
  name: string;
  status?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  programId: string;
  programTitle: string;
  recipients: OperationalEmailRecipient[];
  /** Prefill selected emails when opening from bulk selection */
  initialSelectedEmails?: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export default function OperationalEmailModal({
  open,
  onClose,
  programId,
  programTitle,
  recipients,
  initialSelectedEmails,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [extraEmails, setExtraEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<{
    sent: number;
    failed: { email: string; error: string }[];
    extras: string[];
  } | null>(null);

  const uniqueRecipients = useMemo(() => {
    const map = new Map<string, OperationalEmailRecipient>();
    for (const r of recipients) {
      const email = normalizeEmail(r.email);
      if (!email || map.has(email)) continue;
      map.set(email, { ...r, email });
    }
    return [...map.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [recipients]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setSubject('');
    setBody('');
    setExtraEmails('');
    const prefill = (initialSelectedEmails ?? [])
      .map(normalizeEmail)
      .filter((e) => EMAIL_RE.test(e));
    if (prefill.length > 0) {
      setSelected(new Set(prefill));
    } else {
      setSelected(new Set(uniqueRecipients.map((r) => r.email)));
    }
  }, [open, programId, initialSelectedEmails, uniqueRecipients]);

  const parsedExtras = useMemo(() => {
    const parts = extraEmails
      .split(/[\s,;]+/)
      .map(normalizeEmail)
      .filter(Boolean);
    return [...new Set(parts)].filter((e) => EMAIL_RE.test(e));
  }, [extraEmails]);

  const invalidExtras = useMemo(() => {
    const parts = extraEmails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.filter((p) => !EMAIL_RE.test(normalizeEmail(p)));
  }, [extraEmails]);

  const toList = useMemo(() => {
    return [...new Set([...selected, ...parsedExtras])];
  }, [selected, parsedExtras]);

  const sendMut = useMutation({
    mutationFn: () =>
      adminApi.sendProgramOperationalEmail(programId, {
        to: toList,
        subject: subject.trim(),
        body: body.trim(),
      }),
    onSuccess: (data) => setResult(data),
  });

  if (!open) return null;

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectByStatus = (status?: string) => {
    if (!status) {
      setSelected(new Set(uniqueRecipients.map((r) => r.email)));
      return;
    }
    setSelected(
      new Set(
        uniqueRecipients
          .filter((r) => (r.status || '').toUpperCase() === status.toUpperCase())
          .map((r) => r.email),
      ),
    );
  };

  const canSend =
    toList.length > 0 &&
    toList.length <= 50 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    invalidExtras.length === 0 &&
    !sendMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-card bg-card shadow-card-hover">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
              Email registrants
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Freeform notice for <strong className="font-medium text-foreground">{programTitle}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[6px] p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <label className="block text-sm">
            <span className="font-medium text-muted-foreground">From</span>
            <input
              readOnly
              value="Community Health Media <info@communityhealth.media>"
              className="mt-1 w-full rounded-[6px] border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </label>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">To</span>
              <button
                type="button"
                onClick={() => selectByStatus()}
                className="rounded-[6px] border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                All registrants
              </button>
              <button
                type="button"
                onClick={() => selectByStatus('PENDING')}
                className="rounded-[6px] border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => selectByStatus('APPROVED')}
                className="rounded-[6px] border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-[6px] border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
              <span className="ml-auto text-xs text-muted-foreground">{toList.length} selected (max 50)</span>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-[6px] border border-border divide-y divide-gray-100">
              {uniqueRecipients.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">No registrations on this program yet.</p>
              ) : (
                uniqueRecipients.map((r) => (
                  <label
                    key={r.email}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={selected.has(r.email)}
                      onChange={() => toggle(r.email)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{r.name || r.email}</span>
                      <span className="block text-xs text-muted-foreground truncate">{r.email}</span>
                    </span>
                    {r.status ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {r.status}
                      </span>
                    ) : null}
                  </label>
                ))
              )}
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-muted-foreground">Additional emails (optional)</span>
              <textarea
                value={extraEmails}
                onChange={(e) => setExtraEmails(e.target.value)}
                rows={2}
                placeholder="Paste emails separated by commas or newlines"
                className="mt-1 w-full rounded-[6px] border border-border px-3 py-2 text-sm"
              />
              {invalidExtras.length > 0 ? (
                <span className="mt-1 block text-xs text-destructive">
                  Invalid: {invalidExtras.join(', ')}
                </span>
              ) : null}
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-muted-foreground">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-[6px] border border-border px-3 py-2 text-sm"
              placeholder="Session update"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-muted-foreground">Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={10_000}
              className="mt-1 w-full rounded-[6px] border border-border px-3 py-2 text-sm font-mono"
              placeholder="Write your message (plain text)…"
            />
          </label>

          {sendMut.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(sendMut.error, 'Failed to send email.')}
            </p>
          ) : null}

          {result ? (
            <div className="rounded-[6px] border border-success/25 bg-success/10 px-4 py-3 text-sm text-green-900">
              Sent {result.sent} email{result.sent === 1 ? '' : 's'}
              {result.failed.length > 0
                ? `; ${result.failed.length} failed (${result.failed.map((f) => f.email).join(', ')})`
                : ''}
              {result.extras.length > 0
                ? `. Extra (not on registration list): ${result.extras.join(', ')}`
                : ''}
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result ? (
            <button
              type="button"
              disabled={!canSend}
              onClick={() => sendMut.mutate()}
              className="inline-flex items-center gap-2 rounded-[6px] bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {sendMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Mail className="h-4 w-4" aria-hidden />
              )}
              Send
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
