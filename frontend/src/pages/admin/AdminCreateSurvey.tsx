import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminCreateSurvey() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [programId, setProgramId] = useState('');
  const [jotformFormId, setJotformFormId] = useState('');
  const [questions, setQuestions] = useState<{ prompt: string }[]>([
    { prompt: '' },
    { prompt: '' },
    { prompt: '' },
  ]);

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['admin', 'programs'],
    queryFn: () => adminApi.getPrograms(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      programId: string;
      title: string;
      description?: string;
      questions: Record<string, unknown>[];
      jotformFormId?: string;
    }) => adminApi.createSurvey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
      navigate('/admin/surveys');
    },
  });

  const addQuestion = () => {
    setQuestions((q) => [...q, { prompt: '' }]);
  };

  const updateQuestion = (index: number, prompt: string) => {
    setQuestions((q) => {
      const next = [...q];
      next[index] = { prompt };
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((q) => q.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programId || !title.trim()) return;
    const qs = questions
      .filter((q) => q.prompt.trim())
      .map((q, i) => ({ id: `q${i}`, type: 'text', prompt: q.prompt }));
    const basePayload = {
      programId,
      title: title.trim(),
      description: description.trim() || undefined,
      jotformFormId: jotformFormId.trim() || undefined,
    };
    if (qs.length === 0) {
      createMutation.mutate({
        ...basePayload,
        questions: [{ id: 'q0', type: 'text', prompt: 'Default question' }],
      });
    } else {
      createMutation.mutate({
        ...basePayload,
        questions: qs,
      });
    }
  };

  if (programsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const programOptions = programs ?? [];

  return (
    <div className="mx-auto w-full max-w-[min(100%,100rem)] space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Survey</h1>
        <p className="text-sm text-gray-600 mt-1">
          Design surveys to gather feedback from healthcare professionals.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Create New Survey</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Program *
              </label>
              <select
                required
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              >
                <option value="">Select program</option>
                {programOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {programOptions.length === 0 && (
                <p className="mt-1 text-sm text-amber-600">
                  No programs yet. Create a program first via Schedule Webinar.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Survey Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Patient Experience Survey"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description of what this survey is about..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Jotform Form ID <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={jotformFormId}
                onChange={(e) => setJotformFormId(e.target.value)}
                placeholder="e.g., 260698533879881 - from communityhealthmedia.jotform.com/build/..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Link an existing Jotform form. Ensure the form has the webhook and Hidden Box (user_id) configured.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Questions *</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-xl border border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900 inline-flex items-center gap-2 hover:bg-gray-50"
            >
              + Add Question
            </button>
          </div>
          {questions.map((q, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 flex gap-2"
            >
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Question {i + 1}
                </label>
                <input
                  type="text"
                  value={q.prompt}
                  onChange={(e) => updateQuestion(i, e.target.value)}
                  placeholder="Enter your question..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {createMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            Failed to create survey. Please try again.
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/surveys')}
            className="rounded-xl border border-blue-600 bg-white px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !programId || !title.trim()}
            className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Survey'}
          </button>
        </div>
      </form>
    </div>
  );
}
