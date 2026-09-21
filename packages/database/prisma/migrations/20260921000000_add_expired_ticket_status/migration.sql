-- Add EXPIRED to the ticket status enum so tickets for events that have ended
-- can be marked expired (the daily TicketExpiryService job).
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
