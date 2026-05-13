import { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import type { OfficeHoursSlotOption } from '../../api/programs';
import { Clock } from 'lucide-react';

type SlotGroup = { day: Date; slots: OfficeHoursSlotOption[] };

function groupSlotsByDay(slots: OfficeHoursSlotOption[]): SlotGroup[] {
  const sorted = [...slots].sort((a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime());
  const groups: SlotGroup[] = [];
  for (const s of sorted) {
    const day = parseISO(s.startsAt);
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.day, day)) {
      last.slots.push(s);
    } else {
      groups.push({ day, slots: [s] });
    }
  }
  return groups;
}

export interface OfficeHoursSlotPickerProps {
  slots: OfficeHoursSlotOption[];
  selectedId?: string;
  onSelect: (slotId: string) => void;
  /** Shown under the title (e.g. timezone note) */
  subtitle?: string;
}

/**
 * 10-minute registration windows: one dropdown per day (sessions are usually a single day).
 * Booking still uses the program’s Zoom link after registration.
 */
export function OfficeHoursSlotPicker({
  slots,
  selectedId,
  onSelect,
  subtitle,
}: OfficeHoursSlotPickerProps) {
  const groups = useMemo(() => groupSlotsByDay(slots), [slots]);

  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
        No time slots are open yet. Check back later or contact the host.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">Select a 10-minute window</h3>
        <p className="text-sm text-gray-600">
          {subtitle ??
            'Each option is a 10-minute segment within the session. You still join the host in Zoom from this app after you register.'}
        </p>
      </div>

      {groups.map(({ day, slots: daySlots }) => (
        <section key={day.toISOString()} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Clock className="h-4 w-4 text-gray-400" aria-hidden />
            <p className="text-sm font-semibold text-gray-900">{format(day, 'EEEE, MMMM d, yyyy')}</p>
          </div>

          <label className="block max-w-md">
            <span className="sr-only">Choose a start time</span>
            <select
              value={selectedId && daySlots.some((s) => s.id === selectedId) ? selectedId : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onSelect(v);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            >
              <option value="">Choose a time…</option>
              {daySlots.map((s) => {
                const start = parseISO(s.startsAt);
                const end = parseISO(s.endsAt);
                const full = s.remaining <= 0;
                const timeLabel = `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
                const suffix =
                  full ? ' (full)' : s.remaining < s.maxAttendees ? ` · ${s.remaining} left` : '';
                return (
                  <option key={s.id} value={s.id} disabled={full}>
                    {timeLabel}
                    {s.label ? ` · ${s.label}` : ''}
                    {suffix}
                  </option>
                );
              })}
            </select>
          </label>
        </section>
      ))}
    </div>
  );
}
