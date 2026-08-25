'use client';

import { useMemo } from 'react';
import type { AdminGallery } from '../../types';

export function GalleryPreview({ gallery }: { gallery: AdminGallery }) {
  const photos = useMemo(
    () => gallery.photos.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [gallery.photos]
  );

  const rows = useMemo(() => {
    const result: (typeof photos)[] = [[], [], []];
    photos.forEach((photo, idx) => result[idx % 3]!.push(photo));
    return result;
  }, [photos]);

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
            {new Date(gallery.eventDate).toLocaleDateString('en-GB')}
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
                className="flex gap-3"
                style={{
                  animation: `${animationName} 40s linear infinite`,
                  minWidth: '200%'
                }}
              >
                {doubled.map((photo, idx) => (
                  <div
                    key={`${photo.id}-${idx}`}
                    className="relative h-40 w-64 flex-shrink-0 overflow-hidden rounded-lg"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || ''}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

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
