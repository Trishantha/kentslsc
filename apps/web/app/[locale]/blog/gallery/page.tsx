'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { ArrowLeft, Calendar, Images } from 'lucide-react';
import { usePhotoLightbox } from '@/components/ui/PhotoLightbox';

interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string | null;
  sortOrder: number;
}

interface Gallery {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  eventDate?: string | null;
  photos: GalleryPhoto[];
}

export default function BlogGalleryPage() {
  const t = useTranslations('blog');
  const tCommon = useTranslations('common');
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/galleries')
      .then((res) => {
        const galleries: Gallery[] = res.data ?? [];
        const latest = galleries[0] ?? null;
        if (latest) {
          return api.get(`/galleries/${latest.slug}`).then((detail) => detail.data);
        }
        return null;
      })
      .then((detail) => {
        setGallery(detail);
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const photos = useMemo(
    () => (gallery?.photos ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [gallery?.photos]
  );

  const rows = useMemo(() => {
    const result: (typeof photos)[] = [[], [], []];
    photos.forEach((photo, idx) => result[idx % 3]!.push(photo));
    return result.filter((row) => row.length > 0);
  }, [photos]);
  const { open, Lightbox } = usePhotoLightbox(photos);

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-neon-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <Images className="h-6 w-6 text-neon-purple" />
            <h1 className="section-title">
              {gallery?.title ?? t('galleryTitle')}
            </h1>
          </div>
          {gallery?.description && (
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">
              {gallery.description}
            </p>
          )}
          {gallery?.eventDate && (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4" />
              {new Date(gallery.eventDate).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>

        {loading && (
          <div className="mt-12 flex h-40 items-center justify-center text-slate-500">
            {tCommon('loading')}
          </div>
        )}

        {error && (
          <div className="mt-12 text-center text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && !gallery && (
          <div className="mt-12 text-center text-slate-500">
            {t('noGallery')}
          </div>
        )}

        {gallery && (
          <div className="mt-10 space-y-4 overflow-hidden">
            {rows.map((row, rowIndex) => {
              const doubled = [...row, ...row];
              const reverse = rowIndex % 2 === 1;
              return (
                <div key={rowIndex} className="relative flex overflow-hidden">
                  <div
                    className="flex gap-4 hover:[animation-play-state:paused]"
                    style={{
                      animation: `${reverse ? 'gallery-scroll-right' : 'gallery-scroll-left'} 50s linear infinite`,
                      minWidth: '200%'
                    }}
                  >
                    {doubled.map((photo, idx) => {
                      const originalIndex = (idx % row.length) * rows.length + rowIndex;
                      return (
                        <button
                          key={`${photo.id}-${idx}`}
                          type="button"
                          onClick={() => open(originalIndex)}
                          className="relative h-56 w-80 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800 text-left"
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption || ''}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {photo.caption && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                              <p className="text-xs text-white">{photo.caption}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Lightbox />

        <style jsx>{`
          @keyframes gallery-scroll-left {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          @keyframes gallery-scroll-right {
            from { transform: translateX(-50%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
