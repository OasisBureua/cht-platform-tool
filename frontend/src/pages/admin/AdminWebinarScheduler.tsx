import { Search } from 'lucide-react';

export default function AdminWebinarScheduler() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Webinar Scheduler</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set Up Educational Webinars and Invite HCP's to Participate for Rewards
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-bold text-gray-900">Schedule New Webinar</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Webinar Title*</label>
            <input type="text" placeholder="e.g, Advanced Cardiology Techniques" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Category*</label>
            <select className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500">
              <option>Select Category</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Description*</label>
          <textarea rows={3} placeholder="What will be covered in this webinar..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Speaker Name*</label>
            <input type="text" defaultValue="Dr. Sarah Johnson" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Attendance Reward*</label>
            <input type="text" defaultValue="$100.00" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Speaker Bio*</label>
          <textarea rows={2} placeholder="Brief Bio of the speaker..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Date*</label>
            <input type="date" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Time*</label>
            <input type="time" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Duration (minutes)*</label>
            <input type="number" placeholder="60" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Max Attendees*</label>
            <input type="number" placeholder="100" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50">
          Cancel
        </button>
        <button className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black">
          Schedule Webinar
        </button>
      </div>
    </div>
  );
}
