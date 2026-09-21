'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Calendar,
  MapPin,
  TicketCheck,
  TicketX,
  Mail,
  Loader2,
  CheckCircle,
  QrCode,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate, cn } from '@/lib/utils';
import { api, getApiErrorMessage } from '@/lib/api';

export interface TicketListItemProps {
  ticket: {
    id: string;
    qrCodeValue: string;
    status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';
    purchaseDatetime: string;
    ticketNumber?: string | null;
    serialNumber?: number | null;
    event: {
      id: string;
      title: string;
      startDatetime: string;
      endDatetime: string;
      location?: string | null;
      imageUrl?: string | null;
      ticketDesign?: Record<string, unknown> | null;
    };
  };
}

function parseTicketDesign(raw: unknown): {
  primaryColor?: string;
  sponsorText?: string;
} {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { primaryColor?: string; sponsorText?: string };
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as { primaryColor?: string; sponsorText?: string };
  }
  return {};
}

export function TicketListItem({ ticket }: TicketListItemProps) {
  const isValid = ticket.status === 'VALID';
  const design = parseTicketDesign(ticket.event.ticketDesign);
  const primaryColor = design.primaryColor ?? '#0ea5e9';
  const [showQr, setShowQr] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  const resend = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ sent: boolean }>(`/tickets/${ticket.id}/resend`);
      return data;
    },
    onSuccess: () => {
      setEmailStatus('sent');
      setEmailError(null);
    },
    onError: (err: unknown) => {
      setEmailStatus('error');
      setEmailError(getApiErrorMessage(err));
    }
  });

  return (
    <>
      <div className="glass-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {isValid ? (
              <TicketCheck className="h-6 w-6" />
            ) : (
              <TicketX className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">{ticket.event.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(ticket.event.startDatetime)}
              </span>
              {ticket.event.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {ticket.event.location}
                </span>
              )}
              {ticket.ticketNumber && (
                <span className="font-mono text-xs">
                  {ticket.ticketNumber}
                  {ticket.serialNumber !== undefined && ticket.serialNumber !== null && (
                    <span className="ml-1 text-slate-400">· #{ticket.serialNumber}</span>
                  )}
                </span>
              )}
              {design.sponsorText && (
                <span className="text-xs italic">{design.sponsorText}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase',
              isValid
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            )}
          >
            {isValid ? <TicketCheck className="h-3.5 w-3.5" /> : <TicketX className="h-3.5 w-3.5" />}
            {ticket.status}
          </span>

          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
          >
            <QrCode className="h-4 w-4" /> QR
          </button>

          <button
            type="button"
            onClick={() => {
              if (emailStatus === 'sending') return;
              setEmailStatus('sending');
              resend.mutate();
            }}
            disabled={emailStatus === 'sending' || !isValid}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-2 text-sm font-medium text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
          >
            {emailStatus === 'sending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : emailStatus === 'sent' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {emailStatus === 'sent' ? 'Emailed' : 'Email'}
          </button>
        </div>

        {emailStatus === 'error' && emailError && (
          <p className="w-full text-xs text-rose-500 sm:text-right">{emailError}</p>
        )}
      </div>

      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
        >
          <div
            className="glass-card relative max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold">{ticket.event.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{formatDate(ticket.event.startDatetime)}</p>
            <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={ticket.qrCodeValue} size={200} level="H" />
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Show this QR code at the entrance. Each code can only be used once.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
