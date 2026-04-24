import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ChevronLeft, Download, Loader2, Plus, Trash2 } from 'lucide-react';
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

  const { data: program, isLoading: pLoading } = useQuery({
    queryKey: ['admin', 'program', programId],
    queryFn: () => adminApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: registrations = [], isLoading: rLoading } = useQuery({
    queryKey: ['admin', 'program', programId, 'registrations'],
    queryFn: () => adminApi.listProgramRegistrations(programId!),
    enabled: !!programId,
  });

  const { data: formLinks = [], isLoading: fLoading } = useQuery({
    queryKey: ['admin', 'program', programId, 'form-links'],
    queryFn: () => adminApi.listProgramFormLinks(programId!),
    enabled: !!programId,
  });

  const [intakeUrl, setIntakeUrl] = useState('');
  const [preUrl, setPreUrl] = useState('');
  const [hostName, setHostName] = useState('');
  const [calendly, setCalendly] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);

  useEffect(() => {
    if (!program) return;
    const pr = program as Record<string, unknown>;
    setIntakeUrl(String(pr.jotformIntakeFormUrl ?? ''));
    setPreUrl(String(pr.jotformPreEventUrl ?? ''));
    setHostName(String(pr.hostDisplayName ?? ''));
    setCalendly(String(pr.calendlySchedulingUrl ?? ''));
    setRequireApproval(Boolean(pr.registrationRequiresApproval));
  }, [program]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      adminApi.patchProgramRegistrationSettings(programId!, {
        jotformIntakeFormUrl: intakeUrl || null,
        jotformPreEventUrl: preUrl || null,
        hostDisplayName: hostName || null,
        calendlySchedulingUrl: calendly || null,
        registrationRequiresApproval: requireApproval,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId] });
    },
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'WAITLISTED' }) =>
      adminApi.updateProgramRegistration(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'program', programId, 'registrations'] });
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
          Program hub - Jotform URLs, Calendly, approval queue, office-hours slots, extra form links, and calendar
          invites.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Enrollments: {String((p._count as { enrollments?: number })?.enrollments ?? '-')} · Registrations:{' '}
          {String((p._count as { programRegistrations?: number })?.programRegistrations ?? '-')}
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Registration & forms</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Jotform intake URL</span>
            <input
              value={intakeUrl}
              onChange={(e) => setIntakeUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://form.jotform.com/..."
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Pre-event Jotform URL</span>
            <input
              value={preUrl}
              onChange={(e) => setPreUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://form.jotform.com/..."
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Host display name</span>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Dr. Jane Smith"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Calendly (optional)</span>
            <input
              value={calendly}
              onChange={(e) => setCalendly(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://calendly.com/..."
            />
            <span className="mt-1 block text-xs text-gray-500">
              Shown only to signed-in users in the app, and only after they are enrolled (including after you approve
              registration when approval is required). The scheduling URL is not exposed on public pages or APIs.
            </span>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
          />
          Require admin approval before enrollment (uncapped sign-ups; you pick who to invite)
        </label>
        <button
          type="button"
          onClick={() => settingsMutation.mutate()}
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
            Create slots that match your Zoom meeting duration. Learners pick one during registration.
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
                  {format(parseISO(s.startsAt), 'MMM d, h:mm a')} – {format(parseISO(s.endsAt), 'h:mm a')}
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
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">
                      {r.user.firstName} {r.user.lastName}
                      <div className="text-xs text-gray-500">{r.user.email}</div>
                    </td>
                    <td className="py-2 pr-4 font-medium">{r.status}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {r.slot
                        ? `${format(parseISO(r.slot.startsAt), 'MMM d h:mm a')}`
                        : '-'}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        {r.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => approveMut.mutate({ id: r.id, status: 'APPROVED' })}
                              className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white"
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
                ))}
              </tbody>
            </table>
            {registrations.length === 0 && <p className="text-sm text-gray-500 py-4">No registrations yet.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
