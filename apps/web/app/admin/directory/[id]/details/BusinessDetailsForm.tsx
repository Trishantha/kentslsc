'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  optionalUrl,
  directoryCategoryGroups,
  directoryCategoryValues
} from '@kentslsc/shared';
import { Loader2, Save, Trash2, Sparkles, Mail, Banknote, Check, Copy, Gift, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { formatDate } from '@/lib/utils';
import type { AdminBusiness } from '../../types';

const businessSchema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  servicesText: z.string().optional(),
  websiteUrl: optionalUrl('Enter a valid website URL, e.g. example.com').or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z
    .string()
    .refine((val) => !val || directoryCategoryValues.includes(val), {
      message: 'Select a valid category'
    })
    .optional(),
  facebook: optionalUrl('Enter a valid Facebook URL').or(z.literal('')),
  instagram: optionalUrl('Enter a valid Instagram URL').or(z.literal('')),
  twitter: optionalUrl('Enter a valid X/Twitter URL').or(z.literal('')),
  youtube: optionalUrl('Enter a valid YouTube URL').or(z.literal('')),
  linkedin: optionalUrl('Enter a valid LinkedIn URL').or(z.literal('')),
  tiktok: optionalUrl('Enter a valid TikTok URL').or(z.literal('')),
  isPaid: z.boolean().default(false)
});

type BusinessForm = z.infer<typeof businessSchema>;

const categorySelectGroups = directoryCategoryGroups.map((group) => ({
  name: group.name,
  emoji: group.emoji,
  options: group.subcategories.map((sub) => ({ value: sub.name, label: sub.name }))
}));

interface BusinessDetailsFormProps {
  business: AdminBusiness;
  businessId: string;
}

