'use client';

import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventLocationLinkProps {
  location: string;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
}

export function getMapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export default function EventLocationLink({
  location,
  className,
  iconClassName,
  showIcon = true
}: EventLocationLinkProps) {
  return (
    <a
      href={getMapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-start gap-2 text-sm transition hover:text-neon-blue hover:underline',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0 text-neon-gold', iconClassName)} />}
      <span>{location}</span>
    </a>
  );
}
