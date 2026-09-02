'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { updateUserSchema, type UpdateUserInput } from '@kentslsc/shared';

export function ProfileCard() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useAuth();
  const [success, setSuccess] = useState(false);

  const address = user?.address;
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      address: {
        buildingStreet: address?.buildingStreet ?? '',
        locality: address?.locality ?? '',
        townCity: address?.townCity ?? '',
        postcode: address?.postcode ?? ''
      }
    }
  });

  const updateProfile = useMutation({
    mutationFn: async (data: UpdateUserInput) => {
      const res = await api.put('/users/me', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  });

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-neon-blue" />
          <h2 className="text-xl font-bold">My Profile</h2>
        </div>
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-neon-blue" />
        <h2 className="text-xl font-bold">My Profile</h2>
      </div>

      <form onSubmit={handleSubmit((data) => updateProfile.mutate(data))} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-first-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              First name
            </label>
            <input
              id="profile-first-name"
              type="text"
              {...register('firstName')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="profile-last-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Last name
            </label>
            <input
              id="profile-last-name"
              type="text"
              {...register('lastName')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
            <input
              id="profile-email"
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-xl border border-slate-300 bg-slate-200 py-2 pl-9 pr-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
            />
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Email cannot be changed here.</p>
        </div>

        <div>
          <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Phone
          </label>
          <input
            id="profile-phone"
            type="tel"
            {...register('phone')}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
          />
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="profile-address-building" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Building & Street
            </label>
            <input
              id="profile-address-building"
              type="text"
              {...register('address.buildingStreet')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            {errors.address?.buildingStreet && (
              <p className="mt-1 text-xs text-red-400">{errors.address.buildingStreet.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="profile-address-locality" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Locality <span className="text-slate-600 dark:text-slate-400">(optional)</span>
            </label>
            <input
              id="profile-address-locality"
              type="text"
              {...register('address.locality')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-address-town" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Town/City
              </label>
              <input
                id="profile-address-town"
                type="text"
                {...register('address.townCity', {
                  onChange: (e) => setValue('address.townCity', e.target.value.toUpperCase(), { shouldValidate: true })
                })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              {errors.address?.townCity && <p className="mt-1 text-xs text-red-400">{errors.address.townCity.message}</p>}
            </div>
            <div>
              <label htmlFor="profile-address-postcode" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Postcode
              </label>
              <input
                id="profile-address-postcode"
                type="text"
                {...register('address.postcode', {
                  onChange: (e) => setValue('address.postcode', e.target.value.toUpperCase(), { shouldValidate: true })
                })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              {errors.address?.postcode && <p className="mt-1 text-xs text-red-400">{errors.address.postcode.message}</p>}
            </div>
          </div>
        </div>

        {updateProfile.error && <p className="text-sm text-red-400">Failed to save profile. Please try again.</p>}
        {success && <p className="text-sm text-green-400">Profile saved successfully.</p>}

        <button
          type="submit"
          disabled={isSubmitting || updateProfile.isPending}
          className="btn-primary inline-flex w-full items-center justify-center"
        >
          {isSubmitting || updateProfile.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Profile
        </button>
      </form>
    </motion.div>
  );
}
