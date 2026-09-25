import type { Metadata } from 'next';
import { Inter, Russo_One } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import JsonLd from '@/components/JsonLd';
import { getFrontendUrl } from '@/lib/env';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import type { SiteSettings } from '@kentslsc/shared';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const russoOne = Russo_One({ weight: '400', subsets: ['latin'], variable: '--font-futuristic' });

const DEFAULT_TITLE = 'Kent Sri Lankan Social Club';
const DEFAULT_DESCRIPTION = 'A futuristic community platform for the Kent Sri Lankan Social Club.';

async function fetchSiteSettings(): Promise<SiteSettings | null> {
  return fetchWithOriginFallback<SiteSettings>('/api/site-settings');
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getFrontendUrl();
  const settings = await fetchSiteSettings();

  const title = settings?.metaTitle?.trim() || DEFAULT_TITLE;
  const description = settings?.metaDescription?.trim() || DEFAULT_DESCRIPTION;
  const keywords = settings?.metaKeywords
    ?.split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: '%s | Kent Sri Lankan Social Club'
    },
    description,
    ...(keywords && keywords.length > 0 && { keywords }),
    icons: {
      icon: '/logo-v2.png',
      apple: '/logo-v2.png'
    },
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      siteName: 'Kent Sri Lankan Social Club',
      title,
      description,
      images: ['/opengraph-image']
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image']
    },
    alternates: {
      canonical: './'
    }
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const baseUrl = getFrontendUrl();

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kent Sri Lankan Social Club',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'A futuristic community platform for the Kent Sri Lankan Social Club.',
    sameAs: []
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd data={organizationSchema} />
      </head>
      <body className={`${inter.variable} ${russoOne.variable} font-sans`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
