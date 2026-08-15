import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckCircle2, XCircle, Calendar, Users, Shield } from 'lucide-react';
import { fetchApiWithOriginFallback } from '@/lib/server-fetch';
import { formatDate } from '@/lib/utils';


interface VerifyPageProps {
  params: Promise<{ locale: string; id: string }>;
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
  const result = await fetchApiWithOriginFallback(
    `/api/membership/verify/${encodeURIComponent(id)}`,
    { next: { revalidate: 0 } }
  );
  if (!result.ok || !result.response.ok) return null;
  return (await result.response.json()) as VerificationResult;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'membershipVerify' });
  return {
    title: t('metaTitle')
  };
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'membershipVerify' });
  const result = await verifyMembership(id);
  if (!result) notFound();

  const isActive = result.valid && result.status === 'ACTIVE';

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="glass-card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neon-blue/10">
          <Shield className="h-8 w-8 text-neon-blue" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">{t('title')}</h1>

        <div className="mt-6 flex items-center justify-center gap-2">
          {isActive ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="text-lg font-semibold text-green-500">{t('valid')}</span>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-500" />
              <span className="text-lg font-semibold text-red-500">{t('invalid')}</span>
            </>
          )}
        </div>

        <div className="mt-8 space-y-4 text-left">
          <div className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate-600 dark:text-slate-400">{t('member')}</span>
            <span className="font-semibold">{result.memberName}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate-600 dark:text-slate-400">{t('membershipId')}</span>
            <span className="font-mono font-semibold">{result.membershipId}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate-600 dark:text-slate-400">{t('type')}</span>
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
              {t('dependants', { count: result.dependantsCount })}
            </span>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          {t('verifiedBy')}
        </p>
      </div>
    </div>
  );
}
