'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Loader2, QrCode, TicketCheck, TicketX, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { AdminEvent } from '../../page';

interface TicketPreview {
  id: string;
  qrCodeValue: string;
  status: 'VALID' | 'USED' | 'CANCELLED';
  eventExpired: boolean;
  purchaseDatetime: string;
  event: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
    location?: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EventScannerPage({ params }: Props) {
  const { id: eventId } = use(params);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');

  const { data: event } = useQuery<AdminEvent>({
    queryKey: ['admin', 'event', eventId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}`);
      return res.data;
    }
  });

  const {
    data: preview,
    error: previewError,
    isPending: previewLoading,
    mutate: lookup,
    reset: resetPreview
  } = useMutation<TicketPreview, unknown, string>({
    mutationFn: async (qrCodeValue: string) => {
      const { data } = await api.get<TicketPreview>(`/tickets/validate/${encodeURIComponent(qrCodeValue)}`);
      return data;
    }
  });

  const checkIn = useMutation({
    mutationFn: async (qrCodeValue: string) => {
      const { data } = await api.post<TicketPreview>('/tickets/validate', { qrCodeValue });
      return data;
    }
  });

  useEffect(() => {
    if (mode !== 'camera') return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        aspectRatio: 1
      },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        scanner.pause();
        lookup(decodedText);
      },
      () => {
        // Failures (no QR in frame) are normal; ignore.
      }
    );

    return () => {
      scanner.clear().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [mode, lookup]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    lookup(manualCode.trim());
  };

  const handleCheckIn = () => {
    if (!preview) return;
    checkIn.mutate(preview.qrCodeValue);
  };

  const handleReset = () => {
    resetPreview();
    checkIn.reset();
    setManualCode('');
    scannerRef.current?.resume();
  };

  const isWrongEvent = preview && preview.event.id !== eventId;
  const isExpired = preview && (preview.eventExpired || new Date(preview.event.endDatetime) < new Date());
  const canCheckIn = preview && preview.event.id === eventId && preview.status === 'VALID' && !isExpired && !checkIn.isSuccess;

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold">Event ticket scanner</h2>
      <p className="text-sm text-slate-500">
        Only tickets for <strong>{event?.title}</strong> can be checked in here.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('camera');
            resetPreview();
            setManualCode('');
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium',
            mode === 'camera'
              ? 'bg-neon-blue text-white'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          )}
        >
          Camera
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('manual');
            resetPreview();
            scannerRef.current?.clear().catch(() => undefined);
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium',
            mode === 'manual'
              ? 'bg-neon-blue text-white'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          )}
        >
          Manual code
        </button>
      </div>

      <div className="mt-6">
        {mode === 'camera' && !preview && !previewLoading && (
          <div id="qr-reader" className="overflow-hidden rounded-2xl border border-white/10 bg-white/5" />
        )}

        {mode === 'manual' && !preview && !previewLoading && (
          <form onSubmit={handleManualSubmit} className="glass-card space-y-4 p-6">
            <label htmlFor="manual-code" className="block text-sm font-medium text-slate-300">
              Enter ticket QR code
            </label>
            <input
              id="manual-code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste the QR code value here"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-neon-blue"
            />
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Look up ticket
            </button>
          </form>
        )}

        {previewLoading && (
          <div className="glass-card flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
          </div>
        )}

        {!!previewError && !previewLoading && (
          <div className="glass-card space-y-4 p-6 text-center text-rose-500">
            <AlertCircle className="mx-auto h-10 w-10" />
            <p className="font-medium">Ticket not found</p>
            <p className="text-sm text-slate-400">{getApiErrorMessage(previewError)}</p>
            <button onClick={handleReset} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Scan again
            </button>
          </div>
        )}

        {preview && !previewLoading && (
          <div className="glass-card space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{preview.event.title}</h3>
                <p className="text-sm text-slate-400">{formatDate(preview.event.startDatetime)}</p>
                {preview.event.location && (
                  <p className="text-sm text-slate-500">{preview.event.location}</p>
                )}
              </div>
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                  preview.status === 'VALID' && !isExpired && !isWrongEvent
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : preview.status === 'USED'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                )}
              >
                {preview.status === 'VALID' ? (
                  <TicketCheck className="h-3.5 w-3.5" />
                ) : preview.status === 'CANCELLED' ? (
                  <TicketX className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {isExpired ? 'Expired' : isWrongEvent ? 'Wrong event' : preview.status}
              </div>
            </div>

            {isWrongEvent && (
              <div className="rounded-xl bg-red-500/10 p-4 text-center text-red-400">
                <AlertCircle className="mx-auto h-8 w-8" />
                <p className="mt-2 font-semibold">This ticket is for a different event</p>
                <p className="text-sm text-slate-400">Use the scanner for {preview.event.title} instead.</p>
                <button onClick={handleReset} className="btn-primary mt-4 inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Scan next ticket
                </button>
              </div>
            )}

            {!isWrongEvent && (
              <>
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attendee</p>
                  <p className="font-medium">{preview.user.name}</p>
                  <p className="text-sm text-slate-400">{preview.user.email}</p>
                </div>

                {checkIn.isSuccess ? (
                  <div className="rounded-xl bg-green-500/10 p-4 text-center text-green-600 dark:text-green-400">
                    <CheckCircle className="mx-auto h-8 w-8" />
                    <p className="mt-2 font-semibold">Checked in successfully</p>
                    <button onClick={handleReset} className="btn-primary mt-4 inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Scan next ticket
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={!canCheckIn || checkIn.isPending}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {checkIn.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TicketCheck className="mr-2 h-4 w-4" />
                    )}
                    {isExpired
                      ? 'Event ended'
                      : preview.status === 'VALID'
                      ? 'Confirm check-in'
                      : preview.status === 'USED'
                      ? 'Already used'
                      : 'Ticket cancelled'}
                  </button>
                )}

                {checkIn.error && (
                  <p className="text-center text-sm text-rose-500">{getApiErrorMessage(checkIn.error)}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
