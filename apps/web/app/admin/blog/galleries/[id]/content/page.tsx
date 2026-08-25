import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { GalleryContentForm } from './GalleryContentForm';
import type { AdminGallery } from '../../types';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getGallery(id: string): Promise<AdminGallery | null> {
  return fetchWithOriginFallback(`/api/galleries/admin/${id}`);
}

export default async function GalleryContentPage({ params }: PageProps) {
  const { id } = await params;
  const gallery = await getGallery(id);
  if (!gallery) notFound();

  return (
    <div className="mt-6 max-w-2xl">
      <GalleryContentForm gallery={gallery} galleryId={id} />
    </div>
  );
}
