import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchWithRetry } from '@/lib/server-fetch';
import JsonLd from '@/components/JsonLd';
import DirectoryDetailContent, { type Business } from './DirectoryDetailContent';

interface Props {
  params: { id: string };
}

async function fetchBusiness(id: string): Promise<Business | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const res = await fetchWithRetry(`${apiUrl}/api/directory/businesses/${id}`, { next: { revalidate: 60 } });
  if (!res || !res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await fetchBusiness(params.id);
  if (!business) return {};
  const description = business.description?.slice(0, 160).replace(/\n/g, ' ') ?? `Business listing for ${business.businessName}`;
  const image = business.logoUrl ?? '/opengraph-image.png';
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
  const business = await fetchBusiness(params.id);
  if (!business) notFound();

  const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
  const localBusinessSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.businessName,
    description: business.description ?? `Business listing for ${business.businessName}`,
    image: business.logoUrl ?? `${baseUrl}/opengraph-image.png`,
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
      <DirectoryDetailContent business={business} />
    </>
  );
}
