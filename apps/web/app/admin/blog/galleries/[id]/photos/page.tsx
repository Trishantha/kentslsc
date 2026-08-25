import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { GalleryPhotosManager } from './GalleryPhotosManager';
import type { AdminGallery } from '../../types';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getGallery(id: string): Promise<AdminGallery | null> {
  return fetchWithOriginFallback(`/api/galleries/admin/${id}`);
}

export default async function GalleryPhotosPage({ params }: PageProps) {
  const { id } = await params;
  const gallery = await getGallery(id);
  if (!gallery) notFound();

  return (
    <div className="mt-6">
      <GalleryPhotosManager gallery={gallery} galleryId={id} />
    </div>
  );
}
