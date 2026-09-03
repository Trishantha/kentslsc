'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { cn } from '@/lib/utils';
import type { AdminEvent } from '../../page';

interface TicketDesign {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  sponsorText?: string;
  footerText?: string;
  layout?: 'standard' | 'compact';
}

const defaultDesign: TicketDesign = {
  primaryColor: '#0ea5e9',
  secondaryColor: '#1e293b',
  layout: 'standard',
  footerText: 'Kent Sri Lankan Social Club'
};

export default function EventTicketDesignPage() {
  const params = useParams<{ id: string }>();
  const { id: eventId } = params;
  const queryClient = useQueryClient();

  const { data: event } = useQuery<AdminEvent>({
    queryKey: ['admin', 'event', eventId],
    queryFn: async () => {
      const res = await api.get(`/events/admin/${eventId}`);
      return res.data;
    }
  });

  const [design, setDesign] = useState<TicketDesign>({
    ...defaultDesign,
    ...(event?.ticketDesign as unknown as TicketDesign)
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/events/${eventId}/ticket-design`, { ticketDesign: design });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId] });
    }
  });

  const updateField = <K extends keyof TicketDesign>(key: K, value: TicketDesign[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold">Ticket design</h2>
        <p className="text-sm text-slate-500">Customise how generated and purchased tickets look.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Primary colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={design.primaryColor ?? '#0ea5e9'}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1"
              />
              <input
                type="text"
                value={design.primaryColor ?? ''}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Secondary colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={design.secondaryColor ?? '#1e293b'}
                onChange={(e) => updateField('secondaryColor', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1"
              />
              <input
                type="text"
                value={design.secondaryColor ?? ''}
                onChange={(e) => updateField('secondaryColor', e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Layout</label>
          <select
            value={design.layout ?? 'standard'}
            onChange={(e) => updateField('layout', e.target.value as TicketDesign['layout'])}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue sm:w-auto"
          >
            <option value="standard">Standard</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Logo</label>
          <ImageUpload
            label="Ticket logo"
            value={design.logoUrl ?? ''}
            onChange={(url) => updateField('logoUrl', url)}
            hideUrlInput
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Sponsor text (optional)</label>
          <input
            type="text"
            value={design.sponsorText ?? ''}
            onChange={(e) => updateField('sponsorText', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            placeholder="e.g. Sponsored by ABC Ltd"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Footer text</label>
          <input
            type="text"
            value={design.footerText ?? ''}
            onChange={(e) => updateField('footerText', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            placeholder="Footer text printed on every ticket"
          />
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold">Preview</h2>
        <div className="mt-4 flex justify-center">
          <div
            className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-slate-900"
            style={{ borderColor: design.primaryColor }}
          >
            <div
              className="p-5 text-white"
              style={{ backgroundColor: design.primaryColor }}
            >
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider">Admit One</span>
              </div>
              <p className="mt-4 text-lg font-bold leading-tight">{event?.title ?? 'Event title'}</p>
              {design.logoUrl && (
                <img
                  src={design.logoUrl}
                  alt="Ticket logo"
                  className="mt-4 h-10 w-auto object-contain"
                />
              )}
            </div>

            <div className="space-y-3 p-5 text-sm text-slate-700 dark:text-slate-200">
              <p className="text-slate-500">{event?.location || 'Location'}</p>
              {design.sponsorText && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400">{design.sponsorText}</p>
              )}
            </div>

            <div className="border-y-2 border-dashed border-slate-200 px-6 py-5 text-center dark:border-slate-700">
              <div className="inline-block rounded-xl bg-white p-2 shadow-sm dark:bg-white">
                <div className="h-[180px] w-[180px] bg-slate-100" />
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                QR code will appear here on the real ticket.
              </p>
            </div>

            <div
              className="px-5 py-3 text-center text-xs font-medium text-white"
              style={{ backgroundColor: design.secondaryColor }}
            >
              {design.footerText}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className={cn('btn-primary inline-flex items-center gap-2', updateMutation.isPending && 'opacity-70')}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save ticket design
        </button>
      </div>
    </div>
  );
}
