'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, TicketCheck, TicketX, Mail, Loader2, CheckCircle } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { api, getApiErrorMessage } from '@/lib/api';

export interface TicketCardProps {
  ticket: {
    id: string;
    qrCodeValue: string;
    status: 'VALID' | 'USED' | 'CANCELLED';
    purchaseDatetime: string;
    event: {
      id: string;
      title: string;
      startDatetime: string;
      endDatetime: string;
      location?: string;
    };
  };
}

export function TicketCard({ ticket }: TicketCardProps) {
  const isValid = ticket.status === 'VALID';
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
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-white/20 p-5">
        <div>
          <h3 className="text-lg font-bold">{ticket.event.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Purchased {formatDate(ticket.purchaseDatetime)}
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            isValid
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          {isValid ? <TicketCheck className="h-3.5 w-3.5" /> : <TicketX className="h-3.5 w-3.5" />}
          {ticket.status}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 p-6 md:flex-row md:items-start">
        <div className="rounded-xl bg-white p-3 dark:bg-white">
          <QRCodeSVG value={ticket.qrCodeValue} size={160} level="H" />
        </div>
        <div className="flex-1 space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neon-blue" />
            {formatDate(ticket.event.startDatetime)}
          </div>
          {ticket.event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-neon-gold" />
              {ticket.event.location}
            </div>
          )}
          <p className="pt-2 text-xs text-slate-500 dark:text-slate-500">
            Show this QR code at the entrance. Each code can only be used once.
          </p>
          <button
            type="button"
            onClick={() => {
              if (emailStatus === 'sending') return;
              setEmailStatus('sending');
              resend.mutate();
            }}
            disabled={emailStatus === 'sending' || !isValid}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neon-blue/10 px-3 py-2 text-sm font-medium text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
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
    </div>
  );
}
