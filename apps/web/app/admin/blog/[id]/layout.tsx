'use client';

import Link from 'next/link';
import { ArrowLeft, Newspaper, Calendar, Images, FileText, Search, Eye } from 'lucide-react';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { BlogPostProvider, useBlogPost } from './BlogPostProvider';

interface BlogDetailLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { href: 'content', label: 'Content', icon: FileText },
  { href: 'seo', label: 'SEO', icon: Search },
  { href: 'gallery', label: 'Gallery', icon: Images },
  { href: 'preview', label: 'Preview', icon: Eye }
];

function BlogDetailShell({ children }: { children: React.ReactNode }) {
  const post = useBlogPost();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/blog"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{post.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Newspaper className="h-3.5 w-3.5" />
              <span>{post.author?.name ?? 'Unknown author'}</span>
              <span>·</span>
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleString('en-GB')
                  : 'Unpublished'}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  post.isPublished
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {post.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/blog/${post.id}`} />
      </div>

      {children}
    </div>
  );
}

export default function BlogDetailLayout({ children }: BlogDetailLayoutProps) {
  return (
    <BlogPostProvider>
      <BlogDetailShell>{children}</BlogDetailShell>
    </BlogPostProvider>
  );
}
