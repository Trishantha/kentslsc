'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  startDatetime: string;
  category?: EventCategory | string;
}

interface Props {
  events: CalendarEvent[];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function getCalendarDays(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  // Monday-based offset: 0 = Monday, 6 = Sunday
  const startDay = (start.getDay() + 6) % 7;
  const firstCalendarDay = addDays(start, -startDay);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(firstCalendarDay, i));
  }
  return days;
}

const monthLabels = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EventCalendar({ events }: Props) {
  const [month, setMonth] = useState(new Date().getFullYear() * 12 + new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const currentMonthDate = useMemo(() => new Date(Math.floor(month / 12), month % 12, 1), [month]);
  const calendarDays = useMemo(() => getCalendarDays(currentMonthDate), [currentMonthDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = startOfDay(new Date(event.startDatetime));
      const key = start.toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const today = startOfDay(new Date());
  const selectedEvents = selectedDay
    ? eventsByDay.get(selectedDay.toISOString().slice(0, 10)) ?? []
    : [];

  const nextMonth = () => setMonth((m) => m + 1);
  const prevMonth = () => setMonth((m) => m - 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {monthLabels[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
        {weekdayLabels.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const key = day.toISOString().slice(0, 10);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonthDate.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

          return (
            <button
              key={index}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-start rounded-xl border p-2 transition hover:bg-white/5',
                isCurrentMonth
                  ? 'border-white/10 bg-white/5'
                  : 'border-transparent text-slate-500 dark:text-slate-500',
                isToday && 'ring-1 ring-neon-blue',
                isSelected && 'bg-white/10'
              )}
            >
              <span className={cn('text-sm font-medium', isCurrentMonth ? '' : 'opacity-60')}>
                {day.getDate()}
              </span>
              <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      eventCategoryColors[event.category as EventCategory] ?? eventCategoryColors[EventCategory.OTHER]
                    )}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] leading-3 text-slate-500">+</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="glass-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Events on {selectedDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between rounded-lg bg-white/5 p-3 hover:bg-white/10"
                >
                  <span className="font-medium">{event.title}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      eventCategoryColors[event.category as EventCategory] ?? eventCategoryColors[EventCategory.OTHER]
                    )}
                  >
                    {eventCategoryLabels[event.category as EventCategory] ?? eventCategoryLabels[EventCategory.OTHER]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
