import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { adminApi } from '../../api/admin';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type SessionHeroImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  /** Larger labels (scheduler); default false uses compact modal styling */
  spacious?: boolean;
};

export function SessionHeroImageField({
  value,
  onChange,
  spacious = false,
}: SessionHeroImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: adminConfig } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getAdminConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const uploadEnabled = adminConfig?.sessionHeroUploadEnabled === true;

  const labelCls = spacious
    ? 'block text-sm font-semibold text-foreground mb-1'
    : 'block text-xs font-semibold text-muted-foreground mb-1';

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError(null);
    if (!file) return;

    const ct = file.type.trim().toLowerCase();
    if (!ct || !ALLOWED_TYPES.includes(ct as (typeof ALLOWED_TYPES)[number])) {
      setUploadError('Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be between 1 byte and 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await adminApi.presignSessionHeroUpload({
        contentType: ct,
        contentLength: file.size,
        fileName: file.name,
      });
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': ct },
        body: file,
      });
      if (!res.ok) {
        throw new Error(`Upload failed (${res.status}).`);
      }
      onChange(publicUrl);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Upload failed. Try again or paste a URL.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className={labelCls}>
        Session banner image <span className="font-normal text-muted-foreground">, optional</span>
      </label>

      {uploadEnabled ? (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              'Upload to storage'
            )}
          </button>
          {uploadError ? (
            <span className="text-xs text-destructive">{uploadError}</span>
          ) : null}
        </div>
      ) : null}

      <input
        type="url"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={
          uploadEnabled
            ? 'Or paste a public HTTPS image URL'
            : spacious
              ? 'https://cdn.example.com/session-banner.png'
              : 'https://…'
        }
        className={`w-full rounded-card border border-border px-4 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 ${spacious ? 'py-3' : 'py-2.5'}`}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {uploadEnabled
          ? 'Uploaded images are stored in your session assets bucket; learners load this URL on registration and the session page. You can still paste an external CDN link instead.'
          : 'Paste a public HTTPS image URL. When uploads are configured on the server, an upload button appears here.'}
      </p>
    </div>
  );
}
