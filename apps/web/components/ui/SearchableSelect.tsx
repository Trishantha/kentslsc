'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export interface SearchableSelectGroup {
  name: string;
  emoji?: string;
  options: { value: string; label: string }[];
}

interface SearchableSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  groups: SearchableSelectGroup[];
  className?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  onBlur,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  groups,
  className = '',
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    for (const group of groups) {
      const option = group.options.find((o) => o.value === value);
      if (option) return { group, option };
    }
    return null;
  }, [value, groups]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter(
          (option) =>
            option.label.toLowerCase().includes(normalizedQuery) ||
            group.name.toLowerCase().includes(normalizedQuery)
        )
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onBlur?.();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when opening
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onBlur]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
    onBlur?.();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      onBlur?.();
    }
  };

  const displayLabel = selectedOption
    ? `${selectedOption.group.emoji ? `${selectedOption.group.emoji} ` : ''}${selectedOption.option.label}`
    : '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex w-full items-center rounded-lg border border-white/10 bg-white/10 focus-within:border-neon-blue">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((open) => !open)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="flex flex-1 items-center justify-between px-4 py-2.5 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={selectedOption ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
            {selectedOption ? displayLabel : placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {selectedOption && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="mr-3 rounded p-0.5 outline-none hover:bg-white/10 focus:border-neon-blue disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl ring-1 ring-black/5 dark:bg-slate-900">
          <div className="relative border-b border-white/10 p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-neon-blue"
            />
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-400">No options found.</div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.name} className="mb-1">
                  <div className="sticky top-0 z-10 bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group.emoji ? `${group.emoji} ` : ''}
                    {group.name}
                  </div>
                  {group.options.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'bg-neon-blue/20 text-neon-blue'
                            : 'text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
