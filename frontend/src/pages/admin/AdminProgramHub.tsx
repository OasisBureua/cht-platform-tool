import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import RejectRegistrationModal, { type RejectEmailReason } from '../../components/admin/RejectRegistrationModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Check, ChevronLeft, Copy, Download, ExternalLink, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
  const [webinarHubTab, setWebinarHubTab] = useState<'approvals' | 'enrolled' | 'surveys'>('approvals');

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
    mutationFn: ({ id }: { id: string }) => adminApi.updateProgramRegistration(id, { status: 'APPROVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: async (o: { ids: string[]; rejectEmailReason: RejectEmailReason; adminNotes: string }) => {
      await Promise.all(
        o.ids.map((id) =>
          adminApi.updateProgramRegistration(id, {
            status: 'REJECTED',
            rejectEmailReason: o.rejectEmailReason,
            adminNotes: o.adminNotes.trim() || null,
          }),
        ),
      );
    },
    onSuccess: (_d, o) => {
      setRejectModalIds(null);
      setSelectedPendingIds((prev) => {
        const next = new Set(prev);
        for (const id of o.ids) next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    },
  });

  const pendingRegs = useMemo(
    () => registrations.filter((r) => r.status === 'PENDING'),
    [registrations],
  );
  const pendingRegIds = useMemo(() => pendingRegs.map((r) => r.id), [pendingRegs]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(() => new Set());
  const [rejectModalIds, setRejectModalIds] = useState<string[] | null>(null);

  useEffect(() => {
    const allow = new Set(pendingRegIds);
    setSelectedPendingIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (allow.has(id)) next.add(id);
      }
      return next;
    });
  }, [pendingRegIds]);

  const allPendingSelected =
    pendingRegIds.length > 0 && pendingRegIds.every((id) => selectedPendingIds.has(id));
  const somePendingSelected =
    pendingRegIds.some((id) => selectedPendingIds.has(id)) && !allPendingSelected;

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedPendingIds(new Set());
    } else {
      setSelectedPendingIds(new Set(pendingRegIds));
    }
  };

  const toggleSelectPending = (id: string) => {
    setSelectedPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkApproveMut = useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      await Promise.all(ids.map((id) => adminApi.updateProgramRegistration(id, { status: 'APPROVED' })));
    },
    onSuccess: (_data, vars) => {
      setSelectedPendingIds((prev) => {
        const next = new Set(prev);
        for (const id of vars.ids) next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinar-registrations', 'pending'] });
    },
  });

  const approvalBusy = approveMut.isPending || rejectMut.isPending || bulkApproveMut.isPending;
  const selectedPendingList = pendingRegIds.filter((id) => selectedPendingIds.has(id));

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

  const attendanceMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'DENIED' }) =>
      adminApi.updatePostEventAttendance(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
    },
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
      <RejectRegistrationModal
        open={rejectModalIds != null}
        onClose={() => {
          if (!rejectMut.isPending) setRejectModalIds(null);
        }}
        onConfirm={(o) => rejectMut.mutate({ ids: rejectModalIds ?? [], ...o })}
        isSubmitting={rejectMut.isPending}
        count={rejectModalIds?.length ?? 0}
      />
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
          Program hub: webinar intake Jotform (Live only), office-hours slots, registration queue, enrollments, extra
          form links, and calendar invites. Post-event surveys are FEEDBACK-type surveys (learners complete them on the
          Surveys tab after the session).
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
              <span className="font-medium text-gray-700">Jotform intake URL (Live webinars only)</span>
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
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {settingsMutation.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </section>

      <ZoomLinksSection program={program} programId={programId} />

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
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
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
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
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
              onClick={() => setWebinarHubTab('surveys')}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                webinarHubTab === 'surveys' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              Survey submissions
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
                <>
                  {pendingRegs.length > 0 ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <span className="text-xs text-gray-700">
                        {selectedPendingIds.size === 0
                          ? 'Select pending rows or use the header checkbox.'
                          : `${selectedPendingIds.size} pending selected`}
                      </span>
                      <div className="ml-auto flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={approvalBusy || selectedPendingList.length === 0}
                          onClick={() => bulkApproveMut.mutate({ ids: selectedPendingList })}
                          className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          Approve selected
                        </button>
                        <button
                          type="button"
                          disabled={approvalBusy || selectedPendingList.length === 0}
                          onClick={() => setRejectModalIds([...selectedPendingList])}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 disabled:opacity-40"
                        >
                          Reject selected
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {bulkApproveMut.isError || rejectMut.isError ? (
                    <p className="mb-2 text-xs text-red-600">
                      Update failed partway through. Refresh and try again or use row actions.
                    </p>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="w-8 py-2 pr-2">
                            {pendingRegs.length > 0 ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300"
                                checked={allPendingSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = somePendingSelected;
                                }}
                                onChange={toggleSelectAllPending}
                                disabled={approvalBusy}
                                aria-label="Select all pending registrations"
                              />
                            ) : null}
                          </th>
                          <th className="py-2 pr-4">User</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {registrations.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-2">
                              {r.status === 'PENDING' ? (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300"
                                  checked={selectedPendingIds.has(r.id)}
                                  onChange={() => toggleSelectPending(r.id)}
                                  disabled={approvalBusy}
                                  aria-label={`Select ${r.user.email}`}
                                />
                              ) : null}
                            </td>
                            <td className="py-2 pr-4">
                              {r.user.firstName} {r.user.lastName}
                              <div className="text-xs text-gray-500">{r.user.email}</div>
                            </td>
                            <td className="py-2 pr-4 font-medium">{r.status}</td>
                            <td className="py-2 pr-4">
                              <div className="flex flex-wrap gap-2">
                                {r.status === 'PENDING' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={approvalBusy}
                                      onClick={() => approveMut.mutate({ id: r.id })}
                                      className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={approvalBusy}
                                      onClick={() => setRejectModalIds([r.id])}
                                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold disabled:opacity-40"
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
                        ))}
                      </tbody>
                    </table>
                    {registrations.length === 0 && <p className="text-sm text-gray-500 py-4">No registrations yet.</p>}
                  </div>
                </>
              )}
            </>
          ) : webinarHubTab === 'surveys' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Survey submissions</h2>
              <p className="text-sm text-gray-600">
                Intake (registration) and post-event Jotform submissions recorded on each learner&apos;s registration.
              </p>
              {rLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Intake survey</th>
                        <th className="py-2 pr-4">Attendance</th>
                        <th className="py-2 pr-4">Post-event survey</th>
                        <th className="py-2 pr-4">Survey acknowledged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {registrations.map((r) => {
                        const intakeRequired = r.intakeRequired ?? false;
                        const intakeOk = r.intakeComplete ?? false;
                        const att = r.postEventAttendanceStatus;
                        const attBusy = attendanceMut.isPending && attendanceMut.variables?.id === r.id;
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
                              <div className="space-y-1.5">
                                <span
                                  className={[
                                    'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                    att === 'VERIFIED'
                                      ? 'bg-green-100 text-green-800'
                                      : att === 'DENIED'
                                        ? 'bg-red-100 text-red-800'
                                        : att === 'PENDING_VERIFICATION'
                                          ? 'bg-amber-50 text-amber-800'
                                          : 'bg-gray-100 text-gray-500',
                                  ].join(' ')}
                                >
                                  {att === 'VERIFIED'
                                    ? 'Verified'
                                    : att === 'DENIED'
                                      ? 'Denied'
                                      : att === 'PENDING_VERIFICATION'
                                        ? 'Pending'
                                        : '—'}
                                </span>
                                {r.status === 'APPROVED' && att !== 'VERIFIED' && (
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      disabled={attBusy}
                                      onClick={() => attendanceMut.mutate({ id: r.id, status: 'VERIFIED' })}
                                      className="rounded bg-green-700 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-40 hover:bg-green-800"
                                    >
                                      Verify
                                    </button>
                                    {att !== 'DENIED' && (
                                      <button
                                        type="button"
                                        disabled={attBusy}
                                        onClick={() => attendanceMut.mutate({ id: r.id, status: 'DENIED' })}
                                        className="rounded border border-gray-300 px-2 py-0.5 text-[11px] font-semibold text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                                      >
                                        Deny
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-gray-600">
                              <div className="space-y-1">
                                <span>{r.postEventJotformSubmissionId ? 'Recorded' : '—'}</span>
                                {r.postEventJotformSubmissionId ? (
                                  <code className="block text-xs text-gray-500 break-all max-w-[14rem]">
                                    {r.postEventJotformSubmissionId}
                                  </code>
                                ) : null}
                                {r.jotformPostEventSubmissionViewUrl ? (
                                  <a
                                    href={r.jotformPostEventSubmissionViewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                                  >
                                    View in Jotform <ExternalLink className="h-3 w-3 shrink-0" />
                                  </a>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-gray-600">
                              {r.postEventSurveyAcknowledgedAt
                                ? format(parseISO(r.postEventSurveyAcknowledgedAt), 'MMM d, yyyy h:mm a')
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {registrations.length === 0 && (
                    <p className="text-sm text-gray-500 py-4">No registrations yet.</p>
                  )}
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
                                    disabled={approveMut.isPending || rejectMut.isPending}
                                    onClick={() => approveMut.mutate({ id: r.id })}
                                    className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rejectMut.isPending}
                                    onClick={() => setRejectModalIds([r.id])}
                                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold disabled:opacity-50"
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

// ─── Zoom Links Section ────────────────────────────────────────────────────────

type PanelistLink = { name: string; email: string; joinUrl: string };

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      aria-label="Copy link"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ZoomLinksSection({
  program,
  programId,
}: {
  program: Record<string, unknown> | undefined;
  programId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshedCount, setRefreshedCount] = useState<number | null>(null);

  const refreshMutation = useMutation({
    mutationFn: () => adminApi.refreshZoomPanelists(programId!),
    onSuccess: (result) => {
      setRefreshedCount(result.refreshed);
      setRefreshError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to refresh panelist links';
      setRefreshError(msg);
    },
  });

  if (!program) return null;
  const pr = program as Record<string, unknown>;
  const rawLinks = pr.zoomPanelistLinks;
  const links: PanelistLink[] = Array.isArray(rawLinks)
    ? (rawLinks as PanelistLink[]).filter((p) => p?.joinUrl)
    : [];
  const joinUrl = (pr.zoomJoinUrl as string | null | undefined) ?? null;
  const startUrl = (pr.zoomStartUrl as string | null | undefined) ?? null;
  const isWebinar = String(pr.zoomSessionType || '') === 'WEBINAR';
  const hasMeetingId = !!pr.zoomMeetingId;

  if (!startUrl && !joinUrl && links.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Zoom links</h2>
        {isWebinar && hasMeetingId && (
          <button
            type="button"
            onClick={() => { setRefreshedCount(null); setRefreshError(null); refreshMutation.mutate(); }}
            disabled={refreshMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50"
            title="Re-fetch panelist join URLs from Zoom"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} aria-hidden />
            {refreshMutation.isPending ? 'Refreshing…' : 'Refresh panelist links'}
          </button>
        )}
      </div>

      {refreshedCount !== null && (
        <p className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {refreshedCount > 0
            ? `✓ Refreshed ${refreshedCount} panelist link${refreshedCount === 1 ? '' : 's'} from Zoom.`
            : 'No panelist links found on Zoom. Make sure panelists have been added to the webinar in Zoom.'}
        </p>
      )}
      {refreshError && (
        <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {refreshError}
        </p>
      )}

      <div className="flex flex-col gap-3">

        {/* Host start link */}
        {startUrl && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-violet-900">Host start link</p>
              <p className="mt-0.5 text-xs text-violet-700">Use this to start the session as the host.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CopyButton url={startUrl} />
              <a
                href={startUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
              </a>
            </div>
          </div>
        )}

        {/* Attendee join link */}
        {joinUrl && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">Attendee join link</p>
              <p className="mt-0.5 text-xs text-gray-500">Public link shown to enrolled learners.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CopyButton url={joinUrl} />
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
              </a>
            </div>
          </div>
        )}

        {/* Panelist / speaker personal join links */}
        {links.length > 0 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">
              Panelist / speaker links — share individually
            </p>
            {links.map((p) => (
              <div
                key={p.email}
                className="flex items-center justify-between gap-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-900 truncate">{p.name}</p>
                  <p className="mt-0.5 text-xs text-indigo-600 truncate">{p.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton url={p.joinUrl} />
                  <a
                    href={p.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
                  </a>
                </div>
              </div>
            ))}
          </>
        ) : isWebinar && hasMeetingId ? (
          <p className="text-xs text-gray-400 italic">
            No panelist links saved yet. Click "Refresh panelist links" to pull them from Zoom.
          </p>
        ) : null}

      </div>
    </section>
  );
}
