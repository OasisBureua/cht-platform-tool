import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Calendar } from 'lucide-react';
import { DateTime } from 'luxon';
import { adminApi, type CreateWebinarPayload, type ZoomSessionType } from '../../api/admin';
import { wallClockToUtcIso } from '../../utils/wallClockToUtcIso';


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
  const [hostName, setHostName] = useState('');
  const [hostBio, setHostBio] = useState('');
  const [speakers, setSpeakers] = useState<string[]>(['']);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [duration, setDuration] = useState('60');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [zoomWarning, setZoomWarning] = useState<string | null>(null);

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

      // Collect any non-fatal warnings to surface on the list page.
      const warnings = [
        data?.zoomWarning,
        data?.zoomPanelistError,
        data?.jotformFormsWarning,
      ].filter(Boolean) as string[];

      navigate(successPath, {
        state: warnings.length ? { warning: warnings.join('\n\n') } : undefined,
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

    const cleanHost = hostName.trim();
    const cleanHostBio = hostBio.trim();
    const cleanSpeakers = speakers.map((s) => s.trim()).filter(Boolean);

    const payload: CreateWebinarPayload = {
      title: title.trim(),
      description: description.trim() || title.trim(),
      sponsorName: sponsorName.trim() || 'General',
      ...(cleanHost ? { hostDisplayName: cleanHost } : {}),
      ...(cleanHostBio ? { hostBio: cleanHostBio } : {}),
      startDate: startUtcIso,
      duration: durationNum,
      timezone,
      zoomSessionType,
      status: 'PUBLISHED',
      ...(isWebinar ? { jotformIntakeFormUrl: intakeUrl } : {}),
      ...(postEventMerged ? { postEventJotformFormIdOrUrl: postEventMerged } : {}),
      ...(isWebinar && honorariumNum != null && honorariumNum > 0 ? { honorariumAmount: honorariumNum } : {}),
      ...(cleanSpeakers.length > 0 ? { speakers: cleanSpeakers } : {}),
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="mx-auto w-full max-w-[min(100%,100rem)] space-y-8">
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

      {/* Post-submit: session saved but Zoom was not available */}
      {zoomWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-300 px-4 py-3">
          <Video className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">Session saved — no Zoom meeting created</p>
            <p className="text-sm text-yellow-700 mt-0.5">{zoomWarning}</p>
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

      {/* Pre-form: warn when Zoom env vars are not set */}
      {!zoomWarning && adminConfig !== undefined && !adminConfig.zoomConfigured && (
        <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-300 px-4 py-3">
          <Video className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">Zoom not connected</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Sessions will be saved, but <strong>no Zoom meeting will be created</strong> until you add{' '}
              <code className="font-mono text-xs">ZOOM_ACCOUNT_ID</code>,{' '}
              <code className="font-mono text-xs">ZOOM_CLIENT_ID</code>, and{' '}
              <code className="font-mono text-xs">ZOOM_CLIENT_SECRET</code>{' '}
              to your environment variables (Server-to-Server OAuth app from{' '}
              <a
                href="https://marketplace.zoom.us"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                marketplace.zoom.us
              </a>
              ).
            </p>
          </div>
        </div>
      )}

      {!zoomWarning && !isOfficeHoursOnly && adminConfig?.zoomConfigured && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Choose <strong>Session type</strong> below. Webinars use Zoom Webinars; office hours use Zoom Meetings with
            waiting room (host admits attendees).
          </p>
        </div>
      )}

      {!zoomWarning && isOfficeHoursOnly && adminConfig?.zoomConfigured && (
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

          {/* Host */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Host
              <span className="ml-1 font-normal text-gray-500">— optional</span>
            </label>
            <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                />
                <input
                  type="text"
                  value={hostBio}
                  onChange={(e) => setHostBio(e.target.value)}
                  placeholder="Title, specialty, or brief note…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {isWebinar
                ? 'Person moderating/running the session. Shown as "Host:" on the webinar card.'
                : 'Person hosting the office hours. Shown as "Get time with…" on the session card.'}
            </p>
          </div>

          {/* Speakers / KOLs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">
                Speakers / KOLs
                <span className="ml-1 font-normal text-gray-500">— optional; add one or more</span>
              </label>
              <button
                type="button"
                onClick={() => setSpeakers((prev) => [...prev, ''])}
                className="text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
              >
                + Add speaker
              </button>
            </div>
            <div className="space-y-2">
              {speakers.map((sp, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={sp}
                    onChange={(e) => setSpeakers((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))}
                    placeholder="Dr. John Doe"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  {speakers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSpeakers((prev) => prev.filter((_, i) => i !== idx))}
                      className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800"
                      aria-label={`Remove speaker ${idx + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Shown as "Speaker(s):" on the card. Each speaker also gets a unique Zoom panelist join URL.
            </p>
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
