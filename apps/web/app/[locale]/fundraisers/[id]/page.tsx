import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchWithRetryResult } from '@/lib/server-fetch';
import JsonLd from '@/components/JsonLd';
import FundraiserDetailContent, { type Fundraiser } from './FundraiserDetailContent';
import { getServerApiUrl } from '@/lib/api-base';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

type FetchFundraiserResult =
  | { kind: 'found'; data: Fundraiser }
  | { kind: 'not-found' }
  | { kind: 'error'; status: number | null };

async function fetchFundraiser(id: string): Promise<FetchFundraiserResult> {
  const apiUrl = await getServerApiUrl();
  const result = await fetchWithRetryResult(`${apiUrl}/api/fundraisers/${id}`, {
    next: { revalidate: 60 }
  });

  if (!result.ok) {
    return { kind: 'error', status: result.status };
  }

  if (result.response.status === 404) {
    return { kind: 'not-found' };
  }

  if (!result.response.ok) {
    return { kind: 'error', status: result.response.status };
  }

  const data = (await result.response.json()) as Fundraiser;
  return { kind: 'found', data };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fundraiserResult = await fetchFundraiser(id);
  if (fundraiserResult.kind !== 'found') return {};

  const fundraiser = fundraiserResult.data;
  const description =
    fundraiser.aiSummary ??
    fundraiser.description?.slice(0, 160).replace(/\n/g, ' ') ??
    `Support ${fundraiser.title}`;
  const image = fundraiser.imageUrl ?? '/opengraph-image';
  return {
    title: fundraiser.title,
    description,
    openGraph: {
      title: fundraiser.title,
      description,
      type: 'website',
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: fundraiser.title,
      description,
      images: [image]
    },
    alternates: {
      canonical: `/fundraisers/${fundraiser.id}`
    }
  };
}

export default async function FundraiserDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const result = await fetchFundraiser(id);

  if (result.kind === 'not-found') {
    notFound();
  }

  if (result.kind === 'error') {
    return (
      <div className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-bold">Unable to load campaign</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            We could not load this fundraising campaign right now. Please try again in a moment.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {result.status ? `API error: HTTP ${result.status}` : 'Could not reach the server.'}
          </p>
        </div>
      </div>
    );
  }

  const fundraiser = result.data;
  const baseUrl =
    process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
  const localePath = locale === 'en' ? '' : `/${locale}`;
  const shareUrl = `${baseUrl}${localePath}/fundraisers/${fundraiser.id}`;
  const fundraiserSchema = {
    '@context': 'https://schema.org',
    '@type': 'FundraiserCampaign',
    name: fundraiser.title,
    description: fundraiser.aiSummary ?? fundraiser.description ?? `Support ${fundraiser.title}`,
    image: fundraiser.imageUrl ?? `${baseUrl}/opengraph-image`,
    url: shareUrl,
    startDate: fundraiser.startDate,
    endDate: fundraiser.endDate,
    goal: {
      '@type': 'MonetaryAmount',
      currency: 'GBP',
      value: Number(fundraiser.targetAmount)
    },
    raised: {
      '@type': 'MonetaryAmount',
      currency: 'GBP',
      value: Number(fundraiser.raisedAmount)
    },
    organizer: {
      '@type': 'Organization',
      name: 'Kent Sri Lankan Social Club',
      url: baseUrl
    }
  };

  return (
    <>
      <JsonLd data={fundraiserSchema} />
      <FundraiserDetailContent fundraiser={fundraiser} shareUrl={shareUrl} />
    </>
  );
}
