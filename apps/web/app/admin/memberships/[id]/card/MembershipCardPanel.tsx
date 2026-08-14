'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Download, QrCode } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminMembership } from '../../types';

interface MembershipCardPanelProps {
  membership: AdminMembership;
}

export function MembershipCardPanel({ membership }: MembershipCardPanelProps) {
  const queryClient = useQueryClient();
  const [cardUrl, setCardUrl] = useState<string | null>(membership.membershipCardUrl);
  const [error, setError] = useState<string | null>(null);

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/memberships/${membership.membershipId}/regenerate-card`);
      return res.data;
    },
    onSuccess: (data: { membershipCardUrl?: string | null }) => {
      if (data?.membershipCardUrl) {
        setCardUrl(data.membershipCardUrl);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const cardImageUrl = cardUrl?.startsWith('http') ? cardUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${cardUrl ?? ''}`;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="glass-card p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Membership card</h2>
          <button
            type="button"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate card
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {cardImageUrl ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cardImageUrl}
                alt={`Membership card for ${membership.user.name}`}
                className="mx-auto max-h-[420px] w-auto rounded-lg object-contain"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={cardImageUrl}
                download={`${membership.membershipId}.png`}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download card
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <QrCode className="h-10 w-10 text-slate-500" />
            <div>
              <p className="font-medium">No card generated yet</p>
              <p className="text-sm text-slate-500">
                Regenerate the card to create a membership card for this member.
              </p>
            </div>
            <button
              type="button"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Generate card
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
