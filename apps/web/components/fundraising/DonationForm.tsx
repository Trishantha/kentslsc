'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Heart, EyeOff } from 'lucide-react';
import { calculateProcessingFee } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

interface Props {
  fundraiserId: string;
  onSuccess?: () => void;
}

export function DonationForm({ fundraiserId }: Props) {
  const router = useRouter();
  const t = useTranslations('common');
  const tFundraiser = useTranslations('fundraiserDetail');
  const { data: paymentSettings } = usePaymentSettings();
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedAmount = amount || customAmount;

  const feeBreakdown = useMemo(() => {
    const value = Number(selectedAmount);
    if (!value || value < 1 || !paymentSettings) return null;
    return calculateProcessingFee(Math.round(value * 100), {
      enabled: paymentSettings.processingFeeEnabled,
      percent: paymentSettings.processingFeePercent,
      fixed: paymentSettings.processingFeeFixed
    });
  }, [selectedAmount, paymentSettings]);

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
      if (res.data.clientSecret && res.data.id) {
        router.push(`/checkout?session_id=${res.data.id}&client_secret=${encodeURIComponent(res.data.clientSecret)}`);
        return;
      }
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {
      setError(tFundraiser('loginToDonateError'));
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

      {feeBreakdown && feeBreakdown.fee > 0 && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{t('donation')}</span>
            <span>{formatCurrency(feeBreakdown.net / 100)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{t('processingFee')}</span>
            <span>{formatCurrency(feeBreakdown.fee / 100)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700">
            <span>{t('total')}</span>
            <span>{formatCurrency(feeBreakdown.gross / 100)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleDonate}
        disabled={loading || !selectedAmount}
        className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5" />}
        {loading
          ? 'Redirecting to payment…'
          : `Donate${feeBreakdown ? ` ${formatCurrency(feeBreakdown.gross / 100)}` : selectedAmount ? ` £${selectedAmount}` : ''}`}
      </button>
      <p className="text-center text-xs text-slate-400">
        Secure payment via Stripe. You&apos;ll be redirected to complete your donation.
      </p>
    </div>
  );
}
