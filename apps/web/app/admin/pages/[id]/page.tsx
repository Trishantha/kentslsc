'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const PageEditor = dynamic(() => import('@/components/admin/PageEditor'), { ssr: false });

export default function EditPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pages', id],
    queryFn: async () => {
      const res = await api.get(`/pages/admin/${id}`);
      return res.data;
    },
    enabled: Boolean(id)
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-title">Edit page</h1>
      <div className="mt-6">
        <PageEditor initialData={data} />
      </div>
    </div>
  );
}