export function BusinessDetailsForm({ business, businessId }: BusinessDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } =
    useForm<BusinessForm>({
      resolver: zodResolver(businessSchema),
      defaultValues: {
        businessName: business.businessName,
        logoUrl: business.logoUrl ?? '',
        description: business.description ?? '',
        servicesText: business.servicesText ?? '',
        websiteUrl: business.websiteUrl ?? '',
        email: business.email ?? '',
        phone: business.phone ?? '',
        address: business.address ?? '',
        category: business.category ?? '',
        facebook: business.facebook ?? '',
        instagram: business.instagram ?? '',
        twitter: business.twitter ?? '',
        youtube: business.youtube ?? '',
        linkedin: business.linkedin ?? '',
        tiktok: business.tiktok ?? '',
        isPaid: business.isPaid
      }
    });

  useEffect(() => {
    reset({
      businessName: business.businessName,
      logoUrl: business.logoUrl ?? '',
      description: business.description ?? '',
      servicesText: business.servicesText ?? '',
      websiteUrl: business.websiteUrl ?? '',
      email: business.email ?? '',
      phone: business.phone ?? '',
      address: business.address ?? '',
      category: business.category ?? '',
      facebook: business.facebook ?? '',
      instagram: business.instagram ?? '',
      twitter: business.twitter ?? '',
      youtube: business.youtube ?? '',
      linkedin: business.linkedin ?? '',
      tiktok: business.tiktok ?? '',
      isPaid: business.isPaid
    });
  }, [business, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: BusinessForm) => {
      const res = await api.put(`/admin/directory/businesses/${businessId}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/directory/businesses/${businessId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      router.push('/admin/directory');
    }
  });

  const [promotionLink, setPromotionLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const promoteOfflineMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/directory/businesses/${businessId}/promote-offline`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId] });
    }
  });

  const promoteFreeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/directory/businesses/${businessId}/promote-free`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId] });
    }
  });

  const unpromoteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/directory/businesses/${businessId}/promotion`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId] });
    }
  });

  const sendPromotionLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/directory/businesses/${businessId}/send-promotion-link`);
      return res.data as { url: string; provider: string };
    },
    onSuccess: (data) => {
      setPromotionLink(data.url);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId] });
    }
  });

  const handleCopyPromotionLink = async () => {
    if (!promotionLink) return;
    try {
      await navigator.clipboard.writeText(promotionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="glass-card space-y-4 p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Business name
        </label>
        <input
          {...register('businessName')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.businessName && (
          <p className="mt-1 text-xs text-red-400">{errors.businessName.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Category
        </label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              groups={categorySelectGroups}
              placeholder="All categories"
              searchPlaceholder="Search categories..."
              className="mt-1"
            />
          )}
        />
        {errors.category && (
          <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Services
        </label>
        <textarea
          {...register('servicesText')}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Email
          </label>
          <input
            {...register('email')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Phone
          </label>
          <input
            {...register('phone')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Address
        </label>
        <input
          {...register('address')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Website
          </label>
          <input
            {...register('websiteUrl')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
          {errors.websiteUrl && (
            <p className="mt-1 text-xs text-red-400">{errors.websiteUrl.message}</p>
          )}
        </div>
        <ImageUpload
          label="Logo"
          value={watch('logoUrl')}
          onChange={(url) => setValue('logoUrl', url, { shouldValidate: true })}
          hideUrlInput
        />
        {errors.logoUrl && (
          <p className="mt-1 text-xs text-red-400">{errors.logoUrl.message}</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 text-sm font-semibold">Social media</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Facebook
            </label>
            <input
              {...register('facebook')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.facebook && (
              <p className="mt-1 text-xs text-red-400">{errors.facebook.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Instagram
            </label>
            <input
              {...register('instagram')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.instagram && (
              <p className="mt-1 text-xs text-red-400">{errors.instagram.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              X / Twitter
            </label>
            <input
              {...register('twitter')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.twitter && (
              <p className="mt-1 text-xs text-red-400">{errors.twitter.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              YouTube
            </label>
            <input
              {...register('youtube')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.youtube && (
              <p className="mt-1 text-xs text-red-400">{errors.youtube.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              LinkedIn
            </label>
            <input
              {...register('linkedin')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.linkedin && (
              <p className="mt-1 text-xs text-red-400">{errors.linkedin.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              TikTok
            </label>
            <input
              {...register('tiktok')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.tiktok && (
              <p className="mt-1 text-xs text-red-400">{errors.tiktok.message}</p>
            )}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...register('isPaid')}
          className="rounded border-white/10 bg-white/5"
        />
        Paid listing
      </label>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neon-gold" />
          <h3 className="text-sm font-semibold">Promotion</h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Promoted</span>
            <span className={business.isPromoted ? 'text-green-400' : 'text-slate-400'}>
              {business.isPromoted ? 'Yes' : 'No'}
            </span>
          </div>
          {business.promotedUntil && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Promoted until</span>
              <span className="text-slate-300">{formatDate(business.promotedUntil)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Payment</span>
            <span className="text-slate-300">
              {business.promotionPaymentMethod === 'free' ? (
                <span className="inline-flex items-center gap-1 text-neon-blue">
                  <Gift className="h-3 w-3" /> Free / goodwill
                </span>
              ) : business.promotionPaymentMethod ? (
                <span className="inline-flex items-center gap-1 text-green-400">
                  <Banknote className="h-3 w-3" /> Paid {business.promotionPaymentMethod}
                </span>
              ) : business.isPromoted ? (
                'No payment recorded'
              ) : (
                'Not promoted'
              )}
            </span>
          </div>
          {business.promotionPaidAt && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Paid at</span>
              <span className="text-slate-300">{formatDate(business.promotionPaidAt)}</span>
            </div>
          )}
        </div>

        {promotionLink ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-400">
              The promotion payment link has been emailed to the listing owner. You can also copy it here.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
              <input
                type="text"
                value={promotionLink}
                readOnly
                className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPromotionLink}
                className="inline-flex items-center gap-1 text-xs text-neon-blue hover:underline"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => promoteOfflineMutation.mutate()}
              disabled={promoteOfflineMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neon-gold/10 px-3 py-2 text-xs font-semibold text-neon-gold hover:bg-neon-gold/20 disabled:opacity-60"
            >
              {promoteOfflineMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Banknote className="h-3 w-3" />
              )}
              Mark promoted offline
            </button>
            <button
              type="button"
              onClick={() => promoteFreeMutation.mutate()}
              disabled={promoteFreeMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-2 text-xs font-semibold text-neon-blue hover:bg-neon-blue/20 disabled:opacity-60"
            >
              {promoteFreeMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Gift className="h-3 w-3" />
              )}
              Promote free (goodwill)
            </button>
            {business.isPromoted && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Remove the promotion from this listing?')) {
                    unpromoteMutation.mutate();
                  }
                }}
                disabled={unpromoteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-60"
              >
                {unpromoteMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                Remove promotion
              </button>
            )}
            <button
              type="button"
              onClick={() => sendPromotionLinkMutation.mutate()}
              disabled={sendPromotionLinkMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/20 disabled:opacity-60"
            >
              {sendPromotionLinkMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              Send promotion payment link
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="btn-primary flex-1"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Are you sure you want to delete this listing?')) {
              deleteMutation.mutate();
            }
          }}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </form>
  );
}
