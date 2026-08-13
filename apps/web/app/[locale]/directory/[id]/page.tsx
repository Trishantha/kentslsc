import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import DirectoryDetailContent, { type Business } from './DirectoryDetailContent';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchBusiness(id: string): Promise<Business | null> {
  return fetchWithOriginFallback(`/api/directory/businesses/${id}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const business = await fetchBusiness(id);
  if (!business) return {};
  const description = business.description?.slice(0, 160).replace(/\n/g, ' ') ?? `Business listing for ${business.businessName}`;
  const image = business.logoUrl ?? '/opengraph-image';
  return {
    title: business.businessName,
    description,
    openGraph: {
      title: business.businessName,
      description,
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: business.businessName,
      description,
      images: [image]
    },
    alternates: {
      canonical: `/directory/${business.id}`
    }
  };
}

export default async function DirectoryDetailPage({ params }: Props) {
  const { id } = await params;
  const business = await fetchBusiness(id);

  if (!business) {
    return <DirectoryDetailContent id={id} />;
  }

  const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
  const localBusinessSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.businessName,
    description: business.description ?? `Business listing for ${business.businessName}`,
    image: business.logoUrl ?? `${baseUrl}/opengraph-image`,
    url: `${baseUrl}/directory/${business.id}`,
    address: business.address
      ? { '@type': 'PostalAddress', streetAddress: business.address }
      : undefined,
    telephone: business.phone,
    email: business.email,
    sameAs: business.websiteUrl ? [business.websiteUrl] : undefined
  };

  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <DirectoryDetailContent id={id} business={business} />
    </>
  );
}
