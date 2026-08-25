export interface GalleryPhoto {
  id: string;
  url: string;
  path?: string | null;
  caption?: string | null;
  sortOrder: number;
}

export interface AdminGallery {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventDate: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  photos: GalleryPhoto[];
}
