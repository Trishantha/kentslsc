import { z } from 'zod';

export const contactMessageSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(10)
});

export const updateContactStatusSchema = z.object({
  handledStatus: z.enum(['new', 'in_progress', 'resolved'])
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
