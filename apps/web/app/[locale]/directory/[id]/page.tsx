import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import DirectoryDetailContent, { type Business } from './DirectoryDetailContent';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { getFrontendUrl } from '@/lib/env';
import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';

const DIRECTORY_DETAIL_MESSAGE_NAMESPACES = ['directoryDetail', 'directory', 'common'];

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
  const wrap = (children: React.ReactNode) => (
    <ServerMessagesProvider namespaces={DIRECTORY_DETAIL_MESSAGE_NAMESPACES}>
      {children}
    </ServerMessagesProvider>
  );

  if (!business) {
    return wrap(<DirectoryDetailContent id={id} />);
  }

  const baseUrl = getFrontendUrl();
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
    sameAs: [
      business.websiteUrl,
      business.facebook,
      business.instagram,
      business.twitter,
      business.youtube,
      business.linkedin,
      business.tiktok
    ].filter((url): url is string => typeof url === 'string' && url.length > 0)
  };

  return wrap(
    <>
      <JsonLd data={localBusinessSchema} />
      <DirectoryDetailContent id={id} business={business} />
    </>
  );
}
