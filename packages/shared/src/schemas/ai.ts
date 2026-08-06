import { z } from 'zod';

export const aiSummariseSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['event', 'fundraiser', 'blog', 'business']),
  maxLength: z.number().int().min(50).max(500).default(150)
});

export const aiRecommendSchema = z.object({
  type: z.enum(['events', 'fundraisers', 'topics', 'businesses']),
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export const aiModerateSchema = z.object({
  content: z.string().min(1)
});

export const aiSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10)
});

export type AiSummariseInput = z.infer<typeof aiSummariseSchema>;
export type AiRecommendInput = z.infer<typeof aiRecommendSchema>;
export type AiModerateInput = z.infer<typeof aiModerateSchema>;
export type AiSearchInput = z.infer<typeof aiSearchSchema>;
