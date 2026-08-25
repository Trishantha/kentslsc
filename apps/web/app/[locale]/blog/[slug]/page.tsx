import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import JsonLd from '@/components/JsonLd';
import BlogPostContent, { type BlogPost } from './BlogPostContent';
import { stripRichText, summarizeRichText } from '@/lib/rich-text';
import { getFrontendUrl } from '@/lib/env';

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchPost(slug: string): Promise<BlogPost | null> {
  return fetchWithOriginFallback<BlogPost>(`/api/blog/${slug}`, { next: { revalidate: 60 } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return {};
  const fallback = summarizeRichText(post.content, 160);
  const description = post.metaDescription || stripRichText(post.aiTldr) || fallback || undefined;
  const image = post.imageUrl ?? '/opengraph-image';
  const keywords = post.tags?.length ? post.tags : undefined;
  return {
    title: post.title,
    description,
    keywords,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.publishedAt ?? post.createdAt,
      authors: post.author?.name ? [post.author.name] : undefined,
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [image]
    },
    alternates: {
      canonical: `/blog/${post.slug}`
    }
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const baseUrl = getFrontendUrl();
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription ?? stripRichText(post.aiTldr) ?? summarizeRichText(post.content, 160),
    image: post.imageUrl ?? `${baseUrl}/opengraph-image`,
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt ?? post.createdAt,
    author: post.author?.name
      ? { '@type': 'Person', name: post.author.name }
      : { '@type': 'Organization', name: 'Kent Sri Lankan Social Club' },
    publisher: {
      '@type': 'Organization',
      name: 'Kent Sri Lankan Social Club',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${post.slug}`
    }
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <BlogPostContent post={post} />
    </>
  );
}
