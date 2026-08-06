'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode, CreditCard, Loader2, X, Calendar, Users } from 'lucide-react';
import { api } from '@/lib/api';

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
  membershipType: { name: string; description?: string | null; benefits: string[] };
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
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="section-title">Member Dashboard</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            You do not have an active membership yet.
          </p>
          <Link href="/membership" className="btn-primary mt-8 inline-block">
            Become a Member
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="section-title">Member Dashboard</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Manage your membership, download your card, and show your QR code.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-neon-blue" />
              <h2 className="text-xl font-bold">Membership Status</h2>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-600 dark:text-slate-400">Type</span>
                <span className="font-semibold">{membership.membershipType.name}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-600 dark:text-slate-400">Status</span>
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
              <div className="flex justify-between border-b border-white/10 pb-3">
                <span className="text-slate-600 dark:text-slate-400">Membership ID</span>
                <span className="font-mono font-semibold">{membership.membershipId}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {new Date(membership.startDate).toLocaleDateString('en-GB')} –{' '}
                  {new Date(membership.endDate).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {membership.dependantsCount} dependant
                  {membership.dependantsCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3">
              <QrCode className="h-6 w-6 text-neon-gold" />
              <h2 className="text-xl font-bold">Membership Card</h2>
            </div>

            {membership.cardUrl ? (
              <div className="mt-6 flex flex-col items-center gap-6">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-xl">
                  <img
                    src={membership.cardUrl}
                    alt="Membership card"
                    className="max-h-72 w-auto object-contain"
                  />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <a
                    href={membership.cardUrl}
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
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">Your card is being generated.</p>
              </div>
            )}
          </motion.div>
        </div>

        {membership.dependants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 glass-card p-6"
          >
            <h2 className="text-lg font-bold">Dependants</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {membership.dependants.map((dep, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{dep.name}</span>
                  <span className="ml-2 text-slate-500">({dep.relationship})</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

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
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={membership.qr} size={200} />
            </div>
            <p className="mt-4 text-xs text-slate-500">Scan to verify membership</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
