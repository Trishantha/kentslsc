'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Briefcase, Eye } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import type { AdminJob } from './types';

export default function AdminJobsPage() {
  const { data: jobs, isLoading, error } = useQuery<AdminJob[]>({
    queryKey: ['admin', 'jobs'],
    queryFn: async () => {
      const res = await api.get('/admin/directory/jobs');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Jobs"
      description="Create and manage job adverts across business listings."
      action={
        <Link
          href="/admin/jobs/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New job
        </Link>
      }
    >
      <div className="glass-card p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-red-400">
            <p>Failed to load jobs. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Published</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs?.map((job, idx) => (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-neon-blue" />
                        <span className="font-medium">{job.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {job.businessListing?.businessName || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {job.location || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          job.isPublished
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {job.isPublished ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/jobs/${job.id}/details`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-1.5 text-neon-blue hover:bg-neon-blue/20"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!jobs?.length && (
              <div className="mt-8 text-center text-slate-500">No jobs yet.</div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
