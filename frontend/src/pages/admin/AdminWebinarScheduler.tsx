import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Calendar, Copy, Check, ExternalLink } from 'lucide-react';
import { DateTime } from 'luxon';
import { adminApi, type CreateWebinarPayload, type ZoomSessionType, type ZoomPanelistLink } from '../../api/admin';
import { wallClockToUtcIso } from '../../utils/wallClockToUtcIso';

/** One-shot copy button — shows a checkmark for 2 s then resets. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      title="Copy link"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

/** Default Jotforms for Zoom Webinar schedules (registration intake + post-session survey). */
const DEFAULT_WEBINAR_INTAKE_JOTFORM_URL = 'https://communityhealthmedia.jotform.com/261116295463861';
const DEFAULT_WEBINAR_POST_EVENT_JOTFORM_URL = 'https://communityhealthmedia.jotform.com/260698533879881';

export type AdminWebinarSchedulerProps = {
  /** Pre-select session type (e.g. MEETING on /admin/office-hours-scheduler). */
  defaultZoomSessionType?: ZoomSessionType;
  /** When true, session type is fixed to `defaultZoomSessionType` (office-hours route uses MEETING + office hours copy). */
  lockSessionType?: boolean;
};

export default function AdminWebinarScheduler({
  defaultZoomSessionType = 'WEBINAR',
  lockSessionType = false,
}: AdminWebinarSchedulerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [zoomSessionType, setZoomSessionType] = useState<ZoomSessionType>(defaultZoomSessionType);
  const [honorariumUsd, setHonorariumUsd] = useState('');
  const [jotformIntakeFormUrl, setJotformIntakeFormUrl] = useState(
    () => (defaultZoomSessionType === 'WEBINAR' ? DEFAULT_WEBINAR_INTAKE_JOTFORM_URL : ''),
  );
  const [postEventJotformFormIdOrUrl, setPostEventJotformFormIdOrUrl] = useState(
    () => (defaultZoomSessionType === 'WEBINAR' ? DEFAULT_WEBINAR_POST_EVENT_JOTFORM_URL : ''),
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [kols, setKols] = useState([{ name: '', bio: '' }]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [duration, setDuration] = useState('60');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [zoomWarning, setZoomWarning] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<{
    zoomStartUrl?: string | null;
    zoomJoinUrl?: string | null;
    zoomPanelistLinks?: ZoomPanelistLink[];
    jotformFormsWarning?: string;
  } | null>(null);

  useEffect(() => {
    setZoomSessionType(defaultZoomSessionType);
  }, [defaultZoomSessionType]);

  useEffect(() => {
    if (zoomSessionType === 'MEETING') {
      setHonorariumUsd('');
      setJotformIntakeFormUrl('');
      setPostEventJotformFormIdOrUrl('');
      return;
    }
    /** WEBINAR: pre-fill CHM Jotforms when switching from office hours or restoring empty inputs */
    setJotformIntakeFormUrl((v) => (v.trim() ? v : DEFAULT_WEBINAR_INTAKE_JOTFORM_URL));
    setPostEventJotformFormIdOrUrl((v) => (v.trim() ? v : DEFAULT_WEBINAR_POST_EVENT_JOTFORM_URL));
  }, [zoomSessionType]);

  const { data: adminConfig } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getAdminConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const successPath = zoomSessionType === 'MEETING' ? '/admin/office-hours' : '/admin/programs';
  const isWebinar = zoomSessionType === 'WEBINAR';
  const isOfficeHoursOnly = lockSessionType && defaultZoomSessionType === 'MEETING';

  const createMutation = useMutation({
    mutationFn: (payload: CreateWebinarPayload) => adminApi.createWebinar(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
      if (data?.zoomWarning) {
        setZoomWarning(data.zoomWarning);
        return;
      }
      // For webinars, show the generated links before navigating away.
      if (isWebinar && (data?.zoomStartUrl || data?.zoomJoinUrl || data?.zoomPanelistLinks?.length)) {
        setCreatedLinks({
          zoomStartUrl: data.zoomStartUrl,
          zoomJoinUrl: data.zoomJoinUrl,
          zoomPanelistLinks: data.zoomPanelistLinks,
          jotformFormsWarning: data.jotformFormsWarning,
        });
        return;
      }
      navigate(successPath, {
        state: data?.jotformFormsWarning ? { jotformFormsWarning: data.jotformFormsWarning } : undefined,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError(isWebinar ? 'Title is required.' : 'Session title is required.');
      return;
    }
    if (!date) {
      setValidationError('Date is required.');
      return;
    }
    if (!time) {
      setValidationError('Time is required.');
      return;
    }

    const startUtcIso = wallClockToUtcIso(date, time, timezone);
    if (!startUtcIso) {
      setValidationError('Invalid date or time.');
      return;
    }
    const startInstantMs = DateTime.fromISO(startUtcIso).toMillis();
    if (startInstantMs <= Date.now()) {
      setValidationError('Start date and time must be in the future.');
      return;
    }

    const intakeTrimmed = jotformIntakeFormUrl.trim();
    const intakeUrl =
      (isWebinar ? intakeTrimmed || DEFAULT_WEBINAR_INTAKE_JOTFORM_URL : intakeTrimmed) || '';
    if (isWebinar && !intakeUrl) {
      setValidationError('Registration intake (Jotform URL) is required for webinars.');
      return;
    }

    const postEventMerged =
      isWebinar
        ? postEventJotformFormIdOrUrl.trim() || DEFAULT_WEBINAR_POST_EVENT_JOTFORM_URL
        : postEventJotformFormIdOrUrl.trim();

    let honorariumNum: number | undefined;
    if (isWebinar && honorariumUsd.trim()) {
      honorariumNum = parseFloat(honorariumUsd);
      if (Number.isNaN(honorariumNum) || honorariumNum < 0) {
        setValidationError('Honorarium must be a non-negative dollar amount (or leave blank).');
        return;
      }
    }

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 15 || durationNum > 480) {
      setValidationError('Duration must be between 15 and 480 minutes.');
      return;
    }

    const primaryKol = kols[0];
    const primaryKolName = primaryKol?.name.trim() || '';
    const primaryKolBio = primaryKol?.bio.trim() || '';

    // Additional KOLs (2nd+) get appended to description so they still surface in the UI.
    const extraKolLines = kols
      .slice(1)
      .filter((k) => k.name.trim())
      .map((k) => (k.bio.trim() ? `${k.name.trim()} — ${k.bio.trim()}` : k.name.trim()));
    let fullDescription = description.trim();
    if (extraKolLines.length > 0) {
      fullDescription += `\n\nAdditional speakers: ${extraKolLines.join('; ')}`;
    }

    // Collect all speaker names for Zoom panelist registration (WEBINAR only).
    const speakerNames = kols.map((k) => k.name.trim()).filter(Boolean);

    const payload: CreateWebinarPayload = {
      title: title.trim(),
      description: fullDescription || title.trim(),
      sponsorName: sponsorName.trim() || 'General',
      ...(primaryKolName ? { hostDisplayName: primaryKolName } : {}),
      ...(primaryKolBio ? { hostBio: primaryKolBio } : {}),
      startDate: startUtcIso,
      duration: durationNum,
      timezone,
      zoomSessionType,
      status: 'PUBLISHED',
      ...(isWebinar ? { jotformIntakeFormUrl: intakeUrl } : {}),
      ...(postEventMerged ? { postEventJotformFormIdOrUrl: postEventMerged } : {}),
      ...(isWebinar && honorariumNum != null && honorariumNum > 0 ? { honorariumAmount: honorariumNum } : {}),
      ...(isWebinar && speakerNames.length > 0 ? { speakers: speakerNames } : {}),
    };

    createMutation.mutate(payload);
  };

  // Success state: show all generated links, then let admin navigate away.
  if (createdLinks) {
    const { zoomStartUrl, zoomJoinUrl, zoomPanelistLinks = [], jotformFormsWarning } = createdLinks;
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Webinar scheduled</h1>
            <p className="text-sm text-gray-500">Copy the links below before leaving this page.</p>
          </div>
        </div>

        {jotformFormsWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {jotformFormsWarning}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
          {/* Host / Start URL */}
          {zoomStartUrl && (
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Host start link</p>
                <a
                  href={zoomStartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline break-all"
                >
                  {zoomStartUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <CopyButton value={zoomStartUrl} />
            </div>
          )}

          {/* Attendee join URL */}
          {zoomJoinUrl && (
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attendee join link</p>
                <a
                  href={zoomJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline break-all"
                >
                  {zoomJoinUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <CopyButton value={zoomJoinUrl} />
            </div>
          )}

          {/* Panelist links */}
          {zoomPanelistLinks.map((p) => (
            <div key={p.email} className="flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Panelist — {p.name}
                  <span className="ml-1.5 font-normal normal-case text-gray-400">{p.email}</span>
                </p>
                <a
                  href={p.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline break-all"
                >
                  {p.joinUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <CopyButton value={p.joinUrl} />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate(successPath)}
          className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
        >
          Done — view sessions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isWebinar ? 'Webinar scheduler' : 'Office hours scheduler'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {isWebinar
            ? 'Creates a Zoom Webinar and publishes it. The server clones a unique invitation Jotform and post-event Jotform from your template form IDs in environment variables, then wires webhooks. Learners complete invitation before approval; post-event reminders appear after the session. Honorarium uses Bill.com.'
            : 'Creates an office hours session as a Zoom Meeting (type MEETING: interactive Q&A, waiting room). Registrations require admin approval before learners can join. No automatic Jotform clone for this session type.'}
        </p>
      </div>

      {zoomWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-300 px-4 py-3">
          <Video className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">Saved. Zoom sync failed</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              The session was saved but could not be created on Zoom. Fix Zoom app scopes, then edit the session to
              retry.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(successPath)}
            className="text-xs font-semibold text-yellow-800 underline shrink-0"
          >
            View list
          </button>
        </div>
      )}

      {!zoomWarning && !isOfficeHoursOnly && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Choose <strong>Session type</strong> below. Webinars use Zoom Webinars; office hours use Zoom Meetings with
            waiting room (host admits attendees).
          </p>
        </div>
      )}

      {!zoomWarning && isOfficeHoursOnly && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            This page schedules <strong>office hours</strong> (Zoom Meeting, session type <code className="text-xs">MEETING</code>).
            Host admits attendees from the waiting room.
          </p>
        </div>
      )}

      {validationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Schedule session</h2>
          </div>

          {!lockSessionType ? (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Session type *</label>
              <select
                value={zoomSessionType}
                onChange={(e) => {
                  setZoomSessionType(e.target.value as ZoomSessionType);
                }}
                className="w-full max-w-md rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="WEBINAR">Webinar (Zoom Webinar, CME-style; intake Jotform required)</option>
                <option value="MEETING">Office hours (Zoom Meeting, Q&A, waiting room)</option>
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              Session type:{' '}
              <span className="font-semibold">
                {isWebinar ? 'Webinar (WEBINAR)' : 'Office hours (MEETING)'}
              </span>
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                {isWebinar ? 'Webinar title *' : 'Session title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isWebinar ? 'e.g., Advanced Cardiology Update' : 'e.g., Breast oncology office hours'}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Sponsor / category</label>
              <input
                type="text"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="e.g., Medical Affairs"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isWebinar ? 'What will be covered…' : 'Topics, who will host, what to bring…'
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">
                {isWebinar ? 'Speakers / KOLs' : 'Host / KOLs'}
                <span className="ml-1 font-normal text-gray-500">— optional; add one or more</span>
              </label>
              <button
                type="button"
                onClick={() => setKols((prev) => [...prev, { name: '', bio: '' }])}
                className="text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
              >
                + Add KOL
              </button>
            </div>
            <div className="space-y-3">
              {kols.map((kol, idx) => (
                <div key={idx} className="flex gap-3 items-start rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={kol.name}
                      onChange={(e) => setKols((prev) => prev.map((k, i) => i === idx ? { ...k, name: e.target.value } : k))}
                      placeholder="Dr. Jane Smith"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                    />
                    <input
                      type="text"
                      value={kol.bio}
                      onChange={(e) => setKols((prev) => prev.map((k, i) => i === idx ? { ...k, bio: e.target.value } : k))}
                      placeholder="Title, specialty, or brief note…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                    />
                  </div>
                  {kols.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setKols((prev) => prev.filter((_, i) => i !== idx))}
                      className="shrink-0 mt-0.5 text-xs font-semibold text-red-600 hover:text-red-800"
                      aria-label={`Remove KOL ${idx + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">First KOL name is used as the session host display name.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Time *</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace('America/', '').replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Duration (min)</label>
              <input
                type="number"
                min="15"
                max="480"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <p className="text-xs text-gray-600">
            Date and time use the timezone you select above; we save the instant in UTC so the app and Zoom show the same
            local time (fixes wrong times when the server runs in UTC).
          </p>

          {isWebinar ? (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Honorarium (USD){' '}
                <span className="font-normal text-gray-500">— optional; webinars only</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={honorariumUsd}
                onChange={(e) => setHonorariumUsd(e.target.value)}
                placeholder="e.g. 500"
                className="w-full max-w-xs rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-xs text-gray-600">
                Learners can request this amount after post-event steps; admins pay via Bill.com. Not available for
                Office hours sessions.
              </p>
            </div>
          ) : null}

          {isWebinar ? (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Registration intake (Jotform URL) *
              </label>
              <input
                type="url"
                required
                value={jotformIntakeFormUrl}
                onChange={(e) => setJotformIntakeFormUrl(e.target.value)}
                placeholder="https://form.jotform.com/… or https://communityhealthmedia.jotform.com/…"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-xs text-gray-600">
                Required for webinars. This URL is saved on the program for learner registration intake. Point webhooks
                for this form at your app so submissions and progress sync correctly.
              </p>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Post-event survey (Jotform){' '}
              <span className="font-normal text-gray-500">— optional</span>
            </label>
            <input
              type="text"
              value={postEventJotformFormIdOrUrl}
              onChange={(e) => setPostEventJotformFormIdOrUrl(e.target.value)}
              placeholder="e.g. 241234567890123 or https://form.jotform.com/241234567890123"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <p className="mt-1 text-xs text-gray-600">
              When set, this form is saved as the <strong>post-event</strong> survey for the session and appears in the
              learner <strong>Surveys</strong> tab (and admin Surveys). Webhook should point at this app if you want
              responses stored automatically.
            </p>
            {isWebinar ? (
              <p className="mt-1 text-xs text-gray-600">
                For <strong>webinars</strong>, if you leave this blank, the server attaches post-event feedback from your
                environment template or shared form when Jotform is configured.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-600">
                For <strong>office hours</strong>, there is no automatic Jotform clone—use this field or Program hub to
                attach feedback.
              </p>
            )}
          </div>

          {isWebinar && (
            <div className="text-sm text-gray-700 border border-gray-200 rounded-xl bg-gray-50 px-4 py-3 space-y-2">
              <p className="font-semibold text-gray-900">Post-event survey (Jotform API)</p>
              <p>
                The intake URL above is always the form learners use to register. If you do not set a post-event form in
                the field above, the <strong>after-session</strong> survey is created from your environment&apos;s shared
                form or post-event template when Jotform API access is configured.
              </p>
              {adminConfig?.webinarJotformTemplatesConfigured ? (
                <p className="text-xs text-green-800">
                  This environment looks ready. Invitation template form ID{' '}
                  <span className="font-mono">{adminConfig.jotformInvitationTemplateFormId || '—'}</span>; post-event{' '}
                  {adminConfig.jotformPostEventSharedFormId ? (
                    <>
                      using shared form <span className="font-mono">{adminConfig.jotformPostEventSharedFormId}</span>
                    </>
                  ) : (
                    <>
                      cloning from template <span className="font-mono">{adminConfig.jotformPostEventTemplateFormId || '—'}</span>
                    </>
                  )}
                  .
                </p>
              ) : (
                <p className="text-xs text-amber-800">
                  Jotform templates or API access are not fully configured for this environment. You can still save a
                  post-event form above; invitation cloning may need your technical administrator to finish deployment
                  setup.
                </p>
              )}
            </div>
          )}

          {!isWebinar && (
            <p className="text-sm text-gray-600 border border-gray-100 rounded-xl bg-gray-50 px-4 py-3">
              Office hours use Zoom Meetings (MEETING). Optional intake or other links can be set in Program hub.
            </p>
          )}
        </div>

        {createMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            Failed to schedule. Please check the details and try again.
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(successPath)}
            className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {createMutation.isPending && (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {createMutation.isPending
              ? 'Scheduling…'
              : isWebinar
                ? 'Schedule webinar'
                : 'Schedule office hours'}
          </button>
        </div>
      </form>
    </div>
  );
}
