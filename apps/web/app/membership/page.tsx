'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { membershipApplySchema, MembershipApplyInput } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { Check, Plus, Trash2, Users, Loader2 } from 'lucide-react';

interface MembershipType {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  isFree: boolean;
  durationMonths: number;
  benefits: string[];
}

function formatPrice(type: MembershipType) {
  if (type.isFree || type.price === 0) return 'Free';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(type.price);
}

export default function MembershipPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: types = [], isLoading: typesLoading } = useQuery<MembershipType[]>({
    queryKey: ['membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types');
      return res.data;
    }
  });

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<MembershipApplyInput>({
    resolver: zodResolver(membershipApplySchema),
    defaultValues: {
      membershipTypeId: '',
      fullName: '',
      address: '',
      phone: '',
      dependants: []
    }
  });

  const { fields: dependants, append, remove } = useFieldArray({ control, name: 'dependants' });
  const selectedTypeId = watch('membershipTypeId');
  const selectedType = types.find((t) => t.id === selectedTypeId);

  const spouseIndex = dependants.findIndex((d) => d.relationship === 'spouse');

  const onSubmit = async (data: MembershipApplyInput) => {
    setSubmitError(null);
    try {
      const res = await api.post('/membership/apply', data);
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        router.push('/dashboard');
      }
    } catch {
      setSubmitError('Application failed. Please check your details and try again.');
    }
  };

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h1 className="section-title">Membership</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Choose the membership that suits you and your family.
          </p>
        </div>

        {typesLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((type) => {
              const selected = selectedTypeId === type.id;
              return (
                <motion.button
                  type="button"
                  key={type.id}
                  onClick={() => setValue('membershipTypeId', type.id)}
                  whileHover={{ y: -4 }}
                  className={`glass-card p-6 text-left transition-all ${
                    selected ? 'neon-border ring-1 ring-neon-blue' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-bold">{type.name}</h3>
                    {selected && <Check className="h-5 w-5 text-neon-blue" />}
                  </div>
                  <p className="mt-2 text-2xl font-bold gradient-text">{formatPrice(type)}</p>
                  {type.description && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{type.description}</p>
                  )}
                  <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {type.benefits.map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                    {type.benefits.length === 0 && <li>• Member benefits</li>}
                  </ul>
                </motion.button>
              );
            })}
          </div>
        )}

        {errors.membershipTypeId && (
          <p className="mt-4 text-center text-sm text-red-500">Please select a membership type.</p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-12 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold">Your Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <input
                  {...register('fullName')}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                />
                {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input
                  {...register('phone')}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <input
                  {...register('address')}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold">Dependants</h2>

            {spouseIndex === -1 && (
              <button
                type="button"
                onClick={() => append({ name: '', age: 0, relationship: 'spouse' })}
                className="btn-secondary mt-4 inline-flex text-sm"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Spouse
              </button>
            )}

            <AnimatePresence>
              {spouseIndex !== -1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 rounded-xl border border-neon-gold/30 bg-neon-gold/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-neon-gold">Spouse</span>
                    <button
                      type="button"
                      onClick={() => remove(spouseIndex)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <input
                        {...register(`dependants.${spouseIndex}.name` as const)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                      />
                      {errors.dependants?.[spouseIndex]?.name && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.dependants[spouseIndex]?.name?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Age</label>
                      <input
                        type="number"
                        {...register(`dependants.${spouseIndex}.age` as const)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                      />
                      {errors.dependants?.[spouseIndex]?.age && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.dependants[spouseIndex]?.age?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => append({ name: '', age: 0, relationship: 'child' })}
                className="btn-secondary inline-flex text-sm"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Child
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {dependants.map((field, index) =>
                field.relationship === 'child' ? (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-neon-blue/30 bg-neon-blue/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-neon-blue">Child</span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <input
                          {...register(`dependants.${index}.name` as const)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                        />
                        {errors.dependants?.[index]?.name && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.dependants[index]?.name?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Age</label>
                        <input
                          type="number"
                          {...register(`dependants.${index}.age` as const)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none"
                        />
                        {errors.dependants?.[index]?.age && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.dependants[index]?.age?.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : null
              )}
            </div>
          </div>

          {selectedType && !selectedType.isFree && (
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              You will be redirected to Stripe Checkout to pay {formatPrice(selectedType)}.
            </p>
          )}

          {submitError && <p className="text-center text-sm text-red-500">{submitError}</p>}

          <button
            disabled={isSubmitting || !selectedTypeId}
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            {selectedType && !selectedType.isFree ? 'Proceed to Payment' : 'Join Now'}
          </button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already a member?{' '}
            <Link href="/dashboard" className="text-neon-blue hover:underline">
              Go to dashboard
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
