'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Calendar } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { EventsList } from './EventsList';
import { EventCategory, eventCategoryLabels } from '@kentslsc/shared';

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDatetime: string;
  endDatetime: string;
  ticketPrice: number;
  isFree: boolean;
  maxTickets: number | null;
  category: EventCategory;
  imageUrl: string | null;
  posterImageUrl: string | null;
  posterImages: unknown;
  ticketDesign: unknown;
  isPublished: boolean;
  _count?: { tickets: number };
  soldCount?: number;
  remainingCount?: number | null;
}

export default function AdminEventsPage() {
  const { data, isLoading, error } = useQuery<{ data: AdminEvent[] }>({
    queryKey: ['admin', 'events'],
    queryFn: async () => {
      const res = await api.get('/events/admin');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Events"
      description="Create and manage events, posters, ticket designs and scanners."
      action={
        <Link
          href="/admin/events/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New event
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
        </div>
      ) : error ? (
        <div className="glass-card flex h-64 flex-col items-center justify-center gap-3 p-6 text-center text-red-400">
          <p>Failed to load events.</p>
          <p className="text-sm text-slate-500">{(error as Error).message}</p>
        </div>
      ) : data?.data?.length ? (
        <EventsList events={data.data} />
      ) : (
        <div className="glass-card flex h-64 flex-col items-center justify-center gap-4 p-6 text-center">
          <Calendar className="h-10 w-10 text-slate-500" />
          <div>
            <p className="font-medium">No events yet</p>
            <p className="text-sm text-slate-500">Create your first event to start selling tickets.</p>
          </div>
          <Link href="/admin/events/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create event
          </Link>
        </div>
      )}
    </AdminListLayout>
  );
}
