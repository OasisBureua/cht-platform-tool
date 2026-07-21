import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  adminKolApi,
  uploadHeadshotToS3,
  type AdminKolUpdate,
} from '../../../../api/admin-kol';
import { getApiErrorMessage } from '../../../../api/client';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';
import { Input } from './Input';
import type { PublicKol } from '../../../../api/kol-network';

interface Props {
  slug: string;
  kol: Pick<
    PublicKol,
    'name' | 'title' | 'specialty' | 'institution' | 'bio' | 'photo_url' | 'region'
  > & {
    display_order?: number | null;
    featured?: boolean;
  };
  onClose: () => void;
  onSaved: () => void;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * SCRUM-69: admin edit form for one KOL. All fields optional (Content Hub's
 * KOLAdminUpdate schema); omitted fields untouched. Photo upload is a
 * presign → S3 PUT → PATCH photo_url roundtrip. On save, invokes onSaved so
 * the parent can invalidate its KOL query.
 */
export function EditKolModal({ slug, kol, onClose, onSaved }: Props) {
  const [form, setForm] = useState<AdminKolUpdate>({
    title: kol.title,
    specialty: kol.specialty,
    institution: kol.institution,
    bio: kol.bio,
    photo_url: kol.photo_url,
    region: kol.region,
    display_order: kol.display_order ?? null,
    featured: kol.featured ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving && !uploading) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, uploading]);

  function patch<K extends keyof AdminKolUpdate>(key: K, value: AdminKolUpdate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) {
      setError('Photo must be JPEG, PNG, or WebP.');
      return;
    }
    setUploading(true);
    try {
      const presign = await adminKolApi.presignHeadshot(slug, file.type);
      await uploadHeadshotToS3(presign, file);
      patch('photo_url', presign.photo_url);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Photo upload failed.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await adminKolApi.patch(slug, form);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || uploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${kol.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-lg font-semibold text-foreground">Edit {kol.name}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          <Field label="Title">
            <Input
              value={form.title ?? ''}
              onChange={(e) => patch('title', e.target.value || null)}
              placeholder="MD, Professor of Oncology"
            />
          </Field>
          <Field label="Specialty">
            <Input
              value={form.specialty ?? ''}
              onChange={(e) => patch('specialty', e.target.value || null)}
              placeholder="Medical oncology"
            />
          </Field>
          <Field label="Institution">
            <Input
              value={form.institution ?? ''}
              onChange={(e) => patch('institution', e.target.value || null)}
              placeholder="Dana-Farber Cancer Institute"
            />
          </Field>
          <Field label="Region">
            <Input
              value={form.region ?? ''}
              onChange={(e) => patch('region', e.target.value || null)}
              placeholder="northeast"
            />
          </Field>
          <Field label="Bio">
            <textarea
              value={form.bio ?? ''}
              onChange={(e) => patch('bio', e.target.value || null)}
              rows={3}
              className="w-full rounded-input border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Short bio for the KOL profile page."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Display order">
              <Input
                type="number"
                min={0}
                value={form.display_order ?? ''}
                onChange={(e) =>
                  patch(
                    'display_order',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
                placeholder="1"
              />
            </Field>
            <Field label="Featured">
              <label className="flex h-10 items-center gap-2 rounded-input border border-input bg-card px-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.featured ?? false}
                  onChange={(e) => patch('featured', e.target.checked)}
                />
                <span className="text-foreground">Show as featured</span>
              </label>
            </Field>
          </div>

          <Field label="Headshot">
            <div className="flex items-center gap-3">
              {form.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.photo_url}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFile}
                disabled={uploading}
                className="text-xs text-muted-foreground file:mr-3 file:rounded-input file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </Field>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
