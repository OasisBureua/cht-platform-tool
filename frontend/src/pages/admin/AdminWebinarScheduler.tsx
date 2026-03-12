import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Calendar } from 'lucide-react';
import { adminApi, type CreateWebinarPayload } from '../../api/admin';

const DEFAULT_JOTFORM_TEMPLATE_ID = '260698533879881';

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

export default function AdminWebinarScheduler() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [speakerBio, setSpeakerBio] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [duration, setDuration] = useState('60');
  const [createSurvey, setCreateSurvey] = useState(true);
  const [jotformTemplateId, setJotformTemplateId] = useState(DEFAULT_JOTFORM_TEMPLATE_ID);

  const { data: adminConfig } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getAdminConfig(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (adminConfig?.jotformTemplateFormId && jotformTemplateId === DEFAULT_JOTFORM_TEMPLATE_ID) {
      setJotformTemplateId(adminConfig.jotformTemplateFormId);
    }
  }, [adminConfig?.jotformTemplateFormId, jotformTemplateId]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [zoomWarning, setZoomWarning] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateWebinarPayload) => adminApi.createWebinar(payload),
    onSuccess: (data: { zoomWarning?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
      if (data?.zoomWarning) {
        setZoomWarning(data.zoomWarning);
      } else {
        navigate('/admin/programs');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) { setValidationError('Webinar title is required.'); return; }
    if (!date) { setValidationError('Date is required.'); return; }
    if (!time) { setValidationError('Time is required.'); return; }

    const startDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(startDateTime.getTime())) { setValidationError('Invalid date or time.'); return; }
    if (startDateTime <= new Date()) { setValidationError('Start date and time must be in the future.'); return; }

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
      status: 'PUBLISHED',
      createSurveyFromTemplate: createSurvey ? jotformTemplateId : undefined,
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Webinar Scheduler</h1>
        <p className="text-sm text-gray-600 mt-1">
          Schedule a live webinar — it will be created on Zoom and published on the platform automatically.
        </p>
      </div>

      {/* Zoom sync warning — shown when webinar saved but Zoom failed */}
      {zoomWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-yellow-50 border border-yellow-300 px-4 py-3">
          <Video className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">Webinar saved — Zoom sync failed</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              The webinar was saved to the platform and is visible on the public page, but could not be created on Zoom.
              Fix the Zoom app scopes in the Zoom Marketplace, then edit the webinar to retry.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/admin/programs')}
              className="text-xs font-semibold text-yellow-800 underline"
            >
              View webinars
            </button>
          </div>
        </div>
      )}

      {/* Zoom note */}
      {!zoomWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <Video className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            When Zoom credentials are configured, submitting this form will create the meeting on Zoom and generate a join link automatically. The webinar will also appear on the public Webinars page.
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
            <h2 className="text-lg font-bold text-gray-900">Schedule New Webinar</h2>
          </div>

          {/* Title + Sponsor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Webinar Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Advanced Cardiology Techniques"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Sponsor / Category
              </label>
              <input
                type="text"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="e.g., Cardiology Dept."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will be covered in this webinar…"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Speaker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Speaker Name
              </label>
              <input
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Speaker Bio
              </label>
              <input
                type="text"
                value={speakerBio}
                onChange={(e) => setSpeakerBio(e.target.value)}
                placeholder="Brief bio…"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* Date / Time / Timezone / Duration */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Time *
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Duration (min)
              </label>
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

          {/* Survey toggle */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createSurvey}
                onChange={(e) => setCreateSurvey(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm font-medium text-gray-700">
                Auto-create post-event survey from Jotform template
              </span>
            </label>
            {createSurvey && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Jotform template form ID
                </label>
                <input
                  type="text"
                  value={jotformTemplateId}
                  onChange={(e) => setJotformTemplateId(e.target.value)}
                  placeholder={DEFAULT_JOTFORM_TEMPLATE_ID}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Template form to clone. Set via JOTFORM_TEMPLATE_FORM_ID env, or override here. Default: {DEFAULT_JOTFORM_TEMPLATE_ID}
                </p>
              </div>
            )}
          </div>
        </div>

        {createMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            Failed to schedule webinar. Please check the details and try again.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/programs')}
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
            {createMutation.isPending ? 'Scheduling…' : 'Schedule Webinar'}
          </button>
        </div>
      </form>
    </div>
  );
}
