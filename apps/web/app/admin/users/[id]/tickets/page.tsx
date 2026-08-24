'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Loader2,
  Ticket,
  Eye,
  X,
  Calendar,
  MapPin,
  TicketCheck,
  TicketX
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { UserDetail } from '../../types';

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

export default function UserTicketsPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedTicket, setSelectedTicket] = useState<UserDetail['tickets'][number] | null>(null);

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const closeModal = () => setSelectedTicket(null);

  return (
    <div className="max-w-3xl">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Ticket className="h-5 w-5 text-neon-blue" /> Tickets
        </h3>
        {(detail.tickets ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No tickets found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.tickets ?? []).map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold">{t.event.title}</div>
                  <p className="mt-1 text-slate-500">
                    {formatDate(t.event.startDatetime)} · Status: {t.status}
                  </p>
                  {t.stripeSessionId && (
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      Session: {t.stripeSessionId}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(t)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-neon-blue/10 px-3 py-2 text-sm font-medium text-neon-blue hover:bg-neon-blue/20"
                >
                  <Eye className="h-4 w-4" /> View ticket
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <TicketViewCard ticket={selectedTicket} />
          </div>
        </div>
      )}
    </div>
  );
}

function TicketViewCard({ ticket }: { ticket: UserDetail['tickets'][number] }) {
  const isValid = ticket.status === 'VALID';
  const design = parseTicketDesign(ticket.event.ticketDesign);
  const primaryColor = design.primaryColor ?? '#0ea5e9';
  const secondaryColor = design.secondaryColor ?? '#1e293b';
  const footerText = design.footerText ?? 'Kent Sri Lankan Social Club';

  return (
    <div className="overflow-hidden">
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
              isValid ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-100'
            )}
          >
            {isValid ? <TicketCheck className="h-3.5 w-3.5" /> : <TicketX className="h-3.5 w-3.5" />}
            {ticket.status}
          </div>
        </div>

        <h3 className="mt-4 text-lg font-bold leading-tight">{ticket.event.title}</h3>

        {design.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={design.logoUrl} alt="" className="mt-4 h-10 w-auto object-contain" />
        )}
      </div>

      <div className="space-y-3 bg-slate-900 p-5 text-sm text-slate-200">
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
          <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300">
            Ticket no. {ticket.ticketNumber}
            {ticket.serialNumber !== undefined && ticket.serialNumber !== null && (
              <span className="ml-1 text-slate-400">· #{ticket.serialNumber}</span>
            )}
          </div>
        )}
        <div className="text-xs text-slate-500">
          Purchased {new Date(ticket.purchaseDatetime).toLocaleString('en-GB')}
        </div>
        {design.sponsorText && <p className="text-xs italic text-slate-400">{design.sponsorText}</p>}
      </div>

      <div className="border-y-2 border-dashed border-slate-700 bg-slate-900 px-6 py-5">
        <div className="flex flex-col items-center">
          <div className="rounded-xl bg-white p-2 shadow-sm">
            <QRCodeSVG value={ticket.qrCodeValue} size={180} level="H" />
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Show this QR code at the entrance. Each code can only be used once.
          </p>
        </div>
      </div>

      <div
        className="px-5 py-3 text-center text-xs font-medium text-white"
        style={{ backgroundColor: secondaryColor }}
      >
        {footerText}
      </div>
    </div>
  );
}
