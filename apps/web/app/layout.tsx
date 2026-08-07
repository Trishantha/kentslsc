import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import dynamic from 'next/dynamic';

const AiChatWidget = dynamic(
  () => import('@/components/ui/AiChatWidget').then((mod) => ({ default: mod.AiChatWidget })),
  { ssr: false }
);

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Kent Sri Lankan Social Club',
  description: 'A futuristic community platform for the Kent Sri Lankan Social Club.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                const extensionAttrs = [
                  '__processed_f0105fef-cfce-4318-bb2b-80a35087d7e0__',
                  'data-new-gr-c-s-check-loaded',
                  'data-gr-ext-installed'
                ];
                function clean() {
                  [document.documentElement, document.body].forEach((el) => {
                    if (!el) return;
                    extensionAttrs.forEach((attr) => el.removeAttribute(attr));
                  });
                  document.querySelectorAll('[fdprocessedid]').forEach((el) => {
                    el.removeAttribute('fdprocessedid');
                  });
                }
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', clean);
                } else {
                  clean();
                }
              })();
            `
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <AiChatWidget />
          </div>
        </Providers>
      </body>
    </html>
  );
}
