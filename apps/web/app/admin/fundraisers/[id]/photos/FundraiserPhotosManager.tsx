'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import type { AdminFundraiser, FundraiserPhoto } from '../../types';

interface Props {
  fundraiser: AdminFundraiser;
  fundraiserId: string;
}

export function FundraiserPhotosManager({ fundraiser, fundraiserId }: Props) {
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<FundraiserPhoto[]>(
    fundraiser.photos?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? []
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (values: FundraiserPhoto[]) => {
      const res = await api.put(`/admin/fundraisers/${fundraiserId}`, {
        photos: values.map((p) => ({ url: p.url, path: p.path }))
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers', fundraiserId] });
      setSaveError(null);
    },
    onError: () => {
      setSaveError('Failed to save gallery changes. Please try again.');
    }
  });

  const addPhoto = (url: string, path?: string) => {
    setPhotos((prev) => [...prev, { id: `temp-${Date.now()}`, url, path: path ?? null, sortOrder: prev.length }]);
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
    JSON.stringify(photos.map((p) => p.url)) !==
    JSON.stringify(
      (fundraiser.photos ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => p.url)
    );

  return (
    <div className="glass-card space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Campaign gallery</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add, reorder, or remove photos that appear on the public campaign page.
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-2">
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
        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save gallery
      </button>
    </div>
  );
}
