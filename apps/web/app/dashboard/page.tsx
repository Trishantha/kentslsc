'use client';

import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDate } from '@/lib/utils';
import {
  Download,
  QrCode,
  CreditCard,
  Loader2,
  X,
  Calendar,
  Users,
  Briefcase,
  MessageSquare,
  Ticket,
  Vote,
  Store,
  Sparkles,
  ArrowRight,
  User,
  Mail,
  Save,
  RefreshCw,
  Plus,
  Trash2
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { TicketCard } from '@/components/ui/TicketCard';
import type { TicketCardProps } from '@/components/ui/TicketCard';
import {
  MembershipFeature,
  membershipFeatureLabels,
  updateUserSchema,
  type UpdateUserInput
} from '@kentslsc/shared';

interface MembershipResponse {
  id: string;
  membershipId: string;
  status: string;
  progressStage?: 'FORM_SUBMITTED' | 'PAYMENT_PROCESSED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  startDate: string;
  endDate: string;
  cardUrl: string | null;
  qr: string | null;
  dependantsCount: number;
  dependants: { name: string; age: number; relationship: string }[];
  paidAt: string | null;
  paymentMethod: string | null;
  creditAmountApplied: number | null;
  creditMonthsGranted: number | null;
  stripeSubscriptionId: string | null;
  membershipType: {
    name: string;
    description?: string | null;
    benefits: string[];
    features: MembershipFeature[];
    isFree: boolean;
    price: number;
  };
}

interface UpsellOption {
  feature: MembershipFeature;
  icon: ElementType;
}

const upsellOptions: UpsellOption[] = [
  { feature: MembershipFeature.FORUM_POST, icon: MessageSquare },
  { feature: MembershipFeature.TICKETS_PURCHASE, icon: Ticket },
  { feature: MembershipFeature.MEMBER_CARD, icon: CreditCard },
  { feature: MembershipFeature.VOTING_RIGHTS, icon: Vote },
  { feature: MembershipFeature.DIRECTORY_LISTING, icon: Store },
  { feature: MembershipFeature.DEPENDANTS, icon: Users }
];

const quickActions = [
  {
    href: '/directory',
    title: 'Post a job',
    description: 'Publish opportunities from your business profile.',
    icon: Briefcase
  },
  {
    href: '/events',
    title: 'Buy tickets',
    description: 'Reserve seats for upcoming events and activities.',
    icon: Ticket
  },
  {
    href: '/directory',
    title: 'Promote business',
    description: 'Boost visibility for your business listing.',
    icon: Store
  },
  {
    href: '/forum',
    title: 'Join the forum',
    description: 'Ask questions and connect with other members.',
    icon: MessageSquare
  }
] as const;

function MembershipProgressSteps({ stage }: { stage?: MembershipResponse['progressStage'] }) {
  if (stage === 'REJECTED') {
    return (
      <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
        Your application was not accepted. If you paid online, it has been refunded.
      </div>
    );
  }

  const steps = [
    { key: 'FORM_SUBMITTED', label: 'Form submitted' },
    { key: 'PAYMENT_PROCESSED', label: 'Payment processed' },
    { key: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
    { key: 'APPROVED', label: 'Approved' }
  ] as const;
  const activeIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const done = activeIndex >= 0 && index <= activeIndex;
        return (
          <span
            key={step.key}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              done ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-slate-500'
            }`}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

function ProfileCard() {
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
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
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>
            )}
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
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>
            )}
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
              {errors.address?.townCity && (
                <p className="mt-1 text-xs text-red-400">{errors.address.townCity.message}</p>
              )}
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
              {errors.address?.postcode && (
                <p className="mt-1 text-xs text-red-400">{errors.address.postcode.message}</p>
              )}
            </div>
          </div>
        </div>

        {updateProfile.error && (
          <p className="text-sm text-red-400">Failed to save profile. Please try again.</p>
        )}
        {success && (
          <p className="text-sm text-green-400">Profile saved successfully.</p>
        )}

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

function BecomeMemberCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-6 glass-card p-8 text-center"
    >
      <h2 className="text-xl font-bold">Become a Member</h2>
      <p className="mt-2 text-slate-700 dark:text-slate-400">
        You do not have an active membership yet. Join today to unlock member benefits.
      </p>
      <Link href="/membership" className="btn-primary mt-6 inline-block">
        View Membership Plans
      </Link>
    </motion.div>
  );
}

function UpgradePrompt({ membership }: { membership: MembershipResponse }) {
  const missing = upsellOptions.filter(
    (option) => !membership.membershipType.features.includes(option.feature)
  );

  if (missing.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-10"
    >
      <h2 className="section-title text-2xl">Unlock more benefits</h2>
      <p className="mt-2 text-slate-700 dark:text-slate-400">
        Your current plan does not include these features. Upgrade to get the full member experience.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {missing.map((option) => {
          const def = membershipFeatureLabels[option.feature];
          const Icon = option.icon;
          return (
            <div
              key={option.feature}
              className="glass-card flex flex-col p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-gold/10 text-neon-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{def?.label ?? option.feature}</h3>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-700 dark:text-slate-400">
                {def?.description ?? ''}
              </p>
              <Link
                href="/membership"
                className="mt-4 inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
              >
                Upgrade <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function TicketsSection() {
  const { data: tickets, isLoading } = useQuery<TicketCardProps['ticket'][]>({
    queryKey: ['tickets', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<TicketCardProps['ticket'][]>('/tickets');
      return data;
    }
  });

  const upcomingTickets =
    tickets?.filter(
      (ticket) =>
        ticket.status === 'VALID' &&
        new Date(ticket.event.endDatetime) > new Date()
    ) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mt-10"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title text-2xl">My Tickets</h2>
        <Link
          href="/dashboard/tickets"
          className="inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
        >
          View all tickets <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
      <p className="mt-2 text-slate-700 dark:text-slate-400">
        Your upcoming event tickets.
      </p>

      {isLoading && (
        <div className="mt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {upcomingTickets.slice(0, 3).map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {!isLoading && upcomingTickets.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white/5 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            You do not have any upcoming tickets.
          </p>
          <Link href="/events" className="btn-primary mt-4 inline-block">
            Browse events
          </Link>
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [showQr, setShowQr] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [cardRetry, setCardRetry] = useState(Date.now);
  const [cardRetryCount, setCardRetryCount] = useState(0);

  const confirmMembershipPayment = useMutation({
    mutationFn: async ({ sessionId, provider }: { sessionId: string; provider: string }) => {
      const res = await api.post('/payments/confirm-session', { sessionId, provider });
      return res.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    }
  });

  // Refetch membership details after an upgrade redirect so the UI doesn't
  // show stale/cached data from before the membership changed.
  // Also confirm the payment when returning from Stripe so memberships are
  // activated even if the webhook was delayed or dropped.
  const membershipParam = searchParams.get('membership');
  const sessionIdParam = searchParams.get('session_id');
  const providerParam = searchParams.get('provider') ?? 'stripe';

  useEffect(() => {
    if (membershipParam) {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    }

    if (membershipParam === 'success' && sessionIdParam && !confirmMembershipPayment.isPending) {
      confirmMembershipPayment.mutate({ sessionId: sessionIdParam, provider: providerParam });
    }
  }, [membershipParam, sessionIdParam, providerParam, queryClient, confirmMembershipPayment]);

  const {
    data: membership,
    error
  } = useQuery<MembershipResponse | null>({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const res = await api.get('/membership/me');
      return res.data;
    },
    retry: false
  });

  const supportsDependants = membership?.membershipType.features?.includes(MembershipFeature.DEPENDANTS) ?? false;
  const [editedDependants, setEditedDependants] = useState(membership?.dependants ?? []);
  const [dependantsError, setDependantsError] = useState<string | null>(null);
  const [dependantsSaved, setDependantsSaved] = useState(false);

  useEffect(() => {
    if (membership) {
      setEditedDependants(membership.dependants ?? []);
    }
  }, [membership?.dependantsCount]);

  const updateDependants = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/membership/me/dependants', { dependants: editedDependants });
      return res.data;
    },
    onSuccess: () => {
      setDependantsError(null);
      setDependantsSaved(true);
      setTimeout(() => setDependantsSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    },
    onError: (err) => {
      setDependantsSaved(false);
      setDependantsError(getApiErrorMessage(err));
    }
  });

  const regenerateCard = useMutation({
    mutationFn: async () => {
      const res = await api.post('/membership/me/regenerate-card');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
      setCardError(false);
      setCardRetryCount(0);
      setCardRetry(Date.now());
    },
    onError: () => {
      setCardError(true);
    }
  });

  const billingPortal = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ url: string }>('/membership/billing-portal');
      return res.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    }
  });

  const cardAssetUrl = membership?.cardUrl
    ? `/api/membership/card?membershipId=${encodeURIComponent(membership.membershipId)}&t=${cardRetry}`
    : null;

  // Reset error/retry state only when the stored card URL actually changes,
  // not when the cache-busting timestamp changes. This prevents an infinite
  // retry loop that causes the screen to flicker while the image keeps reloading.
  useEffect(() => {
    setCardError(false);
    setCardRetryCount(0);
  }, [membership?.cardUrl, membership?.membershipId]);

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="section-title">Member Dashboard</h1>
        <p className="mt-4 text-slate-700 dark:text-slate-400">
          Manage your profile, view your membership details, and upgrade your plan.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            We could not load your membership details right now. You can still update your profile below.
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * index }}
              >
                <Link
                  href={action.href}
                  className="glass-card block h-full p-5 transition-transform hover:-translate-y-1"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/15 text-neon-blue">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{action.title}</h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{action.description}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <ProfileCard />

          {membership && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-neon-blue" />
                  <h2 className="text-xl font-bold">Membership Status</h2>
                </div>

                {membership.status !== 'ACTIVE' && membership.status !== 'EXPIRED' && (
                  <MembershipProgressSteps stage={membership.progressStage} />
                )}

                <div className="mt-6 space-y-4">
                  <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
                    <span className="text-slate-700 dark:text-slate-400">Type</span>
                    <span className="font-semibold">{membership.membershipType.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
                    <span className="text-slate-700 dark:text-slate-400">Status</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        membership.status === 'ACTIVE'
                          ? 'bg-green-500/20 text-green-400'
                          : membership.status === 'AWAITING_APPROVAL'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {membership.status === 'AWAITING_APPROVAL'
                        ? 'Awaiting approval'
                        : membership.status}
                    </span>
                  </div>
                  {(membership.creditAmountApplied ?? 0) > 0 && (
                    <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
                      <span className="text-slate-700 dark:text-slate-400">Credit applied</span>
                      <span className="text-sm font-semibold text-neon-gold">
                        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(membership.creditAmountApplied ?? 0)}
                        {' '}({membership.creditMonthsGranted} free month
                        {(membership.creditMonthsGranted ?? 0) === 1 ? '' : 's'})
                      </span>
                    </div>
                  )}
                  {!membership.membershipType.isFree && (
                    <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
                      <span className="text-slate-700 dark:text-slate-400">Payment</span>
                      {membership.paymentMethod ? (
                        <span className="text-sm font-semibold text-green-400">
                          Paid {membership.paymentMethod}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-yellow-400">
                          Payment pending
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
                    <span className="text-slate-700 dark:text-slate-400">Membership ID</span>
                    <span className="font-mono font-semibold">{membership.membershipId}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
                    {membership.membershipType.isFree ? (
                      <>
                        <Sparkles className="h-4 w-4 text-neon-gold" />
                        <span className="text-sm font-semibold text-neon-gold">Lifetime membership</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-sm text-slate-700 dark:text-slate-400">
                          {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-400">
                      {membership.dependantsCount} dependant
                      {membership.dependantsCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  {membership.stripeSubscriptionId && (
                    <button
                      type="button"
                      onClick={() => billingPortal.mutate()}
                      disabled={billingPortal.isPending}
                      className="btn-secondary mt-4 w-full text-sm"
                    >
                      {billingPortal.isPending ? (
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      ) : null}
                      Manage subscription
                    </button>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="h-6 w-6 text-neon-gold" />
                  <h2 className="text-xl font-bold">Membership Card</h2>
                </div>

                {cardAssetUrl ? (
                  <div className="mt-6 flex flex-col items-center gap-6">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-300 shadow-xl dark:border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={cardAssetUrl}
                        src={cardAssetUrl}
                        alt="Membership card"
                        className="max-h-72 w-auto object-contain"
                        onError={() => {
                          setCardError(true);
                          if (cardRetryCount < 2) {
                            setCardRetryCount((c) => c + 1);
                            setCardRetry(Date.now());
                          }
                        }}
                        onLoad={() => setCardError(false)}
                      />
                    </div>
                    {cardError && (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <p className="text-sm text-red-400">
                          Could not load the membership card. The stored card may be missing or broken.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          {cardRetryCount >= 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCardError(false);
                                setCardRetryCount(0);
                                setCardRetry(Date.now());
                              }}
                              className="inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
                            >
                              <RefreshCw className="mr-1 h-4 w-4" /> Retry
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => regenerateCard.mutate()}
                            disabled={regenerateCard.isPending}
                            className="inline-flex items-center text-sm font-medium text-neon-gold hover:underline disabled:opacity-50"
                          >
                            {regenerateCard.isPending ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-4 w-4" />
                            )}
                            Regenerate card
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                      <a
                        href={cardAssetUrl}
                        download={`kent-slsc-card-${membership.membershipId}.png`}
                        className={`btn-primary inline-flex ${cardError ? 'pointer-events-none opacity-50' : ''}`}
                        aria-disabled={cardError}
                      >
                        <Download className="mr-2 h-4 w-4" /> Download Card
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowQr(true)}
                        className="btn-secondary inline-flex"
                      >
                        <QrCode className="mr-2 h-4 w-4" /> Show QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-slate-300 bg-slate-200/50 p-8 text-center dark:border-white/10 dark:bg-white/5">
                    {membership.status === 'AWAITING_APPROVAL' ? (
                      <>
                        <p className="text-slate-700 dark:text-slate-400">
                          Your application is being reviewed. Once an admin approves it and payment is confirmed, your digital membership card will be generated here.
                        </p>
                        {membership.paymentMethod ? (
                          <p className="text-sm font-semibold text-green-400">
                            Payment received ({membership.paymentMethod})
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-yellow-400">
                            Awaiting payment confirmation
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-slate-700 dark:text-slate-400">
                          Your digital membership card is not available yet. This can happen while the card is being generated or if storage is temporarily unavailable.
                        </p>
                        {regenerateCard.isError && (
                          <p className="text-sm text-red-400">
                            Could not generate the card. Please check that storage is configured and try again.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => regenerateCard.mutate()}
                          disabled={regenerateCard.isPending}
                          className="btn-primary inline-flex items-center disabled:opacity-50"
                        >
                          {regenerateCard.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Generate card
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </div>

        {!membership && <BecomeMemberCTA />}

        <TicketsSection />

        {membership && supportsDependants && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 glass-card p-6"
          >
            <h2 className="text-lg font-bold">Dependants</h2>

            {editedDependants.length === 0 && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                You have not added any dependants yet.
              </p>
            )}

            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {editedDependants.map((dep, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-slate-300 bg-slate-200/50 p-4 text-sm dark:border-white/10 dark:bg-white/5"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-semibold text-neon-blue capitalize">
                      {dep.relationship}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditedDependants((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-red-500 hover:text-red-400"
                      title="Remove dependant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-slate-500">Name</label>
                      <input
                        type="text"
                        value={dep.name}
                        onChange={(e) =>
                          setEditedDependants((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, name: e.target.value } : d))
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Age</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={dep.age}
                        onChange={(e) =>
                          setEditedDependants((prev) =>
                            prev.map((d, i) =>
                              i === idx ? { ...d, age: Number(e.target.value) || 0 } : d
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Relationship</label>
                      <select
                        value={dep.relationship}
                        onChange={(e) =>
                          setEditedDependants((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? { ...d, relationship: e.target.value as 'spouse' | 'child' }
                                : d
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                      >
                        <option value="spouse">Spouse</option>
                        <option value="child">Child</option>
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-3">
              {!editedDependants.some((d) => d.relationship === 'spouse') && (
                <button
                  type="button"
                  onClick={() =>
                    setEditedDependants((prev) => [
                      ...prev,
                      { name: '', age: 0, relationship: 'spouse' }
                    ])
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-neon-gold/10 px-4 py-2 text-sm font-semibold text-neon-gold transition-colors hover:bg-neon-gold/20"
                >
                  <Plus className="h-4 w-4" /> Add spouse
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setEditedDependants((prev) => [
                    ...prev,
                    { name: '', age: 0, relationship: 'child' }
                  ])
                }
                className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20"
              >
                <Plus className="h-4 w-4" /> Add child
              </button>
            </div>

            <button
              type="button"
              onClick={() => updateDependants.mutate()}
              disabled={updateDependants.isPending}
              className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
            >
              {updateDependants.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save dependants
            </button>

            {dependantsSaved && (
              <p className="mt-3 text-sm text-green-400">Dependants saved successfully.</p>
            )}
            {dependantsError && (
              <p className="mt-3 text-sm text-red-400">{dependantsError}</p>
            )}
          </motion.div>
        )}

        {membership && <UpgradePrompt membership={membership} />}
      </div>

      {showQr && membership?.qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Membership QR</h3>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={membership.qr} size={200} />
            </div>
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">Scan to verify membership</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
