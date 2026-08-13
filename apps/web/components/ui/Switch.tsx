'use client';

import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-3',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <div
          className={cn(
            'h-6 w-11 rounded-full transition-colors',
            checked ? 'bg-neon-blue shadow-neon' : 'bg-slate-300 dark:bg-slate-700'
          )}
        />
        <div
          className={cn(
            'absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </div>
      {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
    </label>
  );
}
