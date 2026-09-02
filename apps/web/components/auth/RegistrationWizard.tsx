'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useClientSearchParams } from '@/hooks/useClientSearchParams';
import { Link } from '@/i18n/routing';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  registrationWizardSchema,
  RegistrationWizardInput,
  MembershipFeature,
  calculateProcessingFee
} from '@kentslsc/shared';
import { api } from '@/lib/api';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { formatCurrency } from '@/lib/utils';
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
  maxIssuances?: number | null;
  issuedCount?: number;
  hasCapacity?: boolean;
  benefits: string[];
  features: MembershipFeature[];
  autoActivate: boolean;
}

interface FeatureDefinition {
  value: MembershipFeature;
  label: string;
  description: string;
}

function hasFeature(type: MembershipType, feature: MembershipFeature) {
  return type.features.includes(feature);
}

export function RegistrationWizard() {
  const t = useTranslations('registration');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { data: paymentSettings } = usePaymentSettings();

  const steps = [
    { id: 1, title: t('steps.account'), icon: User, fields: ['firstName', 'lastName', 'email', 'password', 'confirmPassword'] as const },
    { id: 2, title: t('steps.profile'), icon: MapPin, fields: ['phone', 'address.buildingStreet', 'address.locality', 'address.townCity', 'address.postcode', 'dateOfBirth', 'emergencyContactName', 'emergencyContactPhone'] as const },
    { id: 3, title: t('steps.interests'), icon: Heart, fields: ['interests'] as const },
    { id: 4, title: t('steps.plan'), icon: CreditCard, fields: ['membershipTypeId'] as const },
    { id: 5, title: t('steps.dependants'), icon: Users, fields: ['dependants'] as const },
    { id: 6, title: t('steps.review'), icon: FileText, fields: ['acceptedTerms'] as const }
  ];

  const interestOptions = [
    { value: 'Events', label: t('interests.events') },
    { value: 'Business', label: t('interests.business') },
    { value: 'Family', label: t('interests.family') },
    { value: 'Sports', label: t('interests.sports') },
    { value: 'Culture', label: t('interests.culture') },
    { value: 'Volunteering', label: t('interests.volunteering') }
  ];

  function formatPrice(type: MembershipType) {
    if (type.isFree || type.price === 0) return tCommon('free');
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(type.price);
  }
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const { data: currentUser } = useAuth();
  const signOut = useSignOut();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

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
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      address: {
        buildingStreet: '',
        locality: '',
        townCity: '',
        postcode: ''
      },
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

  const membershipFee = useMemo(() => {
    if (!selectedType || selectedType.isFree || selectedType.price <= 0 || !paymentSettings) return null;
    return calculateProcessingFee(Math.round(selectedType.price * 100), {
      enabled: paymentSettings.processingFeeEnabled,
      percent: paymentSettings.processingFeePercent,
      fixed: paymentSettings.processingFeeFixed
    });
  }, [selectedType, paymentSettings]);

  const watchInterests = watch('interests') ?? [];
  const preferredTypeId = searchParams?.get('type') ?? '';
  const preferredType = types.find((type) => type.id === preferredTypeId);

  const spouseIndex = dependants.findIndex((d) => d.relationship === 'spouse');

  useEffect(() => {
    if (!preferredTypeId || types.length === 0 || selectedTypeId) {
      return;
    }

    if (preferredType && preferredType.hasCapacity !== false) {
      setValue('membershipTypeId', preferredType.id, { shouldValidate: true });
    }
  }, [preferredTypeId, selectedTypeId, setValue, types, preferredType]);

  const validateStep = async (): Promise<boolean> => {
    const current = steps.find((s) => s.id === step);
    if (!current) return true;
    const result = await trigger(current.fields as unknown as keyof RegistrationWizardInput);
    return result;
  };

  const nextStep = async () => {
    const valid = await validateStep();
    if (!valid) return;

    if (step === 4 && preferredTypeId && selectedTypeId === preferredTypeId && preferredType) {
      setStep(5);
      return;
    }

    setStep((s) => Math.min(s + 1, 6));
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const onSubmit: SubmitHandler<RegistrationWizardInput> = async (data) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const res = await api.post('/auth/register', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        address: data.address,
        application: {
          membershipTypeId: data.membershipTypeId,
          fullName,
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

      if (res.data.application?.paid && res.data.application.clientSecret && res.data.application.id) {
        router.push(`/checkout?session_id=${res.data.application.id}&client_secret=${encodeURIComponent(res.data.application.clientSecret)}`);
        return;
      }
      if (res.data.application?.paid && res.data.application.url) {
        window.location.href = res.data.application.url;
        return;
      }

      // Registration deliberately no longer signs the user in, so there is no
      // session to send to /dashboard. Confirm and point them at their inbox.
      setRegisteredEmail(data.email);
    } catch (error) {
      setIsSubmitting(false);
      if (!isAxiosError(error) || !error.response) {
        setSubmitError(tAuth('cannotReachServer'));
        return;
      }
      const message =
        typeof error.response.data === 'object' && 'message' in error.response.data
          ? String(error.response.data.message)
          : t('errors.registrationFailed');
      setSubmitError(message);
    }
  };

  // Belt and braces behind the middleware redirect and the API's 409: never let
  // a signed-in user (an admin, especially) submit this form and end up swapped
  // into a brand new account.
  if (currentUser) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-2xl font-bold">You&rsquo;re already signed in</h2>
        <p className="mt-3 text-slate-700 dark:text-slate-400">
          You&rsquo;re signed in as{' '}
          <span className="font-medium text-slate-900 dark:text-white">{currentUser.email}</span>.
          Sign out first if you want to create a different account.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a href={currentUser.role === 'ADMIN' ? '/admin' : '/dashboard'} className="btn-primary">
            Continue to my account
          </a>
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (registeredEmail) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neon-blue/10">
          <Check className="h-7 w-7 text-neon-blue" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Check your inbox</h2>
        <p className="mt-3 text-slate-700 dark:text-slate-400">
          Your account has been created. We&rsquo;ve sent a confirmation link to{' '}
          <span className="font-medium text-slate-900 dark:text-white">{registeredEmail}</span>.
          Confirm it to unlock the full member portal.
        </p>
        <Link href="/auth/login" className="btn-primary mt-8 inline-block">
          Go to sign in
        </Link>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('account.title')}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-400">{t('account.subtitle')}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('account.firstName')}</label>
                <input {...register('firstName')} autoComplete="given-name" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">{t('account.lastName')}</label>
                <input {...register('lastName')} autoComplete="family-name" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{tAuth('email')}</label>
              <input {...register('email')} type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">{tAuth('password')}</label>
              <input {...register('password')} type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">{t('account.confirmPassword')}</label>
              <input {...register('confirmPassword')} type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('profile.title')}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-400">{t('profile.subtitle')}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{tAuth('phone')}</label>
                <input {...register('phone')} autoComplete="tel" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('profile.dateOfBirth')}</label>
                <input {...register('dateOfBirth')} type="date" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{t('profile.buildingStreet')}</label>
                <input
                  {...register('address.buildingStreet')}
                  autoComplete="address-line1"
                  placeholder={t('profile.buildingStreetPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
                />
                {errors.address?.buildingStreet && <p className="mt-1 text-xs text-red-500">{errors.address.buildingStreet.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">{t('profile.locality')} <span className="text-slate-600 dark:text-slate-400">{t('profile.optional')}</span></label>
                <input
                  {...register('address.locality')}
                  autoComplete="address-line2"
                  placeholder={t('profile.localityPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">{t('profile.townCity')}</label>
                  <input
                    {...register('address.townCity', {
                      onChange: (e) => setValue('address.townCity', e.target.value.toUpperCase(), { shouldValidate: true })
                    })}
                    autoComplete="address-level2"
                    placeholder={t('profile.townCityPlaceholder')}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
                  />
                  {errors.address?.townCity && <p className="mt-1 text-xs text-red-500">{errors.address.townCity.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">{t('profile.postcode')}</label>
                  <input
                    {...register('address.postcode', {
                      onChange: (e) => setValue('address.postcode', e.target.value.toUpperCase(), { shouldValidate: true })
                    })}
                    autoComplete="postal-code"
                    placeholder={t('profile.postcodePlaceholder')}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
                  />
                  {errors.address?.postcode && <p className="mt-1 text-xs text-red-500">{errors.address.postcode.message}</p>}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('profile.emergencyContactName')}</label>
                <input {...register('emergencyContactName')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('profile.emergencyContactPhone')}</label>
                <input {...register('emergencyContactPhone')} autoComplete="tel" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('interests.title')}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-400">{t('interests.subtitle')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {interestOptions.map(({ value, label }) => {
                const checked = watchInterests.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const next = checked ? watchInterests.filter((i) => i !== value) : [...watchInterests, value];
                      setValue('interests', next, { shouldValidate: true });
                    }}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      checked ? 'border-neon-blue bg-neon-blue/10' : 'border-slate-300 bg-slate-200 dark:border-white/10 dark:bg-white/5'
                    }`}
                  >
                    <span className="text-sm font-medium">{label}</span>
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
            <h2 className="text-xl font-bold">{t('plan.title')}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-400">{t('plan.subtitle')}</p>
            {typesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
              </div>
            ) : typesError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <p className="text-sm text-red-500">
                  {t('plan.loadError')}
                </p>
                <button
                  type="button"
                  onClick={() => refetchTypes()}
                  className="btn-secondary mt-4 inline-flex text-sm"
                >
                  {t('plan.retry')}
                </button>
              </div>
            ) : types.length === 0 ? (
              <div className="rounded-xl border border-neon-gold/30 bg-neon-gold/10 p-6 text-center dark:border-neon-gold/20 dark:bg-neon-gold/5">
                <p className="text-sm text-slate-700 dark:text-slate-400">
                  {t('plan.noPlans')}
                </p>
              </div>
            ) : preferredTypeId && selectedTypeId === preferredTypeId && preferredType ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-neon-blue/30 bg-neon-blue/10 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-neon-blue">Preselected plan</p>
                      <h3 className="mt-1 text-lg font-bold">{preferredType.name}</h3>
                    </div>
                    <span className="rounded-full bg-neon-blue/20 px-3 py-1 text-xs font-semibold uppercase text-neon-blue">
                      Selected
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">This plan was chosen from the membership page and is already selected for you.</p>
                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-400">
                    <p className="font-semibold">{formatPrice(preferredType)}</p>
                    {preferredType.description ? <p className="mt-1">{preferredType.description}</p> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((type) => {
                  const selected = selectedTypeId === type.id;
                  const atCapacity = type.hasCapacity === false;
                  const issuedCount = type.issuedCount ?? 0;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      disabled={atCapacity}
                      onClick={() => setValue('membershipTypeId', type.id, { shouldValidate: true })}
                      className={`glass-card p-5 text-left transition-all ${
                        selected ? 'neon-border ring-1 ring-neon-blue' : ''
                      } ${
                        atCapacity ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-bold">{type.name}</h3>
                        {atCapacity ? (
                          <span className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-red-500">
                            Full
                          </span>
                        ) : (
                          selected && <Check className="h-5 w-5 text-neon-blue" />
                        )}
                      </div>
                      <p className="mt-2 text-2xl font-bold gradient-text">{formatPrice(type)}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {type.isFree ? t('plan.freeLabel') : t('plan.durationLabel', { duration: type.durationMonths })}
                      </p>
                      {type.maxIssuances ? (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {issuedCount}/{type.maxIssuances} issued
                        </p>
                      ) : null}
                      {type.description && <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{type.description}</p>}

                      {atCapacity ? (
                        <Link
                          href={`/contact?subject=${encodeURIComponent(`Membership waitlist: ${type.name}`)}&message=${encodeURIComponent(`Please add me to the waitlist for ${type.name}.`)}`}
                          className="mt-3 inline-flex items-center text-xs font-semibold text-neon-gold hover:underline"
                        >
                          Join waitlist
                        </Link>
                      ) : null}

                      <ul className="mt-3 space-y-1 text-xs text-slate-700 dark:text-slate-400">
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
            {errors.membershipTypeId && <p className="text-sm text-red-500">{t('plan.selectPlanError')}</p>}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('dependants.title')}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-400">{t('dependants.subtitle')}</p>

            {spouseIndex === -1 && (
              <button
                type="button"
                onClick={() => append({ name: '', age: 0, relationship: 'spouse' })}
                className="btn-secondary inline-flex text-sm"
              >
                <Plus className="mr-2 h-4 w-4" /> {t('dependants.addSpouse')}
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
                    <span className="text-sm font-semibold text-neon-gold">{t('dependants.spouse')}</span>
                    <button type="button" onClick={() => remove(spouseIndex)} className="text-red-500 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">{tAuth('name')}</label>
                      <input {...register(`dependants.${spouseIndex}.name` as const)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
                      {errors.dependants?.[spouseIndex]?.name && <p className="mt-1 text-xs text-red-500">{errors.dependants[spouseIndex]?.name?.message}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('dependants.age')}</label>
                      <input type="number" {...register(`dependants.${spouseIndex}.age` as const)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
                      {errors.dependants?.[spouseIndex]?.age && <p className="mt-1 text-xs text-red-500">{errors.dependants[spouseIndex]?.age?.message}</p>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4">
              <button type="button" onClick={() => append({ name: '', age: 0, relationship: 'child' })} className="btn-secondary inline-flex text-sm">
                <Plus className="mr-2 h-4 w-4" /> {t('dependants.addChild')}
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
                      <span className="text-sm font-semibold text-neon-blue">{t('dependants.child')}</span>
                      <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">{tAuth('name')}</label>
                        <input {...register(`dependants.${index}.name` as const)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
                        {errors.dependants?.[index]?.name && <p className="mt-1 text-xs text-red-500">{errors.dependants[index]?.name?.message}</p>}
                      </div>
                      <div>
                        <label className="text-sm font-medium">{t('dependants.age')}</label>
                        <input type="number" {...register(`dependants.${index}.age` as const)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" />
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
            <h2 className="text-xl font-bold">{t('review.title')}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-400">{t('review.subtitle')}</p>
            <div className="glass-card space-y-3 p-5 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-600 dark:text-slate-400">{t('review.name')}</span>
                <span className="font-medium">{watch('firstName')} {watch('lastName')}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-600 dark:text-slate-400">{tAuth('email')}</span>
                <span className="font-medium">{watch('email')}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-600 dark:text-slate-400">{t('review.address')}</span>
                <span className="text-right font-medium">
                  {watch('address.buildingStreet')}<br />
                  {watch('address.locality') ? <>{watch('address.locality')}<br /></> : null}
                  {watch('address.townCity')}<br />
                  {watch('address.postcode')}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-slate-600 dark:text-slate-400">{t('review.plan')}</span>
                <span className="font-medium">{selectedType ? `${selectedType.name} (${formatPrice(selectedType)})` : '-'}</span>
              </div>
              {membershipFee && membershipFee.fee > 0 && (
                <>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-slate-600 dark:text-slate-400">{tCommon('processingFee')}</span>
                    <span className="font-medium">{formatCurrency(membershipFee.fee / 100)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-slate-600 dark:text-slate-400">{tCommon('totalToPay')}</span>
                    <span className="font-medium">{formatCurrency(membershipFee.gross / 100)}</span>
                  </div>
                </>
              )}
              {dependants.length > 0 && (
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-600 dark:text-slate-400">{t('review.dependants')}</span>
                  <span className="font-medium">{dependants.length}</span>
                </div>
              )}
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" {...register('acceptedTerms')} className="mt-1 h-4 w-4 rounded border-slate-300 bg-white text-neon-blue dark:border-white/10 dark:bg-white/10" />
              <span className="text-sm text-slate-700 dark:text-slate-400">
                {t('review.termsText')}
              </span>
            </label>
            {errors.acceptedTerms && <p className="text-sm text-red-500">{errors.acceptedTerms.message}</p>}
            {selectedType && !selectedType.isFree && (
              <p className="text-center text-sm text-slate-700 dark:text-slate-400">
                {t('review.paymentRedirect', { price: membershipFee ? formatCurrency(membershipFee.gross / 100) : formatPrice(selectedType) })}
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
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className={`flex flex-col items-center gap-2 ${idx > 0 ? 'w-full' : ''}`}>
                {idx > 0 && <div className={`mb-2 h-0.5 w-full ${completed ? 'bg-neon-blue' : 'bg-white/10'}`} />}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    active ? 'border-neon-blue bg-neon-blue/10 text-neon-blue' : completed ? 'border-neon-blue bg-neon-blue text-slate-950' : 'border-slate-300 bg-slate-200 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`hidden text-xs sm:block ${active ? 'text-neon-blue' : 'text-slate-600 dark:text-slate-400'}`}>{s.title}</span>
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
            className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-0 dark:hover:bg-white/5 dark:text-slate-400"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> {tCommon('back')}
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={nextStep}
              className="btn-primary inline-flex"
            >
              {tCommon('next')} <ChevronRight className="ml-1 h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary inline-flex"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('buttons.processing')}
                </>
              ) : selectedType && !selectedType.isFree ? (
                <>
                  {t('buttons.proceedToPayment')} <ChevronRight className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  {t('buttons.completeRegistration')} <Check className="ml-1 h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
