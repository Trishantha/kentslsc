'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';

interface PaymentSettings {
  provider: 'stripe' | 'paypal';
  hasStripeSecretKey: boolean;
  hasStripeWebhookSecret: boolean;
  hasStripePublishableKey: boolean;
  hasPaypalClientId: boolean;
  hasPaypalClientSecret: boolean;
  paypalApiBaseUrl: string;
  processingFeeEnabled: boolean;
  processingFeePercent: number;
  processingFeeFixed: number;
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs text-slate-500';

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PaymentSettings>({
    queryKey: ['payments-settings'],
    queryFn: async () => (await api.get('/payments/settings')).data
  });

  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalApiBaseUrl, setPaypalApiBaseUrl] = useState('https://api-m.sandbox.paypal.com');
  const [processingFeeEnabled, setProcessingFeeEnabled] = useState(true);
  const [processingFeePercent, setProcessingFeePercent] = useState(1.5);
  const [processingFeeFixed, setProcessingFeeFixed] = useState(20);

  useEffect(() => {
    if (data) {
      setProvider(data.provider);
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      setStripePublishableKey('');
      setPaypalClientId('');
      setPaypalClientSecret('');
      setPaypalApiBaseUrl(data.paypalApiBaseUrl ?? 'https://api-m.sandbox.paypal.com');
      setProcessingFeeEnabled(data.processingFeeEnabled ?? true);
      setProcessingFeePercent(data.processingFeePercent ?? 1.5);
      setProcessingFeeFixed(data.processingFeeFixed ?? 20);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: Partial<PaymentSettings>) => {
      const { data } = await api.put('/payments/settings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-settings'] });
    }
  });

  const handleSave = () => {
    const payload: Partial<PaymentSettings> & {
      stripeSecretKey?: string;
      stripeWebhookSecret?: string;
      stripePublishableKey?: string;
      paypalClientId?: string;
      paypalClientSecret?: string;
      provider: 'stripe' | 'paypal';
      paypalApiBaseUrl: string;
      processingFeeEnabled: boolean;
      processingFeePercent: number;
      processingFeeFixed: number;
    } = {
      provider,
      paypalApiBaseUrl,
      processingFeeEnabled,
      processingFeePercent,
      processingFeeFixed
    };

    if (stripeSecretKey.trim()) payload.stripeSecretKey = stripeSecretKey.trim();
    if (stripeWebhookSecret.trim()) payload.stripeWebhookSecret = stripeWebhookSecret.trim();
    if (stripePublishableKey.trim()) payload.stripePublishableKey = stripePublishableKey.trim();
    if (paypalClientId.trim()) payload.paypalClientId = paypalClientId.trim();
    if (paypalClientSecret.trim()) payload.paypalClientSecret = paypalClientSecret.trim();

    mutation.mutate({
      ...payload
    });
  };

  if (isLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-neon-blue" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-neon-blue" />
        <div>
          <h1 className="section-title">Payments</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Configure the payment provider, API keys, and webhook signing settings used across memberships, directories, fundraisers, and events.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card space-y-5 p-6">
          <div>
            <label className={labelClass}>Default provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as 'stripe' | 'paypal')} className={inputClass}>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>

          {provider === 'stripe' ? (
            <>
              <div>
                <label className={labelClass}>Stripe secret key</label>
                <input value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)} className={inputClass} placeholder="sk_live_..." />
                <p className="mt-1 text-xs text-slate-500">{data?.hasStripeSecretKey ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
              <div>
                <label className={labelClass}>Stripe webhook secret</label>
                <input value={stripeWebhookSecret} onChange={(e) => setStripeWebhookSecret(e.target.value)} className={inputClass} placeholder="whsec_..." />
                <p className="mt-1 text-xs text-slate-500">{data?.hasStripeWebhookSecret ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
              <div>
                <label className={labelClass}>Stripe publishable key</label>
                <input value={stripePublishableKey} onChange={(e) => setStripePublishableKey(e.target.value)} className={inputClass} placeholder="pk_live_..." />
                <p className="mt-1 text-xs text-slate-500">{data?.hasStripePublishableKey ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelClass}>PayPal client ID</label>
                <input value={paypalClientId} onChange={(e) => setPaypalClientId(e.target.value)} className={inputClass} placeholder="PayPal client ID" />
                <p className="mt-1 text-xs text-slate-500">{data?.hasPaypalClientId ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
              <div>
                <label className={labelClass}>PayPal client secret</label>
                <input value={paypalClientSecret} onChange={(e) => setPaypalClientSecret(e.target.value)} className={inputClass} placeholder="PayPal secret" />
                <p className="mt-1 text-xs text-slate-500">{data?.hasPaypalClientSecret ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
              <div>
                <label className={labelClass}>PayPal API base URL</label>
                <input value={paypalApiBaseUrl} onChange={(e) => setPaypalApiBaseUrl(e.target.value)} className={inputClass} placeholder="https://api-m.sandbox.paypal.com" />
              </div>
            </>
          )}

          <div className="border-t border-white/10 pt-5">
            <h3 className="mb-3 text-sm font-semibold">Processing fee</h3>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={processingFeeEnabled}
                onChange={(e) => setProcessingFeeEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-neon-blue"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Pass card processing fees to the payer
              </span>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              When enabled, the fee is added on top of the advertised price so the club receives the full amount.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Percentage fee (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={processingFeePercent}
                  onChange={(e) => setProcessingFeePercent(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fixed fee (pence)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={processingFeeFixed}
                  onChange={(e) => setProcessingFeeFixed(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleSave} disabled={mutation.isPending} className="btn-primary inline-flex items-center gap-2">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" /> Save payment settings
          </button>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold">Setup checklist</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li>• Add the Stripe or PayPal webhook endpoints in your payment dashboard.</li>
            <li>• Use the same callback URLs as your site frontend for success and cancel states.</li>
            <li>• Keep the provider set to the gateway you want as the default for new checkout sessions.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
