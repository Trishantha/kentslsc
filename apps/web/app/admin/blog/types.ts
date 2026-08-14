export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  aiTldr: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
  };
}
