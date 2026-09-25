'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Search } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { siteSeoSettingsSchema, type SiteSeoSettingsInput, type SiteSettings } from '@kentslsc/shared';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
const errorClass = 'mt-1 text-xs text-rose-500';

export function SeoSettingsForm({ settings }: { settings: SiteSettings }) {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<SiteSeoSettingsInput>({
    resolver: zodResolver(siteSeoSettingsSchema),
    defaultValues: {
      metaTitle: '',
      metaDescription: '',
      metaKeywords: ''
    }
  });

  useEffect(() => {
    reset({
      metaTitle: settings.metaTitle ?? '',
      metaDescription: settings.metaDescription ?? '',
      metaKeywords: settings.metaKeywords ?? ''
    });
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: SiteSeoSettingsInput) => {
      setSaveError(null);
      const { data } = await api.put('/site-settings/seo', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
    onError: (err: unknown) => {
      setSaveError(getApiErrorMessage(err));
    }
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="glass-card space-y-5 p-6"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Search className="h-5 w-5 text-neon-blue" />
        SEO defaults
      </h2>

      <div>
        <label className={labelClass}>Default meta title</label>
        <input
          {...register('metaTitle')}
          placeholder="Kent Sri Lankan Social Club"
          className={inputClass}
        />
        {errors.metaTitle && <p className={errorClass}>{errors.metaTitle.message}</p>}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Shown in browser tabs and search results when a page does not set its own title. Leave blank to use the site name.
        </p>
      </div>

      <div>
        <label className={labelClass}>
          Meta description
          <span className="ml-2 text-xs font-normal text-slate-500">
            {watch('metaDescription')?.length ?? 0}/160
          </span>
        </label>
        <textarea {...register('metaDescription')} rows={3} className={inputClass} />
        {errors.metaDescription && <p className={errorClass}>{errors.metaDescription.message}</p>}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Used for search engines and social sharing. Leave blank to use the default description.
        </p>
      </div>

      <div>
        <label className={labelClass}>Meta keywords</label>
        <input
          {...register('metaKeywords')}
          placeholder="kent, sri lankan, social club"
          className={inputClass}
        />
        {errors.metaKeywords && <p className={errorClass}>{errors.metaKeywords.message}</p>}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Comma-separated keywords applied site-wide.
        </p>
      </div>

      {saveError && (
        <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          {saveError}
        </div>
      )}

      <div>
        <button type="submit" disabled={mutation.isPending} className="btn-primary inline-flex items-center gap-2">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Save SEO settings
        </button>
      </div>
    </form>
  );
}
