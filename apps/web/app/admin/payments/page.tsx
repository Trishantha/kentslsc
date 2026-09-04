'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, CreditCard } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';

interface ProcessingFeeConfig {
  enabled: boolean;
  percent: number;
  fixed: number;
}

interface PaymentSettings {
  provider: 'stripe' | 'paypal' | 'gocardless';
  hasStripeSecretKey: boolean;
  hasStripeWebhookSecret: boolean;
  hasStripePublishableKey: boolean;
  hasPaypalClientId: boolean;
  hasPaypalClientSecret: boolean;
  paypalApiBaseUrl: string;
  hasGocardlessAccessToken?: boolean;
  hasGocardlessWebhookSecret?: boolean;
  gocardlessEnvironment?: 'sandbox' | 'live';
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  gocardlessEnabled: boolean;
  stripeFee: ProcessingFeeConfig;
  paypalFee: ProcessingFeeConfig;
  gocardlessFee: ProcessingFeeConfig;
}

type PaymentProvider = PaymentSettings['provider'];

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs text-slate-500';

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PaymentSettings>({
    queryKey: ['payments-settings'],
    queryFn: async () => (await api.get('/payments/settings')).data
  });

  const [provider, setProvider] = useState<PaymentProvider>('stripe');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalApiBaseUrl, setPaypalApiBaseUrl] = useState('https://api-m.sandbox.paypal.com');
  const [gocardlessAccessToken, setGocardlessAccessToken] = useState('');
  const [gocardlessWebhookSecret, setGocardlessWebhookSecret] = useState('');
  const [gocardlessEnvironment, setGocardlessEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [stripeFee, setStripeFee] = useState<ProcessingFeeConfig>({ enabled: true, percent: 1.5, fixed: 20 });
  const [paypalFee, setPaypalFee] = useState<ProcessingFeeConfig>({ enabled: true, percent: 1.5, fixed: 20 });
  const [gocardlessFee, setGocardlessFee] = useState<ProcessingFeeConfig>({ enabled: true, percent: 1.5, fixed: 20 });
  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [paypalEnabled, setPaypalEnabled] = useState(true);
  const [gocardlessEnabled, setGocardlessEnabled] = useState(true);

  useEffect(() => {
    if (data) {
      setProvider(data.provider);
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      setStripePublishableKey('');
      setPaypalClientId('');
      setPaypalClientSecret('');
      setPaypalApiBaseUrl(data.paypalApiBaseUrl ?? 'https://api-m.sandbox.paypal.com');
      setGocardlessAccessToken('');
      setGocardlessWebhookSecret('');
      setGocardlessEnvironment(data.gocardlessEnvironment ?? 'sandbox');
      setStripeFee(data.stripeFee ?? { enabled: true, percent: 1.5, fixed: 20 });
      setPaypalFee(data.paypalFee ?? { enabled: true, percent: 1.5, fixed: 20 });
      setGocardlessFee(data.gocardlessFee ?? { enabled: true, percent: 1.5, fixed: 20 });
      setStripeEnabled(data.stripeEnabled ?? true);
      setPaypalEnabled(data.paypalEnabled ?? true);
      setGocardlessEnabled(data.gocardlessEnabled ?? true);
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

  // Secret fields are one-way: they are never sent back to the browser, so
  // after a save they stay blank and only the "Configured" hint confirms the
  // value stuck. Surface an explicit result so saving never feels like a no-op.
  const saveFeedback = mutation.isError
    ? { className: 'text-red-400', text: `Save failed: ${getApiErrorMessage(mutation.error)}` }
    : mutation.isSuccess
      ? { className: 'text-emerald-400', text: 'Settings saved.' }
      : null;

  const handleSave = () => {
    const payload: Partial<PaymentSettings> & {
      stripeSecretKey?: string;
      stripeWebhookSecret?: string;
      stripePublishableKey?: string;
      paypalClientId?: string;
      paypalClientSecret?: string;
      provider: PaymentProvider;
      paypalApiBaseUrl: string;
      gocardlessAccessToken?: string;
      gocardlessWebhookSecret?: string;
      gocardlessEnvironment?: 'sandbox' | 'live';
      stripeEnabled: boolean;
      paypalEnabled: boolean;
      gocardlessEnabled: boolean;
      stripeFeeEnabled: boolean;
      stripeFeePercent: number;
      stripeFeeFixed: number;
      paypalFeeEnabled: boolean;
      paypalFeePercent: number;
      paypalFeeFixed: number;
      gocardlessFeeEnabled: boolean;
      gocardlessFeePercent: number;
      gocardlessFeeFixed: number;
    } = {
      provider,
      paypalApiBaseUrl,
      stripeEnabled,
      paypalEnabled,
      gocardlessEnabled,
      stripeFeeEnabled: stripeFee.enabled,
      stripeFeePercent: stripeFee.percent,
      stripeFeeFixed: stripeFee.fixed,
      paypalFeeEnabled: paypalFee.enabled,
      paypalFeePercent: paypalFee.percent,
      paypalFeeFixed: paypalFee.fixed,
      gocardlessFeeEnabled: gocardlessFee.enabled,
      gocardlessFeePercent: gocardlessFee.percent,
      gocardlessFeeFixed: gocardlessFee.fixed
    };

    if (stripeSecretKey.trim()) payload.stripeSecretKey = stripeSecretKey.trim();
    if (stripeWebhookSecret.trim()) payload.stripeWebhookSecret = stripeWebhookSecret.trim();
    if (stripePublishableKey.trim()) payload.stripePublishableKey = stripePublishableKey.trim();
    if (paypalClientId.trim()) payload.paypalClientId = paypalClientId.trim();
    if (paypalClientSecret.trim()) payload.paypalClientSecret = paypalClientSecret.trim();
    if (gocardlessAccessToken.trim()) payload.gocardlessAccessToken = gocardlessAccessToken.trim();
    if (gocardlessWebhookSecret.trim()) payload.gocardlessWebhookSecret = gocardlessWebhookSecret.trim();
    if (provider === 'gocardless') payload.gocardlessEnvironment = gocardlessEnvironment;

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
            <h3 className="mb-3 text-sm font-semibold">Enabled platforms</h3>
            <p className="mb-3 text-xs text-slate-500">
              Turn a platform off to hide it from checkout pages and block new payments on it. Disabling never deletes its credentials, and payments already in progress still complete.
            </p>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={stripeEnabled}
                  onChange={(e) => setStripeEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-neon-blue"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Card payments (Stripe)</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={paypalEnabled}
                  onChange={(e) => setPaypalEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-neon-blue"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">PayPal</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={gocardlessEnabled}
                  onChange={(e) => setGocardlessEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-neon-blue"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Direct Debit &amp; Instant Bank Pay (GoCardless)</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelClass}>Default provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as PaymentProvider)} className={inputClass}>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="gocardless">GoCardless</option>
            </select>
          </div>

          {provider === 'stripe' && (
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
          )}

          {provider === 'paypal' && (
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

          {provider === 'gocardless' && (
            <>
              <div>
                <label className={labelClass}>GoCardless access token</label>
                <input type="password" value={gocardlessAccessToken} onChange={(e) => setGocardlessAccessToken(e.target.value)} className={inputClass} placeholder="live_..." autoComplete="off" />
                <p className="mt-1 text-xs text-slate-500">{data?.hasGocardlessAccessToken ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
              <div>
                <label className={labelClass}>GoCardless webhook secret</label>
                <input type="password" value={gocardlessWebhookSecret} onChange={(e) => setGocardlessWebhookSecret(e.target.value)} className={inputClass} placeholder="Webhook secret" autoComplete="off" />
                <p className="mt-1 text-xs text-slate-500">{data?.hasGocardlessWebhookSecret ? 'Configured. Enter a new value to rotate it.' : 'Not configured yet.'}</p>
              </div>
              <div>
                <label className={labelClass}>GoCardless environment</label>
                <select value={gocardlessEnvironment} onChange={(e) => setGocardlessEnvironment(e.target.value as 'sandbox' | 'live')} className={inputClass}>
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>GoCardless webhook URL</label>
                <input readOnly value={typeof window !== 'undefined' ? `${window.location.origin}/api/payments/gocardless/webhook` : ''} className={inputClass} onFocus={(e) => e.target.select()} />
                <p className="mt-1 text-xs text-slate-500">Add this endpoint in your GoCardless dashboard so payment events can be received.</p>
              </div>
            </>
          )}

          <div className="border-t border-white/10 pt-5">
            <h3 className="mb-1 text-sm font-semibold">Processing fees</h3>
            <p className="mb-4 text-xs text-slate-500">
              Each platform has its own fee, added on top of the advertised price when enabled so the club receives the full amount.
            </p>
            <div className="space-y-5">
              <FeeFields
                title="Card (Stripe)"
                fee={stripeFee}
                onChange={setStripeFee}
              />
              <FeeFields
                title="PayPal"
                fee={paypalFee}
                onChange={setPaypalFee}
              />
              <FeeFields
                title="Direct Debit & Instant Bank Pay (GoCardless)"
                fee={gocardlessFee}
                onChange={setGocardlessFee}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" onClick={handleSave} disabled={mutation.isPending} className="btn-primary inline-flex items-center gap-2">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" /> Save payment settings
            </button>
            {saveFeedback && <p className={`text-sm ${saveFeedback.className}`}>{saveFeedback.text}</p>}
          </div>
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

function FeeFields({
  title,
  fee,
  onChange
}: {
  title: string;
  fee: ProcessingFeeConfig;
  onChange: (fee: ProcessingFeeConfig) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={fee.enabled}
          onChange={(e) => onChange({ ...fee, enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded accent-neon-blue"
        />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</span>
      </label>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Percentage fee (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={fee.percent}
            onChange={(e) => onChange({ ...fee, percent: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Fixed fee (pence)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={fee.fixed}
            onChange={(e) => onChange({ ...fee, fixed: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
