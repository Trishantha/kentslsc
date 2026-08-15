'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { Cookie, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface GdprSettings {
  cookieConsentEnabled: boolean;
  cookieConsentMessage: string;
  cookiePolicyUrl?: string;
  privacyPolicyUrl?: string;
}

const CONSENT_STORAGE_KEY = 'kentslsc_cookie_consent';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  const { data: gdpr } = useQuery<GdprSettings>({
    queryKey: ['gdpr-settings'],
    queryFn: async () => {
      const { data } = await api.get('/gdpr-settings');
      return data;
    },
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible || gdpr?.cookieConsentEnabled === false) return null;

  const message =
    gdpr?.cookieConsentMessage ??
    'We use cookies to improve your experience on our website. By continuing to browse, you agree to our use of cookies.';

  const privacyUrl = gdpr?.privacyPolicyUrl || '/privacy-policy';
  const cookieUrl = gdpr?.cookiePolicyUrl || '/cookie-policy';

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-900/95 px-4 py-4 backdrop-blur-lg md:bottom-4 md:left-auto md:right-4 md:max-w-md md:rounded-2xl md:border md:border-white/10 md:shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 rounded-full bg-neon-blue/10 p-2">
          <Cookie className="h-4 w-4 text-neon-blue" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Cookie Notice</p>
          <p className="mt-1 text-xs text-slate-400">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={accept}
              className="rounded-lg bg-neon-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-neon-blue/90"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={decline}
              className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              Essential only
            </button>
            <Link href={privacyUrl} className="self-center text-xs text-neon-blue hover:underline">
              Privacy
            </Link>
            <Link href={cookieUrl} className="self-center text-xs text-neon-blue hover:underline">
              Cookies
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={decline}
          aria-label="Dismiss cookie banner"
          className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
