import type { AdminGallery } from './galleries/types';

export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl: string | null;
  metaDescription: string | null;
  tags: string[];
  galleryId: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  aiTldr: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
  };
  gallery: AdminGallery | null;
}

export type { AdminGallery };
