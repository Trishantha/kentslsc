'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { FUNDRAISER_STATUS_COLORS, type AdminFundraiser } from '../../types';

interface FundraiserModerationProps {
  fundraiser: AdminFundraiser;
  fundraiserId: string;
}

export function FundraiserModeration({ fundraiser, fundraiserId }: FundraiserModerationProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState(fundraiser.rejectionReason ?? '');

  const { data: current } = useQuery<AdminFundraiser>({
    queryKey: ['admin', 'fundraiser', fundraiserId],
    queryFn: async () => {
      const res = await api.get(`/fundraisers/${fundraiserId}`);
      return res.data;
    },
    initialData: fundraiser
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/fundraisers/${fundraiserId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraiser', fundraiserId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      router.refresh();
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (rejectionReason?: string) => {
      const res = await api.post(`/admin/fundraisers/${fundraiserId}/reject`, {
        reason: rejectionReason || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraiser', fundraiserId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      router.refresh();
    }
  });

  const status = current?.status ?? fundraiser.status;
  const rejectionReason = current?.rejectionReason ?? fundraiser.rejectionReason;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="glass-card p-6">
        <h2 className="mb-4 text-lg font-bold">Campaign status</h2>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${FUNDRAISER_STATUS_COLORS[status] ?? FUNDRAISER_STATUS_COLORS.COMPLETED}`}>
            {status.replace('_', ' ')}
          </span>
          {status === 'PENDING_APPROVAL' && (
            <span className="text-sm text-slate-500">This campaign is awaiting approval before it goes live.</span>
          )}
        </div>
        {rejectionReason && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-400">Rejection reason</p>
            <p className="mt-1 text-sm text-slate-300">{rejectionReason}</p>
          </div>
        )}
      </div>

      {status === 'PENDING_APPROVAL' && (
        <div className="glass-card p-6">
          <h2 className="mb-4 text-lg font-bold">Approve campaign</h2>
          <p className="mb-4 text-sm text-slate-500">
            Approve this campaign to make it visible and allow donations.
          </p>
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="btn-primary inline-flex items-center gap-2"
          >
            {approveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve campaign
          </button>
        </div>
      )}

      {status !== 'REJECTED' && (
        <div className="glass-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-red-400">
            <ShieldAlert className="h-5 w-5" />
            Reject campaign
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Rejecting a campaign prevents it from going live. Provide an optional reason for the organiser.
          </p>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Reason (optional)
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            placeholder="Explain why this campaign is being rejected..."
          />
          <div className="mt-4">
            <button
              onClick={() => rejectMutation.mutate(reason || undefined)}
              disabled={rejectMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
