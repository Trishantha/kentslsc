import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchApiWithOriginFallback } from '@/lib/server-fetch';
import JsonLd from '@/components/JsonLd';
import BlogPostContent, { type BlogPost } from './BlogPostContent';

import { summarizeRichText } from '@/lib/rich-text';

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchPost(slug: string): Promise<BlogPost | null> {
  const result = await fetchApiWithOriginFallback(`/api/blog/${slug}`, { next: { revalidate: 60 } });
  if (!result.ok || !result.response.ok) return null;
  return result.response.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return {};
  const fallback = summarizeRichText(post.content, 160);
  const description = (post.aiTldr ?? fallback) || undefined;
  const image = post.imageUrl ?? '/opengraph-image';
  return {
    title: post.title,
    description,
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

  const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.aiTldr ?? summarizeRichText(post.content, 160),
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
