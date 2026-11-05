'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';

type ConfirmState = 'confirming' | 'confirmed' | 'error';

/**
 * Public landing page for buyers who completed checkout without an account.
 * The login-gated ticket dashboard is not an option for them, so it confirms
 * the payment (backstop for a delayed/missing provider webhook) and points
 * them at their inbox, where the tickets with QR codes were sent.
 */
export default function PurchaseConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const sessionId = searchParams.get('session_id');
  const provider = searchParams.get('provider');
  const confirmToken = searchParams.get('confirm_token');
  const [state, setState] = useState<ConfirmState>('confirming');

  useEffect(() => {
    if (!sessionId || !provider) {
      setState('error');
      return;
    }
    // Fire-and-forget: fulfilment is idempotent and the provider webhook is
    // the authoritative path, so a failure here only means "wait for the
    // email", never a lost purchase.
    api
      .post('/payments/confirm-session', { sessionId, provider, confirmToken })
      .then(() => setState('confirmed'))
      .catch(() => setState('confirmed'));
  }, [sessionId, provider, confirmToken]);

  if (state === 'error') {
    return (
      <div className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="glass-card p-6 text-center md:p-8">
            <h1 className="text-lg font-semibold">We could not verify your purchase</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              If you completed the payment, your tickets will still be emailed to you automatically. Otherwise, please try again.
            </p>
            <Link href={`/events/${eventId}`} className="btn-primary mt-6 inline-block">
              Back to event
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="glass-card p-6 text-center md:p-10">
          {state === 'confirming' ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Confirming your payment…</p>
          ) : (
            <>
              <h1 className="text-xl font-bold md:text-2xl">Thank you for your purchase!</h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Your ticket(s) have been sent to the email address you entered. Please check your inbox
                (and spam folder) and show the QR code(s) at the entrance.
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                If you create an account with the same email address later, your tickets will appear in your dashboard.
              </p>
            </>
          )}
          <Link href={`/events/${eventId}`} className="btn-primary mt-6 inline-block">
            Back to event
          </Link>
        </div>
      </div>
    </div>
  );
}
