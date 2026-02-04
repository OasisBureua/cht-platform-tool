import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { adminApi } from '../../api/admin';

export default function AdminWebinarScheduler() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [speakerName, setSpeakerName] = useState('Dr. Sarah Johnson');
  const [attendanceReward, setAttendanceReward] = useState('100');
  const [speakerBio, setSpeakerBio] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      description: string;
      sponsorName: string;
      honorariumAmount?: number;
      startDate?: string;
      status: 'DRAFT' | 'PUBLISHED';
    }) => adminApi.createProgram(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'programs'] });
      navigate('/admin/programs');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const rewardNum = parseFloat(attendanceReward.replace(/[^0-9.]/g, ''));
    let fullDescription = description;
    if (speakerName) fullDescription += `\n\nSpeaker: ${speakerName}`;
    if (speakerBio) fullDescription += `\n\n${speakerBio}`;

    const startDate =
      date && time ? `${date}T${time}:00` : date ? `${date}T12:00:00` : undefined;

    createMutation.mutate({
      title: title.trim(),
      description: fullDescription.trim() || 'Webinar',
      sponsorName: category.trim() || 'General',
      honorariumAmount: !isNaN(rewardNum) && rewardNum > 0 ? rewardNum : undefined,
      startDate,
      status: 'DRAFT',
    });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Webinar Scheduler</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set up educational webinars and invite HCPs to participate.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Schedule New Webinar</h2>
          </div>

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
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Category / Sponsor
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Cardiology"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Description *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will be covered in this webinar..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Speaker Name
              </label>
              <input
                type="text"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Attendance Reward ($)
              </label>
              <input
                type="text"
                value={attendanceReward}
                onChange={(e) => setAttendanceReward(e.target.value)}
                placeholder="100"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Speaker Bio
            </label>
            <textarea
              rows={2}
              value={speakerBio}
              onChange={(e) => setSpeakerBio(e.target.value)}
              placeholder="Brief bio of the speaker..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Duration (min)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        {createMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            Failed to create webinar. Please try again.
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/programs')}
            className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !title.trim()}
            className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {createMutation.isPending ? 'Scheduling...' : 'Schedule Webinar'}
          </button>
        </div>
      </form>
    </div>
  );
}
