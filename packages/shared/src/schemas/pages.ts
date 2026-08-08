import { z } from 'zod';

export const heroBlockSchema = z.object({
  type: z.literal('hero'),
  id: z.string(),
  title: z.string().default(''),
  subtitle: z.string().default(''),
  buttonText: z.string().default(''),
  buttonUrl: z.string().default(''),
  mediaType: z.enum(['image', 'video']).default('image'),
  imageUrl: z.string().default(''),
  videoUrl: z.string().default(''),
  overlayStyle: z.enum(['none', 'dots', 'noise', 'scanlines', 'vignette']).default('noise'),
  overlayOpacity: z.number().min(0).max(100).default(75)
});

export const textBlockSchema = z.object({
  type: z.literal('text'),
  id: z.string(),
  title: z.string().default(''),
  content: z.string().default(''),
  align: z.enum(['left', 'center', 'right']).default('left')
});

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  id: z.string(),
  imageUrl: z.string().default(''),
  alt: z.string().default(''),
  caption: z.string().default('')
});

export const featureItemSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  icon: z.string().default('')
});

export const featuresBlockSchema = z.object({
  type: z.literal('features'),
  id: z.string(),
  title: z.string().default(''),
  features: z.array(featureItemSchema).default([])
});

export const eventsBlockSchema = z.object({
  type: z.literal('events'),
  id: z.string(),
  title: z.string().default(''),
  limit: z.number().default(3)
});

export const directoryBlockSchema = z.object({
  type: z.literal('directory'),
  id: z.string(),
  title: z.string().default(''),
  limit: z.number().default(3)
});

export const fundraisersBlockSchema = z.object({
  type: z.literal('fundraisers'),
  id: z.string(),
  title: z.string().default(''),
  limit: z.number().default(3)
});

export const blogBlockSchema = z.object({
  type: z.literal('blog'),
  id: z.string(),
  title: z.string().default(''),
  limit: z.number().default(3)
});

export const ctaBlockSchema = z.object({
  type: z.literal('cta'),
  id: z.string(),
  title: z.string().default(''),
  content: z.string().default(''),
  buttonText: z.string().default(''),
  buttonUrl: z.string().default('')
});

export const contactBlockSchema = z.object({
  type: z.literal('contact'),
  id: z.string(),
  title: z.string().default(''),
  content: z.string().default('')
});

export const pageBlockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  featuresBlockSchema,
  eventsBlockSchema,
  directoryBlockSchema,
  fundraisersBlockSchema,
  blogBlockSchema,
  ctaBlockSchema,
  contactBlockSchema
]);

export const pageBlocksSchema = z.array(pageBlockSchema).default([]);

export const sitePageSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  isHome: z.boolean().default(false),
  metaDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
  blocks: pageBlocksSchema,
  isPublished: z.boolean().default(false)
});

export const sitePageUpdateSchema = sitePageSchema.partial();

export type PageBlock = z.infer<typeof pageBlockSchema>;
export type HeroBlock = z.infer<typeof heroBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type FeaturesBlock = z.infer<typeof featuresBlockSchema>;
export type EventsBlock = z.infer<typeof eventsBlockSchema>;
export type DirectoryBlock = z.infer<typeof directoryBlockSchema>;
export type FundraisersBlock = z.infer<typeof fundraisersBlockSchema>;
export type BlogBlock = z.infer<typeof blogBlockSchema>;
export type CtaBlock = z.infer<typeof ctaBlockSchema>;
export type ContactBlock = z.infer<typeof contactBlockSchema>;

export type SitePageInput = z.infer<typeof sitePageSchema>;
export type SitePageUpdateInput = z.infer<typeof sitePageUpdateSchema>;
