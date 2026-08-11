'use client';

import { useState } from 'react';
import { Loader2, Heart, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

interface Props {
  fundraiserId: string;
  onSuccess?: () => void;
}

export function DonationForm({ fundraiserId }: Props) {
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedAmount = amount || customAmount;

  const handlePreset = (val: number) => {
    setAmount(String(val));
    setCustomAmount('');
  };

  const handleCustom = (val: string) => {
    setCustomAmount(val);
    setAmount('');
  };

  const handleDonate = async () => {
    const value = Number(selectedAmount);
    if (!value || value < 1) {
      setError('Please enter a valid amount (minimum £1).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/fundraisers/${fundraiserId}/donate`, {
        fundraiserId,
        amount: value,
        displayName: isAnonymous ? undefined : (displayName.trim() || undefined),
        message: message.trim() || undefined,
        isAnonymous
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {
      setError('Could not start donation. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preset amounts */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Choose an amount
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handlePreset(val)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                amount === String(val)
                  ? 'border-neon-blue bg-neon-blue/10 text-neon-blue'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              £{val}
            </button>
          ))}
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Other"
            value={customAmount}
            onChange={(e) => handleCustom(e.target.value)}
            className={`w-24 rounded-xl border px-4 py-2 text-sm outline-none transition-colors ${
              customAmount
                ? 'border-neon-blue bg-neon-blue/10'
                : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
            } text-slate-900 dark:text-slate-100`}
          />
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Your name <span className="text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          maxLength={100}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={isAnonymous}
          placeholder={isAnonymous ? 'Donating anonymously' : 'e.g. Jane Smith'}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-neon-blue disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Message */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Leave a message <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          maxLength={500}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share why you're supporting this campaign..."
          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <p className="mt-0.5 text-right text-xs text-slate-400">{message.length}/500</p>
      </div>

      {/* Anonymous toggle */}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="h-4 w-4 rounded accent-neon-blue"
        />
        <EyeOff className="h-4 w-4 text-slate-500" />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Donate anonymously — your name won&apos;t appear publicly
        </span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleDonate}
        disabled={loading || !selectedAmount}
        className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5" />}
        {loading ? 'Redirecting to payment…' : `Donate${selectedAmount ? ` £${selectedAmount}` : ''}`}
      </button>
      <p className="text-center text-xs text-slate-400">
        Secure payment via Stripe. You&apos;ll be redirected to complete your donation.
      </p>
    </div>
  );
}
