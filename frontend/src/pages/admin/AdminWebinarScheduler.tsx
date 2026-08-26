import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Calendar } from 'lucide-react';
import { DateTime } from 'luxon';
import { adminApi, type CreateWebinarPayload, type ZoomSessionType, type ZoomWebinarSettings } from '../../api/admin';
import { wallClockToUtcIso } from '../../utils/wallClockToUtcIso';
import {
  SCHEDULER_TIMEZONES,
  formatTimezoneLabel,
} from '../../utils/timezoneOptions';
import { BillComMark } from '../../components/branding/BillComMark';
import { SessionHeroImageField } from '../../components/admin/SessionHeroImageField';
import ZoomWebinarSettingsFields, {
  DEFAULT_ZOOM_WEBINAR_SETTINGS,
} from '../../components/admin/ZoomWebinarSettingsFields';

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
  const [sessionHeroImageUrl, setSessionHeroImageUrl] = useState('');
  const [sessionDisclaimer, setSessionDisclaimer] = useState('');
  const [zoomSettings, setZoomSettings] = useState<ZoomWebinarSettings>(
    DEFAULT_ZOOM_WEBINAR_SETTINGS,
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [zoomWarning, setZoomWarning] = useState<string | null>(null);

  useEffect(() => {
    setZoomSessionType(defaultZoomSessionType);
  }, [defaultZoomSessionType]);

  useEffect(() => {
    if (zoomSessionType === 'MEETING') {
      setHonorariumUsd('');
    }
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
        data?.surveysWarning,
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
      ...(isWebinar && honorariumNum != null && honorariumNum > 0 ? { honorariumAmount: honorariumNum } : {}),
      ...(cleanSpeakers.length > 0 ? { speakers: cleanSpeakers } : {}),
      ...(sessionHeroImageUrl.trim() ? { sessionHeroImageUrl: sessionHeroImageUrl.trim() } : {}),
      ...(sessionDisclaimer.trim() ? { sessionDisclaimer: sessionDisclaimer.trim() } : {}),
      ...(isWebinar ? { zoomSettings } : {}),
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="mx-auto w-full max-w-[min(100%,100rem)] space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isWebinar ? 'Webinar scheduler' : 'Office Hours scheduler'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isWebinar ? (
            <>
              Creates a Zoom Webinar and publishes it. The server automatically creates native registration intake and
              post-event surveys for this program. Learners complete intake before approval; post-event steps appear
              after the session. Honorarium payouts use{' '}
              <BillComMark size="sm" className="translate-y-px" />.
            </>
          ) : (
            'Creates Office Hours as a Zoom Meeting (type MEETING: conversational Q&A, waiting room). Registrations require admin approval before learners can join. Pair with Program hub time slots when you split the hour.'
          )}
        </p>
      </div>

      {/* Post-submit: session saved but Zoom was not available */}
      {zoomWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-300 px-4 py-3">
          <Video className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">Session saved, no Zoom meeting created</p>
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
            Choose <strong>Session type</strong> below. Live webinars use Zoom Webinars; Office Hours use Zoom Meetings with
            a waiting room (host admits attendees).
          </p>
        </div>
      )}

      {!zoomWarning && isOfficeHoursOnly && adminConfig?.zoomConfigured && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            This flow schedules <strong>Office Hours</strong> as a Zoom Meeting (<code className="text-xs">MEETING</code>), often used
            alongside webinar-style programming. Host admits attendees from the waiting room.
          </p>
        </div>
      )}

      {validationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
          {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-card border border-border p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">Schedule session</h2>
          </div>

          {!lockSessionType ? (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Session type *</label>
              <select
                value={zoomSessionType}
                onChange={(e) => {
                  setZoomSessionType(e.target.value as ZoomSessionType);
                }}
                className="w-full max-w-md rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="WEBINAR">Live webinar (Zoom Webinar; intake Jotform required)</option>
                <option value="MEETING">Office Hours (Zoom Meeting; Q&A, waiting room)</option>
              </select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Session type:{' '}
              <span className="font-semibold">
                {isWebinar ? 'Webinar (WEBINAR)' : 'Office Hours (MEETING)'}
              </span>
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                {isWebinar ? 'Webinar title *' : 'Session title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isWebinar ? 'e.g., Advanced Cardiology Update' : 'e.g., Tumor board Q&A'}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Sponsor / category</label>
              <input
                type="text"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="e.g., Medical Affairs"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isWebinar ? 'What will be covered…' : 'Topics, who will host, what to bring…'
              }
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SessionHeroImageField
              spacious
              value={sessionHeroImageUrl}
              onChange={setSessionHeroImageUrl}
            />
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Learner disclaimer <span className="font-normal text-muted-foreground">, optional</span>
              </label>
              <textarea
                rows={3}
                value={sessionDisclaimer}
                onChange={(e) => setSessionDisclaimer(e.target.value)}
                placeholder="Sponsor attestation, CE limits, or privacy wording shown above registration."
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Plain text. Shown on the registration wizard and session detail page; update anytime from the webinar editor.
              </p>
            </div>
          </div>

          {/* Host */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Host
              <span className="ml-1 font-normal text-muted-foreground">, optional</span>
            </label>
            <div className="flex gap-3 rounded-xl border border-border bg-gray-50/60 px-4 py-3">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-card"
                />
                <input
                  type="text"
                  value={hostBio}
                  onChange={(e) => setHostBio(e.target.value)}
                  placeholder="Title, specialty, or brief note…"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-card"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isWebinar
                ? 'Person moderating/running the session. Shown as "Host:" on the live session card.'
                : 'Person hosting Office Hours. Shown as "Get time with…" on the session card.'}
            </p>
          </div>

          {/* Speakers / KOLs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-foreground">
                Speakers / KOLs
                <span className="ml-1 font-normal text-muted-foreground">, optional; add one or more</span>
              </label>
              <button
                type="button"
                onClick={() => setSpeakers((prev) => [...prev, ''])}
                className="text-xs font-semibold text-muted-foreground border border-border rounded-lg px-2.5 py-1 hover:bg-muted transition-colors"
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
                    className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                  {speakers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSpeakers((prev) => prev.filter((_, i) => i !== idx))}
                      className="shrink-0 text-xs font-semibold text-destructive hover:text-red-800"
                      aria-label={`Remove speaker ${idx + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown as "Speaker(s):" on the card. Each speaker also gets a unique Zoom panelist join URL.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Time *</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                {SCHEDULER_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {formatTimezoneLabel(tz.value, tz.name, date || undefined)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Duration (min)</label>
              <input
                type="number"
                min="15"
                max="480"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Date and time use the timezone you select above; we save the instant in UTC so the app and Zoom show the same
            local time (fixes wrong times when the server runs in UTC).
          </p>

          {isWebinar ? (
            <ZoomWebinarSettingsFields value={zoomSettings} onChange={setZoomSettings} />
          ) : null}

          {isWebinar ? (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Honorarium (USD){' '}
                <span className="font-normal text-muted-foreground">, optional; webinars only</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={honorariumUsd}
                onChange={(e) => setHonorariumUsd(e.target.value)}
                placeholder="e.g. 500"
                className="w-full max-w-xs rounded-xl border border-border px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
                Learners can request this amount after post-event steps; admins pay via{' '}
                <BillComMark size="xs" className="translate-y-px" />. Not available for Office Hours (Zoom Meetings).
              </p>
            </div>
          ) : null}

          {isWebinar ? (
            <div className="text-sm text-muted-foreground border border-border rounded-xl bg-muted px-4 py-3 space-y-2">
              <p className="font-semibold text-foreground">Registration &amp; post-event surveys</p>
              <p>
                When you save a webinar, the platform creates two native surveys for this program: a{' '}
                <strong>registration intake</strong> form (required before admin approval) and a{' '}
                <strong>post-event feedback</strong> form (shown after the session). No Jotform URLs are required here.
              </p>
              <p className="text-xs text-muted-foreground">
                To replace or edit questions later, use Program hub or the admin Surveys list.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border border-gray-100 rounded-xl bg-muted px-4 py-3">
              Office hours use Zoom Meetings (MEETING). Optional intake or other links can be set in Program hub.
            </p>
          )}
        </div>

        {createMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-destructive text-sm">
            Failed to schedule. Please check the details and try again.
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(successPath)}
            className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
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
