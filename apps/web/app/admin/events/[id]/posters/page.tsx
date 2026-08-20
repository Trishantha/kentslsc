'use client';

import { useState, use, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, X, GripVertical, Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { cn } from '@/lib/utils';
import type { AdminEvent } from '../../page';

interface PosterImage {
  url: string;
  caption?: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function EventPostersPage({ params }: Props) {
  const { id: eventId } = use(params);
  const queryClient = useQueryClient();

  const { data: event } = useQuery<AdminEvent>({
    queryKey: ['admin', 'event', eventId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}`);
      return res.data;
    }
  });

  const [posterImageUrl, setPosterImageUrl] = useState(event?.posterImageUrl ?? '');
  const [posterImages, setPosterImages] = useState<PosterImage[]>(
    (event?.posterImages as unknown as PosterImage[]) ?? []
  );

  useEffect(() => {
    if (!event) return;
    setPosterImageUrl(event.posterImageUrl ?? '');
    setPosterImages((event.posterImages as unknown as PosterImage[]) ?? []);
  }, [event]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/events/${eventId}/posters`, {
        posterImageUrl: posterImageUrl || undefined,
        posterImages
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    }
  });

  const addPoster = () => {
    setPosterImages((prev) => [...prev, { url: '', caption: '' }]);
  };

  const updatePoster = (index: number, patch: Partial<PosterImage>) => {
    setPosterImages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  };

  const removePoster = (index: number) => {
    setPosterImages((prev) => prev.filter((_, i) => i !== index));
  };

  const movePoster = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= posterImages.length) return;
    setPosterImages((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex]!, next[index]!];
      return next;
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold">Primary poster</h2>
        <p className="text-sm text-slate-500">This image is used as the main event poster.</p>
        <div className="mt-4">
          <ImageUpload
            label="Poster image"
            value={posterImageUrl}
            onChange={(url) => setPosterImageUrl(url)}
            hideUrlInput
          />
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Additional posters</h2>
            <p className="text-sm text-slate-500">Upload supporting posters or flyers for this event.</p>
          </div>
          <button
            type="button"
            onClick={addPoster}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add poster
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {posterImages.map((poster, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => movePoster(idx, -1)}
                    disabled={idx === 0}
                    className="text-slate-500 hover:text-white disabled:opacity-30"
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePoster(idx, 1)}
                    disabled={idx === posterImages.length - 1}
                    className="text-slate-500 hover:text-white disabled:opacity-30"
                  >
                    <GripVertical className="h-4 w-4 -rotate-90" />
                  </button>
                </div>
                <div className="flex-1 space-y-3">
                  <ImageUpload
                    label={`Poster ${idx + 1}`}
                    value={poster.url}
                    onChange={(url) => updatePoster(idx, { url })}
                    hideUrlInput
                  />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Caption (optional)</label>
                    <input
                      type="text"
                      value={poster.caption ?? ''}
                      onChange={(e) => updatePoster(idx, { caption: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
                      placeholder="e.g. Early bird offer"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePoster(idx)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
          {!posterImages.length && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-500">
              No additional posters yet.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className={cn('btn-primary inline-flex items-center gap-2', updateMutation.isPending && 'opacity-70')}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save posters
        </button>
      </div>
    </div>
  );
}
