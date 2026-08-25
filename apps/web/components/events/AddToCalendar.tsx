'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarPlus, Download, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type CalendarEventDetails,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getAppleCalendarUrl,
  downloadIcs
} from '@/lib/calendar';
import { cn } from '@/lib/utils';

interface Props {
  event: CalendarEventDetails;
  className?: string;
  variant?: 'default' | 'outline';
}

export default function AddToCalendar({ event, className, variant = 'default' }: Props) {
  const t = useTranslations('eventDetail');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    {
      label: 'Google Calendar',
      onClick: () => window.open(getGoogleCalendarUrl(event), '_blank', 'noopener,noreferrer')
    },
    {
      label: 'Outlook',
      onClick: () => window.open(getOutlookCalendarUrl(event), '_blank', 'noopener,noreferrer')
    },
    {
      label: 'Apple Calendar',
      onClick: () => {
        const url = getAppleCalendarUrl(event);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },
    {
      label: t('downloadIcs'),
      icon: Download,
      onClick: () => downloadIcs(event)
    }
  ];

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition',
          variant === 'default'
            ? 'bg-white/10 text-slate-700 hover:bg-white/20 dark:text-slate-200'
            : 'border border-white/10 bg-white/5 text-slate-600 hover:bg-white/10 dark:text-slate-300'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CalendarPlus className="h-4 w-4" />
        {t('addToCalendar')}
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-white/10 bg-slate-900 p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                option.onClick();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white/10 dark:text-slate-200"
            >
              {option.icon && <option.icon className="h-4 w-4 text-neon-blue" />}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
