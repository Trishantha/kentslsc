'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, ShieldCheck, User, Cookie, Database } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { Switch } from '@/components/ui/Switch';
import type { GdprSettingsInput } from '@kentslsc/shared';

interface GdprSettings extends GdprSettingsInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
const errorClass = 'mt-1 text-xs text-rose-500';

export default function AdminGdprPage() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<GdprSettings>({
    queryKey: ['gdpr-settings'],
    queryFn: async () => {
      const { data } = await api.get('/gdpr-settings');
      return data;
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors }
  } = useForm<GdprSettingsInput>({
    defaultValues: {
      cookieConsentEnabled: true,
      cookieConsentMessage:
        'We use cookies to improve your experience on our website. By continuing to browse, you agree to our use of cookies.',
      cookiePolicyUrl: '',
      privacyPolicyUrl: '',
      analyticsEnabled: false,
      marketingCookiesEnabled: false,
      dataRetentionDays: 365,
      dpoName: '',
      dpoEmail: '',
      dpoPhone: '',
      gdprNotes: ''
    }
  });

  useEffect(() => {
    if (data) {
      reset({
        cookieConsentEnabled: data.cookieConsentEnabled ?? true,
        cookieConsentMessage: data.cookieConsentMessage ?? '',
        cookiePolicyUrl: data.cookiePolicyUrl ?? '',
        privacyPolicyUrl: data.privacyPolicyUrl ?? '',
        analyticsEnabled: data.analyticsEnabled ?? false,
        marketingCookiesEnabled: data.marketingCookiesEnabled ?? false,
        dataRetentionDays: data.dataRetentionDays ?? 365,
        dpoName: data.dpoName ?? '',
        dpoEmail: data.dpoEmail ?? '',
        dpoPhone: data.dpoPhone ?? '',
        gdprNotes: data.gdprNotes ?? ''
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: GdprSettingsInput) => {
      setSaveError(null);
      setSaved(false);
      const { data } = await api.put('/gdpr-settings', payload);
      return data;
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['gdpr-settings'] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setSaveError(getApiErrorMessage(err));
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-neon-blue" />
        <h1 className="section-title">GDPR & Privacy</h1>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Configure cookie consent, Data Protection Officer details, and GDPR compliance settings. Policy documents are managed separately under <Link href="/admin/policy-documents" className="text-neon-blue hover:underline">Policy Documents</Link>.
      </p>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-8 grid gap-6 lg:grid-cols-2"
      >
        {/* Cookie Consent */}
        <div className="glass-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Cookie className="h-5 w-5 text-neon-blue" />
            Cookie Consent
          </h2>

          <Controller
            name="cookieConsentEnabled"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value ?? true}
                onChange={field.onChange}
                label="Show cookie consent banner"
              />
            )}
          />

          <div>
            <label className={labelClass}>Consent banner message</label>
            <textarea
              {...register('cookieConsentMessage')}
              rows={3}
              className={inputClass}
              placeholder="We use cookies to improve your experience..."
            />
            {errors.cookieConsentMessage && (
              <p className={errorClass}>{errors.cookieConsentMessage.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Cookie Policy URL (optional)</label>
            <input
              type="url"
              {...register('cookiePolicyUrl')}
              placeholder="https://kentslsc.org/cookie-policy"
              className={inputClass}
            />
            {errors.cookiePolicyUrl && (
              <p className={errorClass}>{errors.cookiePolicyUrl.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Privacy Policy URL (optional)</label>
            <input
              type="url"
              {...register('privacyPolicyUrl')}
              placeholder="https://kentslsc.org/privacy-policy"
              className={inputClass}
            />
            {errors.privacyPolicyUrl && (
              <p className={errorClass}>{errors.privacyPolicyUrl.message}</p>
            )}
          </div>

          <Controller
            name="analyticsEnabled"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value ?? false}
                onChange={field.onChange}
                label="Enable analytics cookies by default"
              />
            )}
          />

          <Controller
            name="marketingCookiesEnabled"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value ?? false}
                onChange={field.onChange}
                label="Enable marketing cookies by default"
              />
            )}
          />
        </div>

        {/* DPO Details */}
        <div className="glass-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <User className="h-5 w-5 text-neon-blue" />
            Data Protection Officer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If your organisation is required to appoint a DPO under GDPR, enter their details here.
          </p>

          <div>
            <label className={labelClass}>DPO name</label>
            <input
              type="text"
              {...register('dpoName')}
              placeholder="Full name"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>DPO email</label>
            <input
              type="email"
              {...register('dpoEmail')}
              placeholder="dpo@kentslsc.org"
              className={inputClass}
            />
            {errors.dpoEmail && <p className={errorClass}>{errors.dpoEmail.message}</p>}
          </div>

          <div>
            <label className={labelClass}>DPO phone</label>
            <input
              type="tel"
              {...register('dpoPhone')}
              placeholder="+44 1234 567890"
              className={inputClass}
            />
          </div>
        </div>

        {/* Data Retention */}
        <div className="glass-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Database className="h-5 w-5 text-neon-blue" />
            Data Retention
          </h2>

          <div>
            <label className={labelClass}>Data retention period (days)</label>
            <input
              type="number"
              {...register('dataRetentionDays', { valueAsNumber: true, min: 30, max: 3650 })}
              className={inputClass}
              min={30}
              max={3650}
            />
            <p className="mt-1 text-xs text-slate-500">
              How long inactive member data is retained after membership expires (30–3650 days).
            </p>
            {errors.dataRetentionDays && (
              <p className={errorClass}>{errors.dataRetentionDays.message}</p>
            )}
          </div>
        </div>

        {/* Internal GDPR Notes */}
        <div className="glass-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-neon-blue" />
            Internal GDPR Notes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Internal notes for the committee — not displayed publicly.
          </p>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              {...register('gdprNotes')}
              rows={6}
              className={inputClass}
              placeholder="Record any internal GDPR compliance notes, audit actions, or review dates here..."
            />
          </div>
        </div>

        {saveError && (
          <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400 lg:col-span-2">
            {saveError}
          </div>
        )}

        {saved && (
          <div className="rounded-xl bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400 lg:col-span-2">
            GDPR settings saved successfully.
          </div>
        )}

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary inline-flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save GDPR settings
          </button>
        </div>
      </form>
    </div>
  );
}
