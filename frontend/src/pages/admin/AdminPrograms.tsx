import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Video,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { adminApi, type AdminWebinar, type UpdateWebinarPayload, type ZoomSessionType } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminPrograms() {
  const location = useLocation();
  const isOfficeHours = location.pathname.includes('/office-hours');
  const zoomFilter: ZoomSessionType = isOfficeHours ? 'MEETING' : 'WEBINAR';

  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: webinars, isLoading, error } = useQuery({
    queryKey: ['admin', 'webinars', zoomFilter],
    queryFn: () => adminApi.getWebinars({ zoomSessionType: zoomFilter }),
    staleTime: 30 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteWebinar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
      setDeleteConfirmId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Failed to load {isOfficeHours ? 'Office Hours' : 'webinars'}. Please try again.
      </div>
    );
  }

  const items = webinars ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isOfficeHours ? 'Office Hours' : 'Webinars'}
          </h1>
          <p className="text-sm text-gray-600">
            {isOfficeHours
              ? 'Live sessions for Q&A - host admits participants. Manage CHM Office Hours here.'
              : 'Schedule and manage LIVE sessions.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOfficeHours ? (
            <Link
              to="/admin/programs"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              Webinars
            </Link>
          ) : (
            <Link
              to="/admin/office-hours"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              Office Hours
            </Link>
          )}
          <Link
            to={isOfficeHours ? '/admin/office-hours-scheduler' : '/admin/webinar-scheduler'}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            <Calendar className="h-4 w-4" />
            {isOfficeHours ? 'Schedule Office Hours' : 'Schedule webinar'}
          </Link>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Delete {isOfficeHours ? 'Office Hours session' : 'webinar'}?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently remove the session. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="ml-4 shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <EditWebinarModal
          webinar={items.find((w) => w.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'webinars'] });
            setEditingId(null);
          }}
        />
      )}

      {/* Table */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center">
          <Video className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-900">
            {isOfficeHours ? 'No Office Hours scheduled' : 'No webinars yet'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {isOfficeHours
              ? 'Create a new CHM Office Hours session for interactive Q&A.'
              : 'Schedule your first LIVE session.'}
          </p>
          <Link
            to={isOfficeHours ? '/admin/office-hours-scheduler' : '/admin/webinar-scheduler'}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            <Calendar className="h-4 w-4" /> {isOfficeHours ? 'Schedule Office Hours' : 'Schedule webinar'}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  {isOfficeHours ? 'Session' : 'Webinar'}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">Date & Time</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Sponsor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">Zoom</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((w) => (
                <WebinarRow
                  key={w.id}
                  webinar={w}
                  onEdit={() => setEditingId(w.id)}
                  onDelete={() => setDeleteConfirmId(w.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function WebinarRow({
  webinar,
  onEdit,
  onDelete,
}: {
  webinar: AdminWebinar;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const openMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const dateStr = webinar.startDate
    ? format(parseISO(webinar.startDate), 'MMM d, yyyy · h:mm a')
    : '-';

  const durationStr = webinar.duration
    ? webinar.duration < 60
      ? `${webinar.duration} min`
      : `${Math.floor(webinar.duration / 60)}h${webinar.duration % 60 ? ` ${webinar.duration % 60}m` : ''}`
    : null;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 line-clamp-1">{webinar.title}</p>
        {durationStr && (
          <p className="text-xs text-gray-400 mt-0.5">{durationStr}</p>
        )}
      </td>

      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell whitespace-nowrap">
        {dateStr}
      </td>

      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
        {webinar.sponsorName}
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={webinar.status} />
      </td>

      <td className="px-4 py-3 hidden lg:table-cell">
        {webinar.zoomMeetingId ? (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
              <Video className="h-3 w-3" />
              #{webinar.zoomMeetingId}
            </span>
            {webinar.zoomJoinUrl && (
              <a
                href={webinar.zoomJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Join link
              </a>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">No Zoom</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <button
          ref={buttonRef}
          onClick={openMenu}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="w-36 rounded-xl border border-gray-200 bg-white shadow-lg py-1"
          >
            <Link
              to={`/admin/programs/${webinar.id}/hub`}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Program hub
            </Link>
            <button
              onClick={() => { setMenuOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditWebinarModal({
  webinar,
  onClose,
  onSaved,
}: {
  webinar: AdminWebinar;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sessionKind = webinar.zoomSessionType ?? 'WEBINAR';
  const localDate = webinar.startDate
    ? format(parseISO(webinar.startDate), "yyyy-MM-dd'T'HH:mm")
    : '';

  const [title, setTitle] = useState(webinar.title);
  const [description, setDescription] = useState(webinar.description);
  const [sponsorName, setSponsorName] = useState(webinar.sponsorName);
  const [startDate, setStartDate] = useState(localDate);
  const [duration, setDuration] = useState(String(webinar.duration ?? ''));
  const [status, setStatus] = useState<AdminWebinar['status']>(webinar.status);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateWebinarPayload) => adminApi.updateWebinar(webinar.id, payload),
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message || 'Failed to save. Please try again.'),
  });

  const handleSave = () => {
    if (!title.trim()) { setError('Title is required.'); return; }

    const durationNum = duration ? parseInt(duration, 10) : undefined;
    if (duration && (isNaN(durationNum!) || durationNum! < 1 || durationNum! > 480)) {
      setError('Duration must be between 1 and 480 minutes.');
      return;
    }

    if (startDate) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) { setError('Invalid date and time.'); return; }
    }

    setError(null);
    const payload: UpdateWebinarPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      sponsorName: sponsorName.trim() || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      duration: durationNum,
      status,
    };
    updateMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {sessionKind === 'MEETING' ? 'Edit Office Hours' : 'Edit webinar'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sponsor</label>
              <input
                type="text"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminWebinar['status'])}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duration (min)</label>
              <input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          {webinar.zoomMeetingId && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              Changes to title, date, and duration will also be synced to Zoom{' '}
              {sessionKind === 'MEETING' ? 'Meeting' : 'webinar'} #{webinar.zoomMeetingId}.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 inline-flex items-center gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AdminWebinar['status'] }) {
  const map: Record<AdminWebinar['status'], { label: string; cls: string }> = {
    PUBLISHED: { label: 'Live', cls: 'bg-green-50 text-green-700 border-green-200' },
    DRAFT:     { label: 'Draft', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    ARCHIVED:  { label: 'Archived', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
