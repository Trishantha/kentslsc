'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Loader2,
  Ticket,
  Eye,
  X,
  Calendar,
  MapPin,
  TicketCheck,
  TicketX,
  Plus,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import type { UserDetail } from '../../types';

interface TicketDesign {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  sponsorText?: string;
  footerText?: string;
}

interface EventOption {
  id: string;
  title: string;
  startDatetime: string;
  isFree: boolean;
  ticketPrice: number;
}

interface AttachablePayment {
  id: string;
  receiptNumber: string | null;
  date: string;
  description: string | null;
  currency: string;
  grossAmount: number;
  paymentStatus: string;
  sourceType: string;
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
    <div className="max-w-3xl space-y-6">
      <ManualIssuePanel userId={id} userName={detail.name} />

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

function ManualIssuePanel({ userId, userName }: { userId: string; userName: string }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [eventId, setEventId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentId, setPaymentId] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: events, isLoading: eventsLoading } = useQuery<{ data: EventOption[] }>({
    queryKey: ['events', 'list', 'all-for-issue'],
    queryFn: async () => {
      const { data } = await api.get<{ data: EventOption[] }>(
        '/events?upcoming=false&limit=100'
      );
      return data;
    }
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<AttachablePayment[]>({
    queryKey: ['events', eventId, 'attachable-payments', userId],
    queryFn: async () => {
      const { data } = await api.get<AttachablePayment[]>(
        `/events/${eventId}/tickets/attachable-payments?userId=${userId}`
      );
      return data;
    },
    enabled: !!eventId
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/events/${eventId}/tickets/generate`, {
        quantity,
        userId,
        ...(paymentId ? { paymentId } : {}),
        notes
      });
      return data;
    },
    onSuccess: () => {
      setStatus({
        type: 'success',
        message: `${quantity} ticket(s) issued for ${userName}.`
      });
      setEventId('');
      setQuantity(1);
      setPaymentId('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
    onError: (err) => {
      setStatus({ type: 'error', message: getApiErrorMessage(err) });
    }
  });

  const selectedEvent = events?.data.find((e) => e.id === eventId);
  const canSubmit = !!eventId && quantity >= 1 && !issueMutation.isPending;

  return (
    <section className="glass-card p-5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between"
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-5 w-5 text-neon-blue" /> Manual issue ticket
        </h3>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-slate-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-500" />
        )}
      </button>
      <p className="mt-1 text-left text-sm text-slate-500">
        Issue tickets to this member when a system error prevented automatic issuance. Attach an
        existing payment from the revenue report when available.
      </p>

      {isOpen && (
        <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
          {status && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl border p-4 text-sm',
                status.type === 'success'
                  ? 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
              )}
            >
              {status.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {status.message}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Event</label>
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setPaymentId('');
                  setStatus(null);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              >
                <option value="">Select an event</option>
                {eventsLoading ? (
                  <option value="" disabled>
                    Loading events…
                  </option>
                ) : (
                  events?.data.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} · {formatDate(event.startDatetime)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Attach payment (optional)
              </label>
              <select
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                disabled={!eventId || paymentsLoading}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue disabled:opacity-50"
              >
                <option value="">
                  {paymentsLoading ? 'Loading payments…' : 'No payment / complimentary ticket'}
                </option>
                {payments?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.receiptNumber ?? 'No receipt'} ·{' '}
                    {p.description ?? p.sourceType.replace(/_/g, ' ')} ·{' '}
                    {formatCurrency(p.grossAmount)} · {p.paymentStatus}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Only completed, unattached payments for this member and event are shown.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Internal notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason for manual issue, e.g. Stripe webhook failure"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => issueMutation.mutate()}
              disabled={!canSubmit}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {issueMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Ticket className="h-4 w-4" />
              Issue {quantity} ticket{quantity === 1 ? '' : 's'}
            </button>
            {selectedEvent && !selectedEvent.isFree && (
              <span className="text-xs text-slate-500">
                Event price: {formatCurrency(selectedEvent.ticketPrice)}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
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
