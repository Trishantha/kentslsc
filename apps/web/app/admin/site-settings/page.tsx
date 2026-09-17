'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Globe, Mail, Phone, MessageCircle, MapPin, ToggleLeft } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { Switch } from '@/components/ui/Switch';
import { siteSettingsSchema, type SiteSettings, type SiteSettingsInput } from '@kentslsc/shared';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
const errorClass = 'mt-1 text-xs text-rose-500';

const socialFields: { id: keyof SiteSettingsInput; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: 'facebook', label: 'Facebook', icon: Globe, placeholder: 'https://facebook.com/kentslsc' },
  { id: 'instagram', label: 'Instagram', icon: Globe, placeholder: 'https://instagram.com/kentslsc' },
  { id: 'twitter', label: 'X / Twitter', icon: Globe, placeholder: 'https://x.com/kentslsc' },
  { id: 'youtube', label: 'YouTube', icon: Globe, placeholder: 'https://youtube.com/@kentslsc' },
  { id: 'linkedin', label: 'LinkedIn', icon: Globe, placeholder: 'https://linkedin.com/company/kentslsc' },
  { id: 'tiktok', label: 'TikTok', icon: Globe, placeholder: 'https://tiktok.com/@kentslsc' }
];

export default function AdminSiteSettingsPage() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data } = await api.get('/site-settings');
      return data;
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors }
  } = useForm<SiteSettingsInput>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: {
      email: '',
      phone: '',
      whatsapp: '',
      address: '',
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: '',
      linkedin: '',
      tiktok: '',
      showPageLoader: true
    }
  });

  useEffect(() => {
    if (data) {
      reset({
        email: data.email ?? '',
        phone: data.phone ?? '',
        whatsapp: data.whatsapp ?? '',
        address: data.address ?? '',
        facebook: data.facebook ?? '',
        instagram: data.instagram ?? '',
        twitter: data.twitter ?? '',
        youtube: data.youtube ?? '',
        linkedin: data.linkedin ?? '',
        tiktok: data.tiktok ?? '',
        showPageLoader: data.showPageLoader ?? true
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: SiteSettingsInput) => {
      setSaveError(null);
      const { data } = await api.put('/site-settings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
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
      <h1 className="section-title">Social & Contact Settings</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Update club contact details and social media links. Changes are reflected automatically across the public website.
      </p>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="mt-8 grid gap-6 lg:grid-cols-2"
      >
        <div className="glass-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <MapPin className="h-5 w-5 text-neon-blue" />
            Contact details
          </h2>

          <div>
            <label className={labelClass}>Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                {...register('email')}
                placeholder="info@kentslsc.org"
                className={`${inputClass} pl-9`}
              />
            </div>
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Phone number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="tel"
                {...register('phone')}
                placeholder="+44 1234 567890"
                className={`${inputClass} pl-9`}
              />
            </div>
            {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
          </div>

          <div>
            <label className={labelClass}>WhatsApp number</label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="tel"
                {...register('whatsapp')}
                placeholder="+44 1234 567890"
                className={`${inputClass} pl-9`}
              />
            </div>
            {errors.whatsapp && <p className={errorClass}>{errors.whatsapp.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Club address</label>
            <textarea
              {...register('address')}
              rows={3}
              placeholder="Kent Sri Lankan Social Club, Community Centre, Maidstone, Kent ME15 9JQ"
              className={inputClass}
            />
            {errors.address && <p className={errorClass}>{errors.address.message}</p>}
          </div>
        </div>

        <div className="glass-card space-y-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Globe className="h-5 w-5 text-neon-blue" />
            Social media
          </h2>

          {socialFields.map(({ id, label, icon: Icon, placeholder }) => (
            <div key={id}>
              <label className={labelClass}>{label}</label>
              <div className="relative">
                <Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="url"
                  {...register(id as keyof SiteSettingsInput)}
                  placeholder={placeholder}
                  className={`${inputClass} pl-9`}
                />
              </div>
              {errors[id as keyof SiteSettingsInput] && (
                <p className={errorClass}>{errors[id as keyof SiteSettingsInput]?.message}</p>
              )}
            </div>
          ))}
        </div>

        <div className="glass-card space-y-5 p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ToggleLeft className="h-5 w-5 text-neon-blue" />
            Website behaviour
          </h2>

          <Controller
            name="showPageLoader"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Switch
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  label="Show animated page loader"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  When enabled, visitors see the animated KENT SLSC logo while pages load and during navigation.
                </p>
              </div>
            )}
          />
        </div>

        {saveError && (
          <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400 lg:col-span-2">
            {saveError}
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
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
