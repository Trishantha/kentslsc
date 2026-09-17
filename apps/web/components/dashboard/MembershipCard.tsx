'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CreditCard, QrCode, Download, Calendar, Users, Sparkles, Loader2, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { MembershipProgressSteps } from './MembershipProgressSteps';
import { useMyMembership } from './useMyMembership';

export function MembershipCard() {
  const queryClient = useQueryClient();
  const { data: membership, isLoading, error } = useMyMembership();
  const [showQr, setShowQr] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [cardRetry, setCardRetry] = useState(Date.now);
  const [cardRetryCount, setCardRetryCount] = useState(0);

  const regenerateCard = useMutation({
    mutationFn: async () => {
      const res = await api.post('/membership/me/regenerate-card');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
      setCardError(false);
      setCardRetryCount(0);
      setCardRetry(Date.now);
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

  useEffect(() => {
    setCardError(false);
    setCardRetryCount(0);
  }, [membership?.cardUrl, membership?.membershipId]);

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-neon-blue" />
          <h2 className="text-xl font-bold">Membership</h2>
        </div>
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
        </div>
      </div>
    );
  }

  if (error || !membership) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-neon-blue" />
          <h2 className="text-xl font-bold">Membership</h2>
        </div>
        <p className="mt-4 text-sm text-red-400">
          We could not load your membership details right now.
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-neon-blue" />
          <h2 className="text-xl font-bold">Membership</h2>
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
                    : membership.status === 'AWAITING_PAYMENT'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {membership.status === 'AWAITING_APPROVAL'
                ? 'Awaiting approval'
                : membership.status === 'AWAITING_PAYMENT'
                  ? 'Awaiting payment'
                  : membership.status}
            </span>
          </div>
          {(membership.creditAmountApplied ?? 0) > 0 && (
            <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
              <span className="text-slate-700 dark:text-slate-400">Credit applied</span>
              <span className="text-sm font-semibold text-neon-gold">
                {formatCurrency(membership.creditAmountApplied ?? 0)}{' '}
                ({membership.creditMonthsGranted} free month
                {(membership.creditMonthsGranted ?? 0) === 1 ? '' : 's'})
              </span>
            </div>
          )}
          {!membership.membershipType.isFree && (
            <div className="flex justify-between border-b border-slate-300 pb-3 dark:border-white/10">
              <span className="text-slate-700 dark:text-slate-400">Payment</span>
              {membership.paymentMethod ? (
                <span className="text-sm font-semibold text-green-400">Paid {membership.paymentMethod}</span>
              ) : (
                <span className="text-sm font-semibold text-yellow-400">Payment pending</span>
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
              {membership.dependantsCount} dependant{membership.dependantsCount === 1 ? '' : 's'}
            </span>
          </div>
          {membership.stripeSubscriptionId && (
            <button
              type="button"
              onClick={() => billingPortal.mutate()}
              disabled={billingPortal.isPending}
              className="btn-secondary mt-4 w-full text-sm"
            >
              {billingPortal.isPending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
              Manage subscription
            </button>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card mt-6 p-6"
      >
        <div className="flex items-center gap-3">
          <QrCode className="h-6 w-6 text-neon-gold" />
          <h2 className="text-xl font-bold">Membership Card</h2>
        </div>

        {cardAssetUrl ? (
          <div className="mt-6 flex flex-col items-center gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-slate-300 shadow-xl dark:border-white/10">
              <img
                key={cardAssetUrl}
                src={cardAssetUrl}
                alt="Membership card"
                className="max-h-72 w-auto object-contain"
                onError={() => {
                  setCardError(true);
                  if (cardRetryCount < 2) {
                    setCardRetryCount((c) => c + 1);
                    setCardRetry(Date.now);
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
                        setCardRetry(Date.now);
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
            {membership.status === 'AWAITING_APPROVAL' || membership.status === 'AWAITING_PAYMENT' ? (
              <>
                <p className="text-slate-700 dark:text-slate-400">
                  {membership.status === 'AWAITING_APPROVAL'
                    ? 'Your application is being reviewed. Once an admin approves it, you will receive an email with a payment link.'
                    : 'Your application has been approved. Please check your email for the payment link. Your digital membership card will be generated once payment is confirmed.'}
                </p>
                {membership.paymentMethod ? (
                  <p className="text-sm font-semibold text-green-400">Payment received ({membership.paymentMethod})</p>
                ) : (
                  <p className="text-sm font-semibold text-yellow-400">Awaiting payment</p>
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

      <AnimatePresence>
        {showQr && membership.qr && (
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
                  className="text-slate-600 hover:text-slate-300 dark:text-slate-400"
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
      </AnimatePresence>
    </>
  );
}
