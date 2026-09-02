import { z } from 'zod';

export const blogPostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  imageUrl: z.string().url().optional().or(z.literal('')),
  metaDescription: z.string().max(160).optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  galleryId: z.string().uuid().optional().or(z.literal('')),
  publishedAt: z.coerce.date().optional(),
  isPublished: z.boolean().default(false)
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

export interface BlogListItem {
  type: 'blog';
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  metaDescription?: string | null;
  tags?: string[];
  aiTldr?: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface FacebookListItem {
  type: 'facebook';
  id: string;
  title?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  url: string;
  publishedAt: string | null;
}

export type MixedBlogListItem = BlogListItem | FacebookListItem;
