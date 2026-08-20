import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import JsonLd from '@/components/JsonLd';
import FundraiserDetailContent, { type Fundraiser } from './FundraiserDetailContent';
import { getFrontendUrl } from '@/lib/env';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

async function fetchFundraiser(id: string): Promise<Fundraiser | null> {
  return fetchWithOriginFallback<Fundraiser>(`/api/fundraisers/${id}`, { next: { revalidate: 60 } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fundraiser = await fetchFundraiser(id);
  if (!fundraiser) return {};
  const description = fundraiser.description?.slice(0, 160).replace(/\n/g, ' ') ?? `Support ${fundraiser.title}`;
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
  const fundraiser = await fetchFundraiser(id);
  if (!fundraiser) notFound();

  const baseUrl = getFrontendUrl();
  const localePath = locale === 'en' ? '' : `/${locale}`;
  const shareUrl = `${baseUrl}${localePath}/fundraisers/${fundraiser.id}`;
  const fundraiserSchema = {
    '@context': 'https://schema.org',
    '@type': 'FundraiserCampaign',
    name: fundraiser.title,
    description: fundraiser.description ?? `Support ${fundraiser.title}`,
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
