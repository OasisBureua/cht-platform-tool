import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Loader2, Mail, RotateCcw, Send, Eye } from 'lucide-react';
import {
  adminApi,
  type ProgramEmailCopy,
  type ProgramEmailKind,
  type ProgramEmailOverrideRow,
} from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import { Button } from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY_COPY: ProgramEmailCopy = {
  subject: '',
  greeting: '',
  body: '',
  signOff: '',
};

export function ProgramEmailsPanel({ programId }: { programId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedKind, setSelectedKind] = useState<ProgramEmailKind | null>(null);
  const [draft, setDraft] = useState<ProgramEmailCopy>(EMPTY_COPY);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'program', programId, 'email-overrides'],
    queryFn: () => adminApi.listProgramEmailOverrides(programId),
  });

  const selected: ProgramEmailOverrideRow | null = useMemo(() => {
    if (!data || !selectedKind) return null;
    return data.emails.find((e) => e.kind === selectedKind) ?? null;
  }, [data, selectedKind]);

  useEffect(() => {
    if (!data?.emails.length) return;
    if (!selectedKind) {
      setSelectedKind(data.emails[0].kind);
      return;
    }
    const row = data.emails.find((e) => e.kind === selectedKind);
    if (row) setDraft(row.copy);
  }, [data, selectedKind]);

  const { data: versions } = useQuery({
    queryKey: ['admin', 'program', programId, 'email-overrides', selectedKind, 'versions'],
    queryFn: () =>
      adminApi.listProgramEmailOverrideVersions(programId, selectedKind!),
    enabled: !!selectedKind && !!selected?.isCustom,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      adminApi.saveProgramEmailOverride(programId, selectedKind!, draft),
    onSuccess: () => {
      setStatusMsg('Saved. Future sends of this email will use your copy.');
      setErrorMsg(null);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'program', programId, 'email-overrides'],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
    },
    onError: (err) => {
      setErrorMsg(getApiErrorMessage(err, 'Could not save email override.'));
      setStatusMsg(null);
    },
  });

  const resetMut = useMutation({
    mutationFn: () =>
      adminApi.resetProgramEmailOverride(programId, selectedKind!),
    onSuccess: (res) => {
      setDraft(res.copy);
      setStatusMsg('Reset to platform default.');
      setErrorMsg(null);
      setPreviewHtml(null);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'program', programId, 'email-overrides'],
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
    },
    onError: (err) => {
      setErrorMsg(getApiErrorMessage(err, 'Could not reset email.'));
    },
  });

  const previewMut = useMutation({
    mutationFn: () =>
      adminApi.previewProgramEmailOverride(programId, selectedKind!, draft),
    onSuccess: (res) => {
      setPreviewHtml(res.html);
      setStatusMsg(`Preview: ${res.subject}`);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(getApiErrorMessage(err, 'Could not preview email.'));
    },
  });

  const testMut = useMutation({
    mutationFn: () =>
      adminApi.testSendProgramEmailOverride(programId, selectedKind!, {
        ...draft,
        toEmail: user?.email,
      }),
    onSuccess: (res) => {
      setStatusMsg(`Test sent to ${res.to}`);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(getApiErrorMessage(err, 'Could not send test email.'));
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Could not load email customization for this event.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Participant emails
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize subject, greeting, body, and sign-off per event. Legal footer,
          support contact, and required links (join / survey / session) stay locked.
          Changes apply to emails not yet sent. Sender branding is unchanged.
        </p>
        {data.hasCustomEmails ? (
          <span className="mt-2 inline-flex rounded-[6px] bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            Custom emails active
          </span>
        ) : (
          <span className="mt-2 inline-flex rounded-[6px] bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Using platform defaults
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <ul className="space-y-1">
          {data.emails.map((email) => {
            const active = email.kind === selectedKind;
            return (
              <li key={email.kind}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKind(email.kind);
                    setPreviewHtml(null);
                    setStatusMsg(null);
                    setErrorMsg(null);
                  }}
                  className={[
                    'w-full rounded-[6px] px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-gray-900 text-white'
                      : 'bg-muted/60 text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  <span className="font-medium">{email.label}</span>
                  {email.isCustom ? (
                    <span
                      className={[
                        'ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900',
                      ].join(' ')}
                    >
                      Custom
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <div className="space-y-4 rounded-card border border-border bg-card p-4">
            <div>
              <h3 className="font-semibold text-foreground">{selected.label}</h3>
              <p className="text-xs text-muted-foreground">{selected.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Allowed tokens:{' '}
                <code className="text-[11px]">
                  {'{{firstName}} {{eventTitle}} {{eventDate}} {{eventTime}} {{joinLink}} {{surveyLink}} {{sessionLink}} {{supportEmail}} {{sponsorName}} {{honorariumAmount}}'}
                </code>
              </p>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Subject</span>
              <input
                className="w-full rounded-[6px] border border-border px-3 py-2"
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Greeting</span>
              <input
                className="w-full rounded-[6px] border border-border px-3 py-2"
                value={draft.greeting}
                onChange={(e) => setDraft((d) => ({ ...d, greeting: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Body</span>
              <textarea
                className="w-full rounded-[6px] border border-border px-3 py-2"
                rows={8}
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Sign-off</span>
              <textarea
                className="w-full rounded-[6px] border border-border px-3 py-2"
                rows={3}
                value={draft.signOff}
                onChange={(e) => setDraft((d) => ({ ...d, signOff: e.target.value }))}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => previewMut.mutate()}
                disabled={previewMut.isPending}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending || !user?.email}
              >
                <Send className="h-4 w-4" />
                Send test to me
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      'Reset this email to the platform default? Your custom copy will be cleared (history is kept).',
                    )
                  ) {
                    resetMut.mutate();
                  }
                }}
                disabled={resetMut.isPending || !selected.isCustom}
              >
                <RotateCcw className="h-4 w-4" />
                Reset to default
              </Button>
            </div>

            {statusMsg ? (
              <p className="text-sm text-success" role="status">
                {statusMsg}
              </p>
            ) : null}
            {errorMsg ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMsg}
              </p>
            ) : null}

            {previewHtml ? (
              <div className="overflow-hidden rounded-[6px] border border-border">
                <p className="border-b border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Preview (sample merge data)
                </p>
                <iframe
                  title="Email preview"
                  className="h-[420px] w-full bg-white"
                  srcDoc={previewHtml}
                />
              </div>
            ) : null}

            {versions?.versions?.length ? (
              <div>
                <h4 className="text-sm font-semibold text-foreground">Version history</h4>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {versions.versions.map((v) => (
                    <li key={v.id} className="rounded border border-border px-2 py-1.5">
                      {format(parseISO(v.editedAt), 'MMM d, yyyy · h:mm a')}
                      {v.editedByUserId
                        ? ` · editor ${v.editedByUserId.slice(0, 8)}…`
                        : ''}
                      <div className="truncate text-foreground">{v.subject}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
