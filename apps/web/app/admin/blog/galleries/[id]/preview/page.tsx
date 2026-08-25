import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { GalleryPreview } from './GalleryPreview';
import type { AdminGallery } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getGallery(id: string): Promise<AdminGallery | null> {
  return fetchWithOriginFallback(`/api/galleries/admin/${id}`);
}

export default async function GalleryPreviewPage({ params }: Props) {
  const { id } = await params;
  const gallery = await getGallery(id);
  if (!gallery) notFound();

  return (
    <div className="mt-6">
      <GalleryPreview gallery={gallery} />
    </div>
  );
}
