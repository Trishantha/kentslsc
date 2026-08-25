import { z } from 'zod';

export const galleryPhotoSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  path: z.string().optional().nullable(),
  caption: z.string().optional().nullable()
});

export const gallerySchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  eventDate: z.coerce.date().optional().nullable(),
  isPublished: z.boolean().default(false),
  photos: z.array(galleryPhotoSchema).default([])
});

export type GalleryPhotoInput = z.infer<typeof galleryPhotoSchema>;
export type GalleryInput = z.infer<typeof gallerySchema>;
