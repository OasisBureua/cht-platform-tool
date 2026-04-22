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
 * Calendly-style vertical time list: one row per start time (e.g. 12:00pm, 12:30pm).
 * Booking still uses the program’s Zoom link after registration — this UI is only for choosing a slot.
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
        <h3 className="text-base font-semibold text-gray-900">Select a time</h3>
        <p className="text-sm text-gray-600">
          {subtitle ??
            'Pick a start time (like a calendar scheduler). You still join the host in Zoom from this app — not a Calendly link.'}
        </p>
      </div>

      {groups.map(({ day, slots: daySlots }) => (
        <section key={day.toISOString()} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Clock className="h-4 w-4 text-gray-400" aria-hidden />
            <p className="text-sm font-semibold text-gray-900">{format(day, 'EEEE, MMMM d, yyyy')}</p>
          </div>

          <div className="flex flex-col gap-2 max-w-sm">
            {daySlots.map((s) => {
              const start = parseISO(s.startsAt);
              const end = parseISO(s.endsAt);
              const full = s.remaining <= 0;
              const selected = selectedId === s.id;
              const timeLabel = format(start, 'h:mm a');
              const endLabel = format(end, 'h:mm a');

              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={full}
                  onClick={() => onSelect(s.id)}
                  className={[
                    'rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all',
                    full
                      ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400 line-through decoration-gray-400'
                      : selected
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm ring-2 ring-gray-900 ring-offset-2'
                        : 'border-gray-200 bg-white text-gray-900 hover:border-gray-900 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className="block">{timeLabel}</span>
                  <span
                    className={[
                      'mt-0.5 block text-xs font-normal',
                      full ? 'text-gray-400' : selected ? 'text-gray-200' : 'text-gray-500',
                    ].join(' ')}
                  >
                    {full ? 'Unavailable' : `Until ${endLabel}`}
                    {!full && s.remaining < s.maxAttendees ? ` · ${s.remaining} left` : null}
                    {s.label ? ` · ${s.label}` : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
