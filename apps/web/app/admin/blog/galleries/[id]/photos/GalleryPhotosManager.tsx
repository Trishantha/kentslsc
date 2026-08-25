'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Trash2, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { usePhotoLightbox } from '@/components/ui/PhotoLightbox';
import type { AdminGallery, GalleryPhoto } from '../../types';

interface Props {
  gallery: AdminGallery;
  galleryId: string;
}

export function GalleryPhotosManager({ gallery, galleryId }: Props) {
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<GalleryPhoto[]>(
    gallery.photos?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? []
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (values: GalleryPhoto[]) => {
      const res = await api.put(`/galleries/admin/${galleryId}`, {
        photos: values.map((p) => ({
          url: p.url,
          path: p.path,
          caption: p.caption
        }))
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'galleries', galleryId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'galleries'] });
      setSaveError(null);
    },
    onError: () => {
      setSaveError('Failed to save gallery changes. Please try again.');
    }
  });

  const addPhoto = (url: string, path?: string) => {
    setPhotos((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        url,
        path: path ?? null,
        caption: null,
        sortOrder: prev.length
      }
    ]);
  };

  const updateCaption = (index: number, caption: string) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, caption: caption || null };
      return next;
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((p, i) => ({ ...p, sortOrder: i }));
    });
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index]!;
      next[index] = next[target]!;
      next[target] = temp;
      return next.map((p, i) => ({ ...p, sortOrder: i }));
    });
  };

  const hasChanges =
    JSON.stringify(
      photos.map((p) => ({ url: p.url, caption: p.caption }))
    ) !==
    JSON.stringify(
      (gallery.photos ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({ url: p.url, caption: p.caption }))
    );

  const { open, Lightbox } = usePhotoLightbox(photos);

  return (
    <div className="glass-card space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Event photos</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add, reorder, caption, or remove photos. The public gallery scrolls automatically across three rows.
        </p>
      </div>

      <ImageUpload
        label="Add photo"
        value=""
        onChange={(url, path) => {
          if (url) addPhoto(url, path);
        }}
        hideUrlInput
        showPreview={false}
      />

      {photos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              <div className="relative aspect-[4/3]">
                <button
                  type="button"
                  onClick={() => open(index)}
                  className="h-full w-full cursor-pointer"
                  aria-label={`View ${photo.caption || 'photo'}`}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || ''}
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => open(index)}
                      className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                      aria-label="View larger"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(index, -1)}
                      disabled={index === 0}
                      className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
                      aria-label="Move earlier"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(index, 1)}
                      disabled={index === photos.length - 1}
                      className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
                      aria-label="Move later"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="rounded-full bg-red-500/20 p-2 text-red-200 hover:bg-red-500/30"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs font-semibold text-white">
                  {index + 1}
                </div>
              </div>
              <div className="p-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Caption</label>
                <input
                  type="text"
                  value={photo.caption ?? ''}
                  onChange={(e) => updateCaption(index, e.target.value)}
                  placeholder="Optional caption"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-neon-blue"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">No gallery photos yet.</p>
      )}

      {saveError && <p className="text-sm text-red-400">{saveError}</p>}

      <button
        type="button"
        onClick={() => updateMutation.mutate(photos)}
        disabled={updateMutation.isPending || !hasChanges}
        className="btn-primary flex items-center gap-2"
      >
        {updateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save photos
      </button>

      <Lightbox />
    </div>
  );
}
