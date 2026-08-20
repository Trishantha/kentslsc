'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  MapPin,
  TicketCheck,
  TicketX,
  Mail,
  Loader2,
  CheckCircle,
  Ticket
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { api, getApiErrorMessage } from '@/lib/api';

export interface TicketCardProps {
  ticket: {
    id: string;
    qrCodeValue: string;
    status: 'VALID' | 'USED' | 'CANCELLED';
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

interface TicketDesign {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  sponsorText?: string;
  footerText?: string;
}

function parseTicketDesign(raw: unknown): TicketDesign {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as TicketDesign;
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as TicketDesign;
  }
  return {};
}

export function TicketCard({ ticket }: TicketCardProps) {
  const isValid = ticket.status === 'VALID';
  const design = parseTicketDesign(ticket.event.ticketDesign);
  const primaryColor = design.primaryColor ?? '#0ea5e9';
  const secondaryColor = design.secondaryColor ?? '#1e293b';
  const footerText = design.footerText ?? 'Kent Sri Lankan Social Club';

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
    <div className="glass-card overflow-hidden p-4">
      <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-slate-900">
        {/* Header */}
        <div
          className="relative p-5 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider">Admit One</span>
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                isValid
                  ? 'bg-white/20 text-white'
                  : 'bg-red-500/20 text-red-100'
              )}
            >
              {isValid ? (
                <TicketCheck className="h-3.5 w-3.5" />
              ) : (
                <TicketX className="h-3.5 w-3.5" />
              )}
              {ticket.status}
            </div>
          </div>

          <h3 className="mt-4 text-lg font-bold leading-tight">{ticket.event.title}</h3>

          {design.logoUrl && (
            <img
              src={design.logoUrl}
              alt=""
              className="mt-4 h-10 w-auto object-contain"
            />
          )}
        </div>

        {/* Event details */}
        <div className="space-y-3 p-5 text-sm text-slate-700 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            {formatDate(ticket.event.startDatetime)}
          </div>
          {ticket.event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {ticket.event.location}
            </div>
          )}
          {ticket.ticketNumber && (
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Ticket no. {ticket.ticketNumber}
              {ticket.serialNumber !== undefined && ticket.serialNumber !== null && (
                <span className="ml-1 text-slate-400">· #{ticket.serialNumber}</span>
              )}
            </div>
          )}
          {design.sponsorText && (
            <p className="text-xs italic text-slate-500 dark:text-slate-400">{design.sponsorText}</p>
          )}
        </div>

        {/* QR section */}
        <div className="border-y-2 border-dashed border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex flex-col items-center">
            <div className="rounded-xl bg-white p-2 shadow-sm dark:bg-white">
              <QRCodeSVG value={ticket.qrCodeValue} size={180} level="H" />
            </div>
            <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
              Show this QR code at the entrance. Each code can only be used once.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 text-center text-xs font-medium text-white"
          style={{ backgroundColor: secondaryColor }}
        >
          {footerText}
        </div>
      </div>

      {/* Actions */}
      <div className="mx-auto mt-4 w-full max-w-xs">
        <button
          type="button"
          onClick={() => {
            if (emailStatus === 'sending') return;
            setEmailStatus('sending');
            resend.mutate();
          }}
          disabled={emailStatus === 'sending' || !isValid}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neon-blue/10 px-3 py-2 text-sm font-medium text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
        >
          {emailStatus === 'sending' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : emailStatus === 'sent' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {emailStatus === 'sent' ? 'Ticket emailed' : 'Email this ticket'}
        </button>
        {emailStatus === 'error' && emailError && (
          <p className="mt-2 text-xs text-rose-500">{emailError}</p>
        )}
      </div>
    </div>
  );
}
