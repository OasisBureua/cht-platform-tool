export function formatCount(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
