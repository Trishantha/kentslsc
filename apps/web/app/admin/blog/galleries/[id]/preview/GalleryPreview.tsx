'use client';

import { useMemo } from 'react';
import { usePhotoLightbox } from '@/components/ui/PhotoLightbox';
import { formatDate } from '@/lib/utils';
import type { AdminGallery } from '../../types';

export function GalleryPreview({ gallery }: { gallery: AdminGallery }) {
  const photos = useMemo(
    () => gallery.photos.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [gallery.photos]
  );

  const rows = useMemo(() => {
    const result: (typeof photos)[] = [[], [], []];
    photos.forEach((photo, idx) => result[idx % 3]!.push(photo));
    return result.filter((row) => row.length > 0);
  }, [photos]);
  const { open, Lightbox } = usePhotoLightbox(photos);

  if (photos.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-slate-500">
        Add photos to see the preview.
      </div>
    );
  }

  return (
    <div className="glass-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">{gallery.title}</h2>
        {gallery.description && (
          <p className="mt-1 text-sm text-slate-400">{gallery.description}</p>
        )}
        {gallery.eventDate && (
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(gallery.eventDate)}
          </p>
        )}
      </div>

      <div className="space-y-3 overflow-hidden">
        {rows.map((row, rowIndex) => {
          const doubled = [...row, ...row];
          const animationName = rowIndex % 2 === 0 ? 'gallery-scroll-left' : 'gallery-scroll-right';
          return (
            <div key={rowIndex} className="relative flex overflow-hidden">
              <div
                className="flex gap-3 hover:[animation-play-state:paused]"
                style={{
                  animation: `${animationName} 40s linear infinite`,
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
                      className="relative h-40 w-64 flex-shrink-0 overflow-hidden rounded-lg text-left"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || ''}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
  );
}
