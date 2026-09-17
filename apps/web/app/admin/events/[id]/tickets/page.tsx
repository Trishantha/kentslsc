'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Plus, QrCode, TicketCheck, TicketX, Search, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import type { AdminEvent } from '../../page';

interface TicketRow {
  id: string;
  qrCodeValue: string;
  serialNumber: number | null;
  ticketNumber: string | null;
  status: 'VALID' | 'USED' | 'CANCELLED';
  purchaseDatetime: string;
  user: { id: string; name: string; email: string };
}

export default function EventTicketsPage() {
  const params = useParams<{ id: string }>();
  const { id: eventId } = params;
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [prefix, setPrefix] = useState('');
  const [search, setSearch] = useState('');

  const { data: event } = useQuery<AdminEvent>({
    queryKey: ['admin', 'event', eventId],
    queryFn: async () => {
      const res = await api.get(`/events/admin/${eventId}`);
      return res.data;
    }
  });

  const { data: ticketsResponse, isLoading } = useQuery<{ tickets: TicketRow[]; totalGenerated: number }>({
    queryKey: ['admin', 'event', eventId, 'tickets'],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}/tickets`);
      return res.data;
    }
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/events/${eventId}/tickets/generate`, { quantity, prefix });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId, 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    }
  });

  const filteredTickets = ticketsResponse?.tickets.filter((t) => {
    const term = search.toLowerCase();
    return (
      t.ticketNumber?.toLowerCase().includes(term) ||
      t.user.name.toLowerCase().includes(term) ||
      t.user.email.toLowerCase().includes(term) ||
      t.qrCodeValue.toLowerCase().includes(term)
    );
  });

  const soldCount = ticketsResponse?.tickets.length ?? 0;
  const usedCount = ticketsResponse?.tickets.filter((t) => t.status === 'USED').length ?? 0;
  const remaining = event?.maxTickets != null ? event.maxTickets - soldCount : null;

  const exportCsv = () => {
    if (!ticketsResponse?.tickets.length) return;
    const rows = ticketsResponse.tickets.map((t) => ({
      ticketNumber: t.ticketNumber ?? '',
      serialNumber: t.serialNumber ?? '',
      status: t.status,
      attendee: t.user.name,
      email: t.user.email,
      qrCodeValue: t.qrCodeValue
    }));
    const headers = ['ticketNumber', 'serialNumber', 'status', 'attendee', 'email', 'qrCodeValue'].join(',');
    const csv = [headers, ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold">{soldCount}</p>
          <p className="text-xs text-slate-500">Total tickets</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold">{usedCount}</p>
          <p className="text-xs text-slate-500">Checked in</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold">{remaining !== null ? remaining : 'Unlimited'}</p>
          <p className="text-xs text-slate-500">Remaining</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold">Generate tickets</h2>
        <p className="text-sm text-slate-500">Create tickets in serial order for offline sales or complimentary entry.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Prefix (optional)</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. GALA"
              className="w-32 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
          </div>
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || (remaining !== null && remaining <= 0)}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate
          </button>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">Attendees & tickets</h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets..."
                className="rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm outline-none focus:border-neon-blue"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!ticketsResponse?.tickets.length}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : filteredTickets?.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-2 font-medium">Ticket #</th>
                  <th className="py-2 font-medium">Attendee</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Purchased</th>
                  <th className="py-2 font-medium text-right">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTickets.map((ticket) => (
                  <motion.tr
                    key={ticket.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td className="py-3 font-medium">{ticket.ticketNumber ?? '-'}</td>
                    <td className="py-3">
                      <p>{ticket.user.name}</p>
                      <p className="text-xs text-slate-500">{ticket.user.email}</p>
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                          ticket.status === 'VALID'
                            ? 'bg-green-500/10 text-green-400'
                            : ticket.status === 'USED'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        )}
                      >
                        {ticket.status === 'VALID' ? (
                          <TicketCheck className="h-3 w-3" />
                        ) : ticket.status === 'USED' ? (
                          <QrCode className="h-3 w-3" />
                        ) : (
                          <TicketX className="h-3 w-3" />
                        )}
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">
                      {formatDateTime(ticket.purchaseDatetime)}
                    </td>
                    <td className="py-3 text-right text-xs text-slate-500">
                      {ticket.qrCodeValue.slice(0, 12)}…
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-500">
            No tickets yet. Generate or sell tickets to see them here.
          </div>
        )}
      </div>
    </div>
  );
}
