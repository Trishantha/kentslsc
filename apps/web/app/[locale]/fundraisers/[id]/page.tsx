import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchWithRetry } from '@/lib/server-fetch';
import JsonLd from '@/components/JsonLd';
import FundraiserDetailContent, { type Fundraiser } from './FundraiserDetailContent';
import { serverApiUrl } from '@/lib/api-base';

interface Props {
  params: { locale: string; id: string };
}

async function fetchFundraiser(id: string): Promise<Fundraiser | null> {
  const res = await fetchWithRetry(`${serverApiUrl}/api/fundraisers/${id}`, { next: { revalidate: 60 } });
  if (!res || !res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fundraiser = await fetchFundraiser(params.id);
  if (!fundraiser) return {};
  const description = fundraiser.aiSummary ?? fundraiser.description?.slice(0, 160).replace(/\n/g, ' ') ?? `Support ${fundraiser.title}`;
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
  const fundraiser = await fetchFundraiser(params.id);
  if (!fundraiser) notFound();

  const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
  const localePath = params.locale === 'en' ? '' : `/${params.locale}`;
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
