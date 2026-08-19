'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, QrCode } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { formatDate, cn } from '@/lib/utils';
import { MembershipScanResult } from '@kentslsc/shared';

interface ScanItem {
  id: string;
  scannedValue: string;
  membershipId: string | null;
  result: MembershipScanResult;
  memberName: string | null;
  membershipType: string | null;
  scannedAt: string;
  scannedBy: { id: string; name: string; email: string };
}

interface ScanListResponse {
  items: ScanItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const resultBadge: Record<MembershipScanResult, string> = {
  [MembershipScanResult.VALID]: 'bg-green-500/10 text-green-400',
  [MembershipScanResult.EXPIRED]: 'bg-amber-500/10 text-amber-400',
  [MembershipScanResult.INACTIVE]: 'bg-rose-500/10 text-rose-400',
  [MembershipScanResult.CANCELLED]: 'bg-red-500/10 text-red-400',
  [MembershipScanResult.NOT_FOUND]: 'bg-slate-500/10 text-slate-400'
};

export default function MembershipScanHistory() {
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading, error } = useQuery<ScanListResponse>({
    queryKey: ['admin', 'membership-scans', page],
    queryFn: async () => {
      const { data } = await api.get(`/membership/scans?page=${page}&limit=${limit}`);
      return data;
    }
  });

  return (
    <AdminListLayout
      title="Membership scan history"
      description="Every membership QR code scanned by door staff."
    >
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Scanned by</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-neon-blue" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-red-400">
                    <p>Failed to load scan history.</p>
                    <p className="mt-1 text-sm text-slate-500">{getApiErrorMessage(error)}</p>
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((scan) => (
                  <tr key={scan.id} className="group">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {scan.memberName ?? <span className="text-slate-500">Unknown</span>}
                      </p>
                      {scan.membershipId && (
                        <p className="font-mono text-xs text-slate-500">{scan.membershipId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {scan.membershipType ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          resultBadge[scan.result]
                        )}
                      >
                        {scan.result}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{scan.scannedBy.name}</p>
                      <p className="text-xs text-slate-500">{scan.scannedBy.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(scan.scannedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <QrCode className="mx-auto h-10 w-10 text-slate-500" />
                    <p className="mt-4 font-medium">No scans yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Scans recorded from the membership scanner will appear here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {data.page} of {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
