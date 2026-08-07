'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  registrationWizardSchema,
  RegistrationWizardInput,
  MembershipFeature,
  membershipFeatureLabels
} from '@kentslsc/shared';
import { api } from '@/lib/api';
import { isAxiosError } from 'axios';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  User,
  MapPin,
  Heart,
  CreditCard,
  Users,
  FileText,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';

interface MembershipType {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  isFree: boolean;
  durationMonths: number;
  benefits: string[];
  features: MembershipFeature[];
  autoActivate: boolean;
}

interface FeatureDefinition {
  value: MembershipFeature;
  label: string;
  description: string;
}

const steps = [
  { id: 1, title: 'Account', icon: User, fields: ['name', 'email', 'password', 'confirmPassword'] as const },
  { id: 2, title: 'Profile', icon: MapPin, fields: ['phone', 'address', 'dateOfBirth', 'emergencyContactName', 'emergencyContactPhone'] as const },
  { id: 3, title: 'Interests', icon: Heart, fields: ['interests'] as const },
  { id: 4, title: 'Plan', icon: CreditCard, fields: ['membershipTypeId'] as const },
  { id: 5, title: 'Dependants', icon: Users, fields: ['dependants'] as const },
  { id: 6, title: 'Review', icon: FileText, fields: ['acceptedTerms'] as const }
];

const interestOptions = ['Events', 'Business', 'Family', 'Sports', 'Culture', 'Volunteering'];

function formatPrice(type: MembershipType) {
  if (type.isFree || type.price === 0) return 'Free';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(type.price);
}

function hasFeature(type: MembershipType, feature: MembershipFeature) {
  return type.features.includes(feature);
}

