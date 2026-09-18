'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SiteLogoLoaderProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function SiteLogoLoader({ className, size = 96, showText = true }: SiteLogoLoaderProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-5', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer rotating neon ring */}
        <div
          className="animate-kslsc-spin absolute inset-[-8px] rounded-full border-[3px] border-transparent"
          style={{
            borderTopColor: '#00b894',
            borderBottomColor: '#ffd700',
            boxShadow: '0 0 24px rgba(0, 184, 148, 0.35), inset 0 0 24px rgba(255, 215, 0, 0.15)'
          }}
        />

        {/* Inner counter-rotating ring */}
        <div
          className="animate-kslsc-spin-reverse absolute inset-[-4px] rounded-full border-2 border-transparent"
          style={{
            borderRightColor: '#ffd700',
            borderLeftColor: '#00b894'
          }}
        />

        {/* Soft pulsing glow behind the logo */}
        <div
          className="animate-loader-glow absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(0, 184, 148, 0.22) 0%, rgba(255, 215, 0, 0.06) 50%, transparent 70%)'
          }}
        />

        {/* Logo */}
        <div className="animate-loader-logo-pulse relative z-10 h-full w-full overflow-hidden rounded-full bg-slate-50 shadow-xl dark:bg-slate-950">
          <Image
            src="/logo-v2.png"
            alt="Kent SLSC"
            width={size}
            height={size}
            className="h-full w-full rounded-full object-contain p-1"
            priority
          />
        </div>
      </div>

      {showText && (
        <div className="animate-fade-in-up flex flex-col items-center gap-1">
          <span className="font-futuristic text-lg tracking-wide text-slate-800 dark:text-slate-100">
            KENT <span className="text-neon-gold">SLSC</span>
          </span>
          <span className="animate-loader-text-blink text-xs font-medium uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Loading
          </span>
        </div>
      )}
    </div>
  );
}
