import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ChevronLeft, Download, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function AdminProgramHub() {
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotLabel, setSlotLabel] = useState('');
  const [formKind, setFormKind] = useState<'INTAKE' | 'PRE_EVENT' | 'POST_EVENT' | 'CUSTOM'>('CUSTOM');
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [webinarHubTab, setWebinarHubTab] = useState<'approvals' | 'enrolled'>('approvals');

  const { data: program, isLoading: pLoading } = useQuery({
    queryKey: ['admin', 'program', programId],
    queryFn: () => adminApi.getProgram(programId!),
    enabled: !!programId,
  });

  const zoomTypeForQueries = program
    ? String((program as Record<string, unknown>).zoomSessionType || 'WEBINAR')
    : null;

  const { data: registrations = [], isLoading: rLoading } = useQuery({
    queryKey: ['admin', 'program', programId, 'registrations'],
    queryFn: () => adminApi.listProgramRegistrations(programId!),
    enabled: !!programId && !!program,
  });

  const { data: enrollments = [], isLoading: eLoading } = useQuery({
    queryKey: ['admin', 'program', programId, 'enrollments'],
    queryFn: () => adminApi.listProgramEnrollments(programId!),
    enabled: !!programId && !!program,
  });

  const { data: formLinks = [], isLoading: fLoading } = useQuery({
    queryKey: ['admin', 'program', programId, 'form-links'],
    queryFn: () => adminApi.listProgramFormLinks(programId!),
    enabled: !!programId,
  });

  const [intakeUrl, setIntakeUrl] = useState('');
  const [hostName, setHostName] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ ok?: boolean; err?: string }>({});

  useEffect(() => {
    if (!program) return;
    const pr = program as Record<string, unknown>;
    const zt = String(pr.zoomSessionType || 'WEBINAR');
    setIntakeUrl(zt === 'MEETING' ? '' : String(pr.jotformIntakeFormUrl ?? ''));
    setHostName(String(pr.hostDisplayName ?? ''));
    setRequireApproval(Boolean(pr.registrationRequiresApproval));
  }, [program]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      adminApi.patchProgramRegistrationSettings(programId!, {
        jotformIntakeFormUrl:
          zoomTypeForQueries === 'MEETING' ? null : intakeUrl.trim() || null,
        hostDisplayName: hostName.trim() || null,
        registrationRequiresApproval: requireApproval,
      }),
    onSuccess: () => {
      setSettingsMessage({ ok: true });
      window.setTimeout(() => setSettingsMessage({}), 4000);
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { message?: string | string[] } } };
      const m = ax.response?.data?.message;
      const msg = Array.isArray(m) ? m.join('; ') : m;
      setSettingsMessage({
        err: msg || (err instanceof Error ? err.message : 'Could not save settings.'),
      });
    },
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'WAITLISTED' }) =>
      adminApi.updateProgramRegistration(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    },
  });

  const removeEnrollmentMut = useMutation({
    mutationFn: ({ enrollmentId }: { enrollmentId: string }) =>
      adminApi.removeProgramEnrollment(programId!, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    },
  });

  const slotMut = useMutation({
    mutationFn: () =>
      adminApi.createOfficeHoursSlot(programId!, {
        startsAt: new Date(slotStart).toISOString(),
        endsAt: new Date(slotEnd).toISOString(),
        label: slotLabel || undefined,
      }),
    onSuccess: () => {
      setSlotStart('');
      setSlotEnd('');
      setSlotLabel('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
    },
  });

  const deleteSlotMut = useMutation({
    mutationFn: (slotId: string) => adminApi.deleteOfficeHoursSlot(programId!, slotId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] }),
  });

  const addLinkMut = useMutation({
    mutationFn: () => adminApi.addProgramFormLink(programId!, { kind: formKind, label: formLabel, jotformUrl: formUrl }),
    onSuccess: () => {
      setFormLabel('');
      setFormUrl('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'form-links'] });
    },
  });

  const deleteLinkMut = useMutation({
    mutationFn: (linkId: string) => adminApi.deleteProgramFormLink(linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'form-links'] }),
  });

  const downloadIcs = async (registrationId: string) => {
    const blob = await adminApi.downloadRegistrationIcsBlob(registrationId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invite.ics';
    a.click();
    URL.revokeObjectURL(url);
    await adminApi.markRegistrationCalendarSent(registrationId);
    queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
  };

  if (!programId) return null;
  if (pLoading || !program) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const p = program as Record<string, unknown>;
  const title = String(p.title ?? 'Program');
  const zoomType = (p.zoomSessionType as string) || 'WEBINAR';
  const slots =
    (p.officeHoursSlots as Array<{ id: string; startsAt: Date | string; endsAt: Date | string; label: string | null }>) ||
    [];

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-16">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={zoomType === 'MEETING' ? '/admin/office-hours' : '/admin/programs'}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to list
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Program hub: webinar intake Jotform (LIVE only), office-hours slots, registration queue, enrollments, extra form
          links, and calendar invites. Post-event surveys are FEEDBACK-type surveys (learners complete them on the Surveys
          tab after the session).
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Enrollments: {String((p._count as { enrollments?: number })?.enrollments ?? '-')} · Registrations:{' '}
          {String((p._count as { programRegistrations?: number })?.programRegistrations ?? '-')}
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Registration & forms</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {zoomType === 'MEETING' ? (
            <div className="md:col-span-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <strong>CHM Office Hours</strong> do not use a Jotform intake form. Learners register and pick a time slot
              when you offer slots; use <strong>Require admin approval</strong> below to review each request before they are
              enrolled. Saving settings clears any stored intake URL for this office-hours program.
            </div>
          ) : (
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-gray-700">Jotform intake URL (LIVE webinars only)</span>
              <input
                value={intakeUrl}
                onChange={(e) => setIntakeUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="https://form.jotform.com/..."
              />
              <span className="mt-1 block text-xs text-gray-500">
                Pre-event forms are deprecated — use this intake for registration; use a FEEDBACK survey for post-event. In
                Jotform, set the thank-you redirect to this app&apos;s registration URL for this program (…/register) and
                append the submission id (merge tag), e.g. …/register?submissionID={'{submission_id}'} — learners need that
                id on file to finish signing up. Add hidden fields <strong>user_id</strong> and <strong>program_id</strong>{' '}
                (the app pre-fills them when the form opens). Point the Jotform form webhook to your API{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">POST /api/webhooks/jotform</code> so submissions are
                recorded even if the learner does not land on the thank-you URL.
              </span>
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Host display name</span>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Dr. Jane Smith"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-800">
          <span className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
            />
            Require admin approval before enrollment
          </span>
          <span className="text-xs font-normal text-gray-600 pl-6">
            {zoomType === 'WEBINAR'
              ? 'Learners complete registration (and intake Jotform when configured); after you approve, they are enrolled and the in-app Zoom join appears on the webinar page. Rejected learners may register again (their row goes back to pending when they resubmit).'
              : 'No Jotform intake for office hours. Learners submit registration (and a time slot when configured). With approval on, you review each request before they are enrolled. Rejected learners may register again (pending on resubmit).'}
          </span>
        </label>
        {settingsMessage.ok && (
          <p className="text-sm font-medium text-green-700" role="status">
            Settings saved.
          </p>
        )}
        {settingsMessage.err && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
            {settingsMessage.err}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setSettingsMessage({});
            settingsMutation.mutate();
          }}
          disabled={settingsMutation.isPending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {settingsMutation.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </section>

      {zoomType === 'MEETING' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Office hours time slots</h2>
          <p className="text-sm text-gray-600">
            Add bookable start times for the same Zoom meeting (Calendly-style list: e.g. 12:00pm, 12:30pm, 1:00pm).
            Each slot is a window inside your office hours; learners still join via the program Zoom link after they
            register.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <span className="text-gray-700 font-medium">Start</span>
              <input
                type="datetime-local"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-700 font-medium">End</span>
              <input
                type="datetime-local"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-700 font-medium">Label (optional)</span>
              <input
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => slotMut.mutate()}
              disabled={!slotStart || !slotEnd || slotMut.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {slotMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add slot
            </button>
          </div>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {slots.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {format(typeof s.startsAt === 'string' ? parseISO(s.startsAt) : new Date(s.startsAt), 'MMM d, h:mm a')}{' '}
                  –{' '}
                  {format(typeof s.endsAt === 'string' ? parseISO(s.endsAt) : new Date(s.endsAt), 'h:mm a')}
                  {s.label ? ` · ${s.label}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSlotMut.mutate(s.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  aria-label="Delete slot"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {slots.length === 0 && <li className="px-4 py-6 text-sm text-gray-500">No slots yet.</li>}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Self-serve form links</h2>
        <p className="text-sm text-gray-600">Additional Jotform URLs stored as their own rows (workflows, one-offs).</p>
        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={formKind}
            onChange={(e) => setFormKind(e.target.value as typeof formKind)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="INTAKE">Intake</option>
            <option value="PRE_EVENT">Pre-event</option>
            <option value="POST_EVENT">Post-event</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <input
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            placeholder="Label"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="Jotform URL"
            className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => addLinkMut.mutate()}
            disabled={!formLabel.trim() || !formUrl.trim() || addLinkMut.isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {fLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {formLinks.map((fl) => (
              <li key={fl.id} className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
                <span>
                  <span className="font-semibold">{fl.label}</span>{' '}
                  <span className="text-gray-500">({fl.kind})</span>
                </span>
                <button type="button" onClick={() => deleteLinkMut.mutate(fl.id)} className="text-red-600 text-xs font-semibold">
                  Remove
                </button>
              </li>
            ))}
            {formLinks.length === 0 && <li className="text-sm text-gray-500">No extra links.</li>}
          </ul>
        )}
      </section>

      {zoomType === 'WEBINAR' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
            <button
              type="button"
              onClick={() => setWebinarHubTab('approvals')}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                webinarHubTab === 'approvals' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              Webinar approvals
            </button>
            <button
              type="button"
              onClick={() => setWebinarHubTab('enrolled')}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                webinarHubTab === 'enrolled' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              Who is enrolled
            </button>
          </div>
          {webinarHubTab === 'approvals' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Pending &amp; history</h2>
              {rLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Intake</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {registrations.map((r) => {
                        const intakeRequired = r.intakeRequired ?? false;
                        const intakeOk = r.intakeComplete ?? false;
                        return (
                          <tr key={r.id}>
                            <td className="py-2 pr-4">
                              {r.user.firstName} {r.user.lastName}
                              <div className="text-xs text-gray-500">{r.user.email}</div>
                            </td>
                            <td className="py-2 pr-4 font-medium">{r.status}</td>
                          <td className="py-2 pr-4 text-gray-600">
                            <div className="space-y-1">
                              <span>{!intakeRequired ? '—' : intakeOk ? 'Recorded' : 'Missing'}</span>
                              {r.jotformIntakeSubmissionViewUrl ? (
                                <a
                                  href={r.jotformIntakeSubmissionViewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                                >
                                  View in Jotform <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-2">
                              {r.status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={approveMut.isPending}
                                    onClick={() => approveMut.mutate({ id: r.id, status: 'APPROVED' })}
                                    className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => approveMut.mutate({ id: r.id, status: 'REJECTED' })}
                                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {r.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  onClick={() => void downloadIcs(r.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                                >
                                  <Download className="h-3 w-3" /> ICS invite
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {registrations.length === 0 && <p className="text-sm text-gray-500 py-4">No registrations yet.</p>}
              </div>
            )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Who is enrolled</h2>
              <p className="text-sm text-gray-600">
                Remove a learner to revoke in-app access. Their registration is marked rejected so they can request
                access again if needed.
              </p>
              {eLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Enrolled</th>
                        <th className="py-2 pr-4">Progress</th>
                        <th className="py-2 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {enrollments.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2 pr-4">
                            {row.user.firstName} {row.user.lastName}
                            <div className="text-xs text-gray-500">{row.user.email}</div>
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {format(
                              typeof row.enrolledAt === 'string'
                                ? parseISO(row.enrolledAt)
                                : new Date(row.enrolledAt),
                              'MMM d, yyyy h:mm a',
                            )}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {Math.round(row.overallProgress)}%{row.completed ? ' · done' : ''}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <button
                              type="button"
                              disabled={removeEnrollmentMut.isPending}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Remove ${row.user.firstName} ${row.user.lastName} from this program? They will lose in-app access and may register again.`,
                                  )
                                ) {
                                  return;
                                }
                                removeEnrollmentMut.mutate({ enrollmentId: row.id });
                              }}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Remove enrollment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {enrollments.length === 0 && <p className="text-sm text-gray-500 py-4">No enrollments yet.</p>}
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Registration queue</h2>
            {rLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Slot</th>
                      <th className="py-2 pr-4">Intake</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {registrations.map((r) => {
                      const intakeRequired = r.intakeRequired ?? false;
                      const intakeOk = r.intakeComplete ?? false;
                      return (
                        <tr key={r.id}>
                          <td className="py-2 pr-4">
                            {r.user.firstName} {r.user.lastName}
                            <div className="text-xs text-gray-500">{r.user.email}</div>
                          </td>
                          <td className="py-2 pr-4 font-medium">{r.status}</td>
                          <td className="py-2 pr-4 text-gray-600">
                            {r.slot
                              ? format(
                                  typeof r.slot.startsAt === 'string'
                                    ? parseISO(r.slot.startsAt)
                                    : new Date(r.slot.startsAt),
                                  'MMM d h:mm a',
                                )
                              : '-'}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            <div className="space-y-1">
                              <span>{!intakeRequired ? '—' : intakeOk ? 'Recorded' : 'Missing'}</span>
                              {r.jotformIntakeSubmissionViewUrl ? (
                                <a
                                  href={r.jotformIntakeSubmissionViewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                                >
                                  View in Jotform <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-2">
                              {r.status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={approveMut.isPending}
                                    onClick={() => approveMut.mutate({ id: r.id, status: 'APPROVED' })}
                                    className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => approveMut.mutate({ id: r.id, status: 'REJECTED' })}
                                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {r.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  onClick={() => void downloadIcs(r.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                                >
                                  <Download className="h-3 w-3" /> ICS invite
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {registrations.length === 0 && <p className="text-sm text-gray-500 py-4">No registrations yet.</p>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Who is enrolled</h2>
            <p className="text-sm text-gray-600">
              Remove a learner to revoke in-app access. Their registration is marked rejected so they can request access
              again if needed.
            </p>
            {eLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Enrolled</th>
                      <th className="py-2 pr-4">Progress</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {enrollments.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-4">
                          {row.user.firstName} {row.user.lastName}
                          <div className="text-xs text-gray-500">{row.user.email}</div>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {format(
                            typeof row.enrolledAt === 'string'
                              ? parseISO(row.enrolledAt)
                              : new Date(row.enrolledAt),
                            'MMM d, yyyy h:mm a',
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {Math.round(row.overallProgress)}%{row.completed ? ' · done' : ''}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <button
                            type="button"
                            disabled={removeEnrollmentMut.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Remove ${row.user.firstName} ${row.user.lastName} from this program? They will lose in-app access and may register again.`,
                                )
                              ) {
                                return;
                              }
                              removeEnrollmentMut.mutate({ enrollmentId: row.id });
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Remove enrollment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {enrollments.length === 0 && <p className="text-sm text-gray-500 py-4">No enrollments yet.</p>}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
