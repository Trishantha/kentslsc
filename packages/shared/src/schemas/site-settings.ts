import { z } from 'zod';

export const siteSettingsSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  whatsapp: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  facebook: z.string().url().optional().or(z.literal('')),
  instagram: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
  youtube: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  tiktok: z.string().url().optional().or(z.literal('')),
  showPageLoader: z.boolean().optional()
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

export const siteSeoSettingsSchema = z.object({
  metaTitle: z.string().max(70).optional().or(z.literal('')),
  metaDescription: z.string().max(160).optional().or(z.literal('')),
  metaKeywords: z.string().optional().or(z.literal(''))
});

export type SiteSeoSettingsInput = z.infer<typeof siteSeoSettingsSchema>;

/** Site settings as returned by the API (input fields plus resource metadata). */
export interface SiteSettings extends SiteSettingsInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
}
