import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startDatetime: z.coerce.date(),
  endDatetime: z.coerce.date(),
  ticketPrice: z.number().min(0).default(0),
  isFree: z.boolean().default(false),
  maxTickets: z.number().int().min(1).optional(),
  imageUrl: z.string().url().optional(),
  isPublished: z.boolean().default(false)
});

export const createEventSchema = eventSchema;
export const updateEventSchema = eventSchema.partial();

export const ticketPurchaseSchema = z.object({
  eventId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).default(1)
});

export const validateTicketSchema = z.object({
  qrCodeValue: z.string().min(1)
});

export type EventInput = z.infer<typeof eventSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type TicketPurchaseInput = z.infer<typeof ticketPurchaseSchema>;
export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;
