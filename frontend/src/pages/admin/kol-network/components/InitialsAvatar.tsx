import { cn } from './cn';

/** "Dr. Jane Q. Public, MD" → "JP". Strips honorific + trailing credentials. */
export function nameInitials(name: string): string {
  const clean = name
    .replace(/^dr\.?\s+/i, '')
    .split(',')[0]
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

export function InitialsAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn('rounded-full bg-muted object-cover', className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-700 dark:bg-primary/20 dark:text-primary-300',
        className,
      )}
    >
      {nameInitials(name)}
    </div>
  );
}
