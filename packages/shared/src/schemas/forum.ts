import { z } from 'zod';

export const forumCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export const forumTopicSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1)
});

export const forumPostSchema = z.object({
  topicId: z.string().uuid(),
  content: z.string().min(1)
});

export type ForumCategoryInput = z.infer<typeof forumCategorySchema>;
export type ForumTopicInput = z.infer<typeof forumTopicSchema>;
export type ForumPostInput = z.infer<typeof forumPostSchema>;
