import type { Metadata } from 'next';
import { Inter, Russo_One } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import JsonLd from '@/components/JsonLd';
import { DebugHydration } from '@/components/DebugHydration';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const russoOne = Russo_One({ weight: '400', subsets: ['latin'], variable: '--font-futuristic' });

const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Kent Sri Lankan Social Club',
    template: '%s | Kent Sri Lankan Social Club'
  },
  description: 'A futuristic community platform for the Kent Sri Lankan Social Club.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png'
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'Kent Sri Lankan Social Club',
    title: 'Kent Sri Lankan Social Club',
    description: 'A futuristic community platform for the Kent Sri Lankan Social Club.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kent Sri Lankan Social Club',
    description: 'A futuristic community platform for the Kent Sri Lankan Social Club.'
  },
  alternates: {
    canonical: './'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Kent Sri Lankan Social Club',
  url: baseUrl,
  logo: `${baseUrl}/logo.png`,
  description: 'A futuristic community platform for the Kent Sri Lankan Social Club.',
  sameAs: []
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd data={organizationSchema} />
      </head>
      <body className={`${inter.variable} ${russoOne.variable} font-sans`} suppressHydrationWarning>
        <Providers>
          {process.env.NODE_ENV === 'development' && <DebugHydration />}
          {children}
        </Providers>
      </body>
    </html>
  );
}
