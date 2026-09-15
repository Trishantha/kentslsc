'use client';

import { motion } from 'framer-motion';
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
        <motion.div
          className="absolute inset-[-8px] rounded-full border-[3px] border-transparent"
          style={{
            borderTopColor: '#00b894',
            borderBottomColor: '#ffd700',
            boxShadow: '0 0 24px rgba(0, 184, 148, 0.35), inset 0 0 24px rgba(255, 215, 0, 0.15)'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />

        {/* Inner counter-rotating ring */}
        <motion.div
          className="absolute inset-[-4px] rounded-full border-2 border-transparent"
          style={{
            borderRightColor: '#ffd700',
            borderLeftColor: '#00b894'
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />

        {/* Soft pulsing glow behind the logo */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(0, 184, 148, 0.22) 0%, rgba(255, 215, 0, 0.06) 50%, transparent 70%)'
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Logo */}
        <motion.div
          className="relative z-10 h-full w-full overflow-hidden rounded-full bg-slate-50 shadow-xl dark:bg-slate-950"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Image
            src="/logo-v2.png"
            alt="Kent SLSC"
            width={size}
            height={size}
            className="h-full w-full rounded-full object-contain p-1"
            priority
          />
        </motion.div>
      </div>

      {showText && (
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className="font-futuristic text-lg tracking-wide text-slate-800 dark:text-slate-100">
            KENT <span className="text-neon-gold">SLSC</span>
          </span>
          <motion.span
            className="text-xs font-medium uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            Loading
          </motion.span>
        </motion.div>
      )}
    </div>
  );
}
