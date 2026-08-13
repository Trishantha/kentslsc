import { z } from 'zod';

export const contactMessageSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(10),
  consent: z.boolean().refine((v) => v === true, {
    message: 'You must accept the privacy policy to send a message.'
  }),
  website: z.string().max(0, { message: 'Bot detected.' }).optional()
});

export const contactHoneypotSchema = z.object({
  website: z.string().max(0).optional()
});

export const updateContactStatusSchema = z.object({
  handledStatus: z.enum(['new', 'in_progress', 'resolved'])
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
