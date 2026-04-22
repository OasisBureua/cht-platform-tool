import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Calendar } from 'lucide-react';
import { adminApi, type CreateWebinarPayload, type ZoomSessionType } from '../../api/admin';

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

export type AdminWebinarSchedulerProps = {
  /** Pre-select session type (e.g. MEETING on /admin/office-hours-scheduler). */
  defaultZoomSessionType?: ZoomSessionType;
};

export default function AdminWebinarScheduler({
  defaultZoomSessionType = 'WEBINAR',
}: AdminWebinarSchedulerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [zoomSessionType, setZoomSessionType] = useState<ZoomSessionType>(defaultZoomSessionType);
  useEffect(() => {
    setZoomSessionType(defaultZoomSessionType);
  }, [defaultZoomSessionType]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [speakerBio, setSpeakerBio] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [duration, setDuration] = useState('60');

  const { data: adminConfig } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getAdminConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [zoomWarning, setZoomWarning] = useState<string | null>(null);

  const successPath = zoomSessionType === 'MEETING' ? '/admin/office-hours' : '/admin/programs';
  const isWebinar = zoomSessionType === 'WEBINAR';

  const createMutation = useMutation({
    mutationFn: (payload: CreateWebinarPayload) => adminApi.createWebinar(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
      if (data?.zoomWarning) {
        setZoomWarning(data.zoomWarning);
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

    const startDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(startDateTime.getTime())) {
      setValidationError('Invalid date or time.');
      return;
    }
    if (startDateTime <= new Date()) {
      setValidationError('Start date and time must be in the future.');
      return;
    }

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 15 || durationNum > 480) {
      setValidationError('Duration must be between 15 and 480 minutes.');
      return;
    }

    let fullDescription = description.trim();
    if (speakerName.trim()) fullDescription += `\n\nSpeaker: ${speakerName.trim()}`;
    if (speakerBio.trim()) fullDescription += `\n\n${speakerBio.trim()}`;

    const payload: CreateWebinarPayload = {
      title: title.trim(),
      description: fullDescription || title.trim(),
      sponsorName: sponsorName.trim() || 'General',
      startDate: `${date}T${time}:00`,
      duration: durationNum,
      timezone,
      zoomSessionType,
      status: 'PUBLISHED',
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isWebinar ? 'Webinar scheduler' : 'Office Hours scheduler'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {isWebinar
            ? 'Creates a Zoom Webinar and publishes it. The server clones a unique invitation Jotform and post-event Jotform from your template form IDs in environment variables, then wires webhooks. Learners complete invitation before approval; post-event reminders appear after the session. Honorarium uses Bill.com.'
            : 'Creates a Zoom Meeting (interactive Q&A, waiting room). Registrations require admin approval before learners can join. No automatic Jotform clone for meetings.'}
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

      {!zoomWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Choose <strong>Session type</strong> below. Webinars use Zoom Webinars; Office Hours use Zoom Meetings with
            waiting room (host admits attendees).
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

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Session type *</label>
            <select
              value={zoomSessionType}
              onChange={(e) => {
                setZoomSessionType(e.target.value as ZoomSessionType);
              }}
              className="w-full max-w-md rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="WEBINAR">Webinar (Zoom Webinar, CME-style, optional Jotform survey)</option>
              <option value="MEETING">Office Hours (Zoom Meeting, Q&A, waiting room)</option>
            </select>
          </div>

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
                placeholder={isWebinar ? 'e.g., Advanced Cardiology Update' : 'e.g., Breast oncology Office Hours'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Host / speaker name</label>
              <input
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Host note / bio</label>
              <input
                type="text"
                value={speakerBio}
                onChange={(e) => setSpeakerBio(e.target.value)}
                placeholder="Brief note…"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
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

          {isWebinar && (
            <div className="text-sm text-gray-700 border border-gray-200 rounded-xl bg-gray-50 px-4 py-3 space-y-2">
              <p className="font-semibold text-gray-900">Registration forms (Jotform)</p>
              <p>
                Each webinar gets its own copy of your <strong>invitation</strong> form. The <strong>after-session</strong>{' '}
                survey is either one <strong>shared</strong> form for every webinar or a new copy from your post-event
                template—whichever your technical administrator configured. We also need Jotform API access on the server so
                those forms can be created automatically.
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
                  Jotform templates or API access are not fully configured for this environment. Scheduling a webinar will
                  fail until your technical administrator finishes setup in deployment settings.
                </p>
              )}
            </div>
          )}

          {!isWebinar && (
            <p className="text-sm text-gray-600 border border-gray-100 rounded-xl bg-gray-50 px-4 py-3">
              Office Hours use Zoom Meetings only. Attach optional Jotforms manually in the program hub if needed.
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
            {createMutation.isPending ? 'Scheduling…' : isWebinar ? 'Schedule webinar' : 'Schedule Office Hours'}
          </button>
        </div>
      </form>
    </div>
  );
}
