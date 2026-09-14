'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxPhoto {
  id: string;
  url: string;
  caption?: string | null;
}

interface UsePhotoLightboxResult {
  open: (index: number) => void;
  close: () => void;
  isOpen: boolean;
  Lightbox: () => React.JSX.Element | null;
}

export function usePhotoLightbox(photos: LightboxPhoto[]): UsePhotoLightboxResult {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const open = (i: number) => {
    setIndex(i);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, photos.length]);

  const Lightbox = () => {
    if (!isOpen || !photos[index]) return null;
    const photo = photos[index];

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
        onClick={close}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.max(0, i - 1));
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.min(photos.length - 1, i + 1));
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div
          className="flex max-h-full max-w-full flex-col items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={photo.url}
            alt={photo.caption || ''}
            className="max-h-[80vh] max-w-full object-contain"
          />
          {photo.caption && (
            <p className="mt-3 max-w-2xl text-center text-sm text-white/90">{photo.caption}</p>
          )}
        </div>
      </div>,
      document.body
    );
  };

  return { open, close, isOpen, Lightbox };
}
