import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
) {
  if (!date) return 'TBC';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  }).format(d);
}

/** e.g. "September 2026" */
export function formatMonthYear(date: string | Date | null | undefined) {
  if (!date) return 'TBC';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return 'TBC';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function formatCurrency(amount: number | string | null | undefined) {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (value == null || Number.isNaN(value)) return '£0.00';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value);
}

export function getVideoMimeType(url: string): string | undefined {
  const match = url.match(/\.([^.?#]+)(?:[?#]|$)/i);
  switch (match?.[1]?.toLowerCase()) {
    case 'webm':
      return 'video/webm';
    case 'mp4':
      return 'video/mp4';
    case 'ogg':
    case 'ogv':
      return 'video/ogg';
    default:
      return undefined;
  }
}

/**
 * Convert an ISO-ish date string into the `datetime-local` input format
 * (YYYY-MM-DDTHH:mm). Returns an empty string for null/invalid values so a
 * form input never crashes on a bad date from the API.
 */
export function toDateTimeLocalInput(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}
