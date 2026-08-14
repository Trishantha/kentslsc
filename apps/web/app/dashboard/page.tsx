'use client';

import { useState, type ElementType } from 'react';
import Link from 'next/link';
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
  Save
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
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
  startDate: string;
  endDate: string;
  cardUrl: string | null;
  qr: string | null;
  dependantsCount: number;
  dependants: { name: string; relationship: string }[];
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

export default function DashboardPage() {
  const [showQr, setShowQr] = useState(false);

  const {
    data: membership,
    isLoading,
    error
  } = useQuery<MembershipResponse | null>({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const res = await api.get('/membership/me');
      return res.data;
    },
    retry: false
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const cardAssetUrl = membership
    ? `/api/membership/card?membershipId=${encodeURIComponent(membership.membershipId)}`
    : null;

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
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {membership.status}
                    </span>
                  </div>
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
                        src={cardAssetUrl}
                        alt="Membership card"
                        className="max-h-72 w-auto object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <a
                        href={cardAssetUrl}
                        download={`kent-slsc-card-${membership.membershipId}.png`}
                        className="btn-primary inline-flex"
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
                  <div className="mt-6 rounded-2xl border border-slate-300 bg-slate-200/50 p-8 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="text-slate-700 dark:text-slate-400">
                      Your digital membership card will appear here once your membership is active.
                    </p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </div>

        {!membership && <BecomeMemberCTA />}

        {membership && membership.dependants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 glass-card p-6"
          >
            <h2 className="text-lg font-bold">Dependants</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {membership.dependants.map((dep, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-slate-300 bg-slate-200/50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
                >
                  <span className="font-semibold">{dep.name}</span>
                  <span className="ml-2 text-slate-600 dark:text-slate-400">({dep.relationship})</span>
                </li>
              ))}
            </ul>
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
