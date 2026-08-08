import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckCircle2, XCircle, Calendar, Users, Shield } from 'lucide-react';
import { fetchWithRetry } from '@/lib/server-fetch';
import { formatDate } from '@/lib/utils';

interface VerifyPageProps {
  params: { id: string };
}

interface VerificationResult {
  valid: boolean;
  membershipId: string;
  memberName: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  dependantsCount: number;
}

async function verifyMembership(id: string): Promise<VerificationResult | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  const res = await fetchWithRetry(
    `${baseUrl}/membership/verify/${encodeURIComponent(id)}`,
    { next: { revalidate: 0 } }
  );
  if (!res || !res.ok) return null;
  return (await res.json()) as VerificationResult;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  return {
    title: `Verify Membership – Kent SLSC`
  };
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const result = await verifyMembership(params.id);
  if (!result) notFound();

  const isActive = result.valid && result.status === 'ACTIVE';

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="glass-card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neon-blue/10">
          <Shield className="h-8 w-8 text-neon-blue" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">Membership Verification</h1>

        <div className="mt-6 flex items-center justify-center gap-2">
          {isActive ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="text-lg font-semibold text-green-500">Valid Membership</span>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-500" />
              <span className="text-lg font-semibold text-red-500">Invalid or Expired</span>
            </>
          )}
        </div>

        <div className="mt-8 space-y-4 text-left">
          <div className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate-600 dark:text-slate-400">Member</span>
            <span className="font-semibold">{result.memberName}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate-600 dark:text-slate-400">Membership ID</span>
            <span className="font-mono font-semibold">{result.membershipId}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate-600 dark:text-slate-400">Type</span>
            <span className="font-semibold">{result.type}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-3">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {formatDate(result.startDate)} – {formatDate(result.endDate)}
            </span>
          </div>
          <div className="flex justify-between">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {result.dependantsCount} dependant
              {result.dependantsCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Verified by Kent Sri Lankan Social Club
        </p>
      </div>
    </div>
  );
}
