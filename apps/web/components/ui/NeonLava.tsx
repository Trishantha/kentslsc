'use client';

import { cn } from '@/lib/utils';

interface NeonLavaProps {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'strong';
}

const intensityMap = {
  subtle: 'opacity-40',
  normal: 'opacity-60',
  strong: 'opacity-80'
};

export default function NeonLava({ className, intensity = 'normal' }: NeonLavaProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Dark base so navbar text stays readable */}
      <div className="absolute inset-0 bg-slate-950/60" />

      {/* Flowing neon blobs */}
      <div
        className={cn(
          'absolute -left-[10%] -top-[20%] h-[140%] w-[50%] rounded-full bg-neon-blue blur-[80px]',
          intensityMap[intensity]
        )}
        style={{
          animation: 'lava-drift-1 22s ease-in-out infinite alternate, lava-morph 10s ease-in-out infinite alternate'
        }}
      />
      <div
        className={cn(
          'absolute -right-[10%] -top-[10%] h-[120%] w-[45%] rounded-full bg-neon-purple blur-[90px]',
          intensityMap[intensity]
        )}
        style={{
          animation: 'lava-drift-2 25s ease-in-out infinite alternate, lava-morph 12s ease-in-out infinite alternate-reverse'
        }}
      />
      <div
        className={cn(
          'absolute -bottom-[30%] left-[20%] h-[100%] w-[40%] rounded-full bg-neon-gold blur-[70px]',
          intensityMap[intensity]
        )}
        style={{
          animation: 'lava-drift-3 20s ease-in-out infinite alternate, lava-morph 9s ease-in-out infinite alternate'
        }}
      />
      <div
        className={cn(
          'absolute -bottom-[20%] right-[25%] h-[90%] w-[35%] rounded-full bg-rose-500 blur-[75px]',
          intensityMap[intensity]
        )}
        style={{
          animation: 'lava-drift-4 24s ease-in-out infinite alternate, lava-morph 11s ease-in-out infinite alternate-reverse'
        }}
      />
    </div>
  );
}
