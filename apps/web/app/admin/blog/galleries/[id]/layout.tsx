'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Images, Calendar, FileText, Eye, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { formatDate } from '@/lib/utils';
import type { AdminGallery } from '../types';

interface GalleryDetailLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { href: 'content', label: 'Content', icon: FileText },
  { href: 'photos', label: 'Photos', icon: Images },
  { href: 'preview', label: 'Preview', icon: Eye }
];

export default function GalleryDetailLayout({ children }: GalleryDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: gallery,
    isLoading,
    error
  } = useQuery<AdminGallery>({
    queryKey: ['admin', 'galleries', id],
    queryFn: async () => {
      const res = await api.get(`/galleries/admin/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (error || !gallery) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load gallery</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Gallery not found.'}
        </p>
        <Link
          href="/admin/blog/galleries"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to galleries
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/blog/galleries"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{gallery.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Images className="h-3.5 w-3.5" />
              <span>/{gallery.slug}</span>
              {gallery.eventDate && (
                <>
                  <span>·</span>
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(gallery.eventDate)}</span>
                </>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  gallery.isPublished
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {gallery.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/blog/galleries/${id}`} />
      </div>

      {children}
    </div>
  );
}
