import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import ChromeContainer from './components/ChromeContainer';
import { useToast } from './components/Toaster';
import { useCreateTemplate, useDeleteTemplate, useTemplates } from './lib/hooks';

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'analytics', label: 'Analytics Report' },
  { value: 'executive', label: 'Executive Deck' },
  { value: 'sponsor', label: 'Sponsor-Specific' },
  { value: 'disease_state', label: 'Disease State' },
  { value: 'platform', label: 'Platform-Specific' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

const primaryButtonClasses =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 min-h-9 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground';

const inputClasses =
  'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground shadow-card transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

const labelClasses =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground';

export default function Templates() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('analytics');
  const [description, setDescription] = useState('');

  const { data: templates, isLoading } = useTemplates();

  const createMutation = useCreateTemplate();
  const deleteMutation = useDeleteTemplate();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || createMutation.isPending) return;
    createMutation.mutate(
      { name, type, description },
      {
        onSuccess: () => {
          setModalOpen(false);
          setName('');
          setType('analytics');
          setDescription('');
          toast({ title: 'Template created', description: 'Your template has been saved.' });
        },
        onError: (err: Error) =>
          toast({ title: 'Failed to create template', description: err.message, variant: 'destructive' }),
      },
    );
  }

  const remove = (id: number) =>
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: 'Template deleted' }),
      onError: (err: Error) =>
        toast({ title: 'Failed to delete template', description: err.message, variant: 'destructive' }),
    });

  return (
    <ChromeContainer>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/content-hub"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to reports"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Report Templates</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Save and reuse report layouts, sections, and settings across campaigns.
              </p>
            </div>
          </div>
          <button className={primaryButtonClasses} onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>

        {isLoading ? null : !templates || templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-24 text-center">
            <LayoutTemplate className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No templates yet</p>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Save a report layout as a template to speed up future reports.
            </p>
            <button className={`${primaryButtonClasses} mx-auto`} onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Template
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{template.name}</p>
                    <span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      {TYPE_LABELS[template.type] ?? template.type}
                    </span>
                  </div>
                  {template.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                  )}
                </div>
                <button
                  aria-label="Delete template"
                  className="flex-shrink-0 text-muted-foreground hover:text-accent"
                  onClick={() => remove(template.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-card-hover">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-semibold text-foreground">New Template</h2>
                <button
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form className="space-y-4 p-6" onSubmit={handleSubmit}>
                <div>
                  <label className={labelClasses}>
                    Template Name <span className="text-accent">*</span>
                  </label>
                  <input
                    className={inputClasses}
                    placeholder="e.g., Oncology Q4 Analytics"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Type</label>
                  <select
                    className={inputClasses}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Description</label>
                  <input
                    className={inputClasses}
                    placeholder="Optional: describe what this template is for"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    type="button"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${primaryButtonClasses} flex-1`}
                    type="submit"
                    disabled={createMutation.isPending}
                  >
                    Create Template
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ChromeContainer>
  );
}
