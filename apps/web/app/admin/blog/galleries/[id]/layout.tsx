import Link from 'next/link';
import { ArrowLeft, Images, Calendar, FileText, Eye } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminGallery } from '../types';

interface GalleryDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getGallery(id: string): Promise<AdminGallery | null> {
  return fetchWithOriginFallback(`/api/galleries/admin/${id}`);
}

const tabs = [
  { href: 'content', label: 'Content', icon: FileText },
  { href: 'photos', label: 'Photos', icon: Images },
  { href: 'preview', label: 'Preview', icon: Eye }
];

export default async function GalleryDetailLayout({ children, params }: GalleryDetailLayoutProps) {
  const { id } = await params;
  const gallery = await getGallery(id);
  if (!gallery) notFound();

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
                  <span>{new Date(gallery.eventDate).toLocaleDateString('en-GB')}</span>
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
