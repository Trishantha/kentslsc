export interface CalendarEventDetails {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDatetime: string;
  endDatetime: string;
}

function toIcsDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

export function generateIcs(event: CalendarEventDetails) {
  const start = toIcsDate(event.startDatetime);
  const end = toIcsDate(event.endDatetime);
  const description = event.description ? escapeIcsText(event.description.replace(/<[^>]+>/g, '')) : '';
  const location = event.location ? escapeIcsText(event.location) : '';
  const url = `https://kentslsc.org/events/${event.id}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kent Sri Lankan Social Club//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@kentslsc.org`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    ...(location ? [`LOCATION:${location}`] : []),
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return lines.join('\r\n');
}

export function downloadIcs(event: CalendarEventDetails, filename?: string) {
  const ics = generateIcs(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${event.title.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toGoogleCalendarDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export function getGoogleCalendarUrl(event: CalendarEventDetails) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleCalendarDate(event.startDatetime)}/${toGoogleCalendarDate(event.endDatetime)}`,
    details: event.description ? event.description.replace(/<[^>]+>/g, '') : '',
    location: event.location || '',
    sprop: 'name:Kent Sri Lankan Social Club'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getOutlookCalendarUrl(event: CalendarEventDetails) {
  const params = new URLSearchParams({
    subject: event.title,
    startdt: event.startDatetime,
    enddt: event.endDatetime,
    body: event.description ? event.description.replace(/<[^>]+>/g, '') : '',
    location: event.location || ''
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function getAppleCalendarUrl(event: CalendarEventDetails) {
  // Apple Calendar does not support a web URL to add events directly;
  // we return a webcal-compatible .ics data URI as a fallback.
  const ics = generateIcs(event);
  const blob = new Blob([ics], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
}
