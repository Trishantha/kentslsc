'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PolicyDocumentType, policyDocumentTypeLabels } from '@kentslsc/shared';
import { formatDate } from '@/lib/utils';

interface PolicyDoc {
  id: string;
  type: PolicyDocumentType;
  title: string;
  isPublished: boolean;
  updatedAt: string;
}

const ALL_TYPES = Object.values(PolicyDocumentType);

export default function AdminPolicyDocumentsPage() {
  const { data, isLoading } = useQuery<PolicyDoc[]>({
    queryKey: ['admin', 'policy-documents'],
    queryFn: async () => {
      const res = await api.get('/policy-documents/admin/all');
      return res.data;
    }
  });

  const docsMap = new Map((data ?? []).map((d) => [d.type, d]));

  return (
    <div>
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-neon-blue" />
        <h1 className="section-title">Policy Documents</h1>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Manage privacy policy, terms &amp; conditions, membership policy, GDPR statement, and other legal documents. Changes are reflected immediately on the public website.
      </p>

      <div className="mt-8 glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                <th className="px-6 py-3 font-medium">Document</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Last Updated</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ALL_TYPES.map((type) => {
                const doc = docsMap.get(type);
                return (
                  <tr key={type}>
                    <td className="px-6 py-4 font-medium">{policyDocumentTypeLabels[type]}</td>
                    <td className="px-6 py-4">
                      {doc?.isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-400">
                          <Eye className="h-3 w-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-1 text-xs text-slate-400">
                          <EyeOff className="h-3 w-3" /> {doc ? 'Draft' : 'Not created'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {doc ? formatDate(doc.updatedAt) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/policy-documents/${type}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {doc ? 'Edit' : 'Create'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