export function RegistrationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: types = [],
    isLoading: typesLoading,
    error: typesError,
    refetch: refetchTypes
  } = useQuery<MembershipType[]>({
    queryKey: ['membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types');
      return res.data;
    },
    retry: 1
  });

  const { data: featureDefinitions = [] } = useQuery<FeatureDefinition[]>({
    queryKey: ['membership-features'],
    queryFn: async () => {
      const res = await api.get('/membership/features');
      return res.data;
    },
    retry: 1
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors }
  } = useForm<RegistrationWizardInput>({
    resolver: zodResolver(registrationWizardSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      interests: [],
      membershipTypeId: '',
      dependants: [],
      acceptedTerms: false
    }
  });

  const { fields: dependants, append, remove } = useFieldArray({ control, name: 'dependants' });

  const selectedTypeId = watch('membershipTypeId');
  const selectedType = types.find((t) => t.id === selectedTypeId);
  const watchInterests = watch('interests') ?? [];

  const spouseIndex = dependants.findIndex((d) => d.relationship === 'spouse');

  const validateStep = async (): Promise<boolean> => {
    const current = steps.find((s) => s.id === step);
    if (!current) return true;
    const result = await trigger(current.fields as unknown as keyof RegistrationWizardInput);
    return result;
  };

  const nextStep = async () => {
    const valid = await validateStep();
    if (!valid) return;

    if (step === 4 && selectedType && !selectedType.features.includes(MembershipFeature.DEPENDANTS)) {
      setStep(6);
      return;
    }

    setStep((s) => Math.min(s + 1, 6));
  };

  const prevStep = () => {
    if (step === 6 && selectedType && !selectedType.features.includes(MembershipFeature.DEPENDANTS)) {
      setStep(4);
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  const onSubmit: SubmitHandler<RegistrationWizardInput> = async (data) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await api.post('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        address: data.address,
        application: {
          membershipTypeId: data.membershipTypeId,
          fullName: data.name,
          phone: data.phone,
          address: data.address,
          dateOfBirth: data.dateOfBirth,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          interests: data.interests,
          dependants: data.dependants,
          acceptedTerms: data.acceptedTerms
        }
      });

      if (res.data.application?.paid && res.data.application.url) {
        window.location.href = res.data.application.url;
        return;
      }

      router.push('/dashboard?registered=1');
    } catch (error) {
      setIsSubmitting(false);
      if (!isAxiosError(error) || !error.response) {
        setSubmitError('Cannot reach the server. Please make sure the API is running.');
        return;
      }
      const message =
        typeof error.response.data === 'object' && 'message' in error.response.data
          ? String(error.response.data.message)
          : 'Registration failed. Please check your details and try again.';
      setSubmitError(message);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Create your account</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Start with your login details.</p>
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <input {...register('name')} autoComplete="name" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input {...register('email')} type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input {...register('password')} type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <input {...register('confirmPassword')} type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Personal details</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Help us keep our member records up to date.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input {...register('phone')} autoComplete="tel" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium">Date of Birth</label>
                <input {...register('dateOfBirth')} type="date" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <input {...register('address')} autoComplete="street-address" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Emergency Contact Name</label>
                <input {...register('emergencyContactName')} className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium">Emergency Contact Phone</label>
                <input {...register('emergencyContactPhone')} autoComplete="tel" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Your interests</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Select what matters to you so we can personalise your experience.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {interestOptions.map((interest) => {
                const checked = watchInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => {
                      const next = checked ? watchInterests.filter((i) => i !== interest) : [...watchInterests, interest];
                      setValue('interests', next, { shouldValidate: true });
                    }}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      checked ? 'border-neon-blue bg-neon-blue/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <span className="text-sm font-medium">{interest}</span>
                    {checked && <Check className="h-4 w-4 text-neon-blue" />}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Choose your membership</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Compare plans and pick the one that fits you.</p>
            {typesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
              </div>
            ) : typesError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <p className="text-sm text-red-500">
                  Could not load membership plans. Please make sure the API server is running.
                </p>
                <button
                  type="button"
                  onClick={() => refetchTypes()}
                  className="btn-secondary mt-4 inline-flex text-sm"
                >
                  Retry
                </button>
              </div>
            ) : types.length === 0 ? (
              <div className="rounded-xl border border-neon-gold/20 bg-neon-gold/5 p-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No membership plans are available yet. Please contact the administrator.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((type) => {
                  const selected = selectedTypeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setValue('membershipTypeId', type.id, { shouldValidate: true })}
                      className={`glass-card p-5 text-left transition-all ${
                        selected ? 'neon-border ring-1 ring-neon-blue' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-bold">{type.name}</h3>
                        {selected && <Check className="h-5 w-5 text-neon-blue" />}
                      </div>
                      <p className="mt-2 text-2xl font-bold gradient-text">{formatPrice(type)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {type.isFree ? 'Lifetime membership' : `${type.durationMonths} months`}
                      </p>
                      {type.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{type.description}</p>}
                      <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {featureDefinitions.map((feature) => (
                          <li key={feature.value} className="flex items-center gap-2">
                            {hasFeature(type, feature.value) ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <span className="h-3 w-3 rounded-full bg-slate-600" />
                            )}
                            {feature.label}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}
            {errors.membershipTypeId && <p className="text-sm text-red-500">Please select a membership plan.</p>}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Dependants</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Add family members covered by your plan.</p>

            {spouseIndex === -1 && (
              <button
                type="button"
                onClick={() => append({ name: '', age: 0, relationship: 'spouse' })}
                className="btn-secondary inline-flex text-sm"
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
                    <button type="button" onClick={() => remove(spouseIndex)} className="text-red-500 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <input {...register(`dependants.${spouseIndex}.name` as const)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
                      {errors.dependants?.[spouseIndex]?.name && <p className="mt-1 text-xs text-red-500">{errors.dependants[spouseIndex]?.name?.message}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Age</label>
                      <input type="number" {...register(`dependants.${spouseIndex}.age` as const)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
                      {errors.dependants?.[spouseIndex]?.age && <p className="mt-1 text-xs text-red-500">{errors.dependants[spouseIndex]?.age?.message}</p>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4">
              <button type="button" onClick={() => append({ name: '', age: 0, relationship: 'child' })} className="btn-secondary inline-flex text-sm">
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
                      <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <input {...register(`dependants.${index}.name` as const)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
                        {errors.dependants?.[index]?.name && <p className="mt-1 text-xs text-red-500">{errors.dependants[index]?.name?.message}</p>}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Age</label>
                        <input type="number" {...register(`dependants.${index}.age` as const)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" />
                        {errors.dependants?.[index]?.age && <p className="mt-1 text-xs text-red-500">{errors.dependants[index]?.age?.message}</p>}
                      </div>
                    </div>
                  </motion.div>
                ) : null
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Review and confirm</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Check your details and accept the terms.</p>
            <div className="glass-card space-y-3 p-5 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">{watch('name')}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-500">Email</span>
                <span className="font-medium">{watch('email')}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-500">Plan</span>
                <span className="font-medium">{selectedType ? `${selectedType.name} (${formatPrice(selectedType)})` : '-'}</span>
              </div>
              {dependants.length > 0 && (
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-500">Dependants</span>
                  <span className="font-medium">{dependants.length}</span>
                </div>
              )}
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" {...register('acceptedTerms')} className="mt-1 h-4 w-4 rounded border-white/10 bg-white/10 text-neon-blue" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                I agree to the terms and conditions and privacy policy.
              </span>
            </label>
            {errors.acceptedTerms && <p className="text-sm text-red-500">{errors.acceptedTerms.message}</p>}
            {selectedType && !selectedType.isFree && (
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                You will be redirected to Stripe Checkout to pay {formatPrice(selectedType)}.
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const active = s.id === step;
          const completed = s.id < step;
          const isDependantsStep = s.id === 5;
          if (isDependantsStep && selectedType && !selectedType.features.includes(MembershipFeature.DEPENDANTS)) {
            return null;
          }
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className={`flex flex-col items-center gap-2 ${idx > 0 ? 'w-full' : ''}`}>
                {idx > 0 && <div className={`mb-2 h-0.5 w-full ${completed ? 'bg-neon-blue' : 'bg-white/10'}`} />}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    active ? 'border-neon-blue bg-neon-blue/10 text-neon-blue' : completed ? 'border-neon-blue bg-neon-blue text-slate-950' : 'border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`hidden text-xs sm:block ${active ? 'text-neon-blue' : 'text-slate-500'}`}>{s.title}</span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {submitError && <p className="mt-4 text-center text-sm text-red-500">{submitError}</p>}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1 || isSubmitting}
            className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white/5 disabled:opacity-0 dark:text-slate-400"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary inline-flex"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary inline-flex"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                </>
              ) : selectedType && !selectedType.isFree ? (
                <>
                  Proceed to Payment <ChevronRight className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  Complete Registration <Check className="ml-1 h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
