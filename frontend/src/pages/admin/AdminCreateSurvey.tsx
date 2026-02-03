import { Search } from 'lucide-react';

export default function AdminCreateSurvey() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Survey</h1>
        <p className="text-sm text-gray-600 mt-1">
          Design AI-powered audio surveys to engage healthcare professionals and gather valuable insights.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-bold text-gray-900">Create New Survey</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Survey Title *</label>
            <input
              type="text"
              placeholder="e.g., Patient Experience Survey"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Reward Amount*</label>
            <input
              type="text"
              placeholder="Input amount"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Description *</label>
            <textarea
              rows={4}
              placeholder="Description of what this survey is about..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Questions *</h2>
          <button className="rounded-xl border border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900 inline-flex items-center gap-2 hover:bg-gray-50">
            + Add Question
          </button>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Question {i}</label>
              <input
                type="text"
                placeholder="Enter your question...."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Response Type</label>
              <input
                type="text"
                readOnly
                value="Audio Response (AI Powered)"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-gray-50"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button className="rounded-xl border border-blue-600 bg-white px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-gray-50">
          Cancel
        </button>
        <button className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black">
          Create Survey
        </button>
      </div>
    </div>
  );
}
