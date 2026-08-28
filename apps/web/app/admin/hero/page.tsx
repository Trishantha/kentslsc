'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn, getVideoMimeType } from '@/lib/utils';
import VideoOverlay from '@/components/ui/VideoOverlay';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { MediaUpload } from '@/components/ui/MediaUpload';

interface HeroConfig {
  id: string;
  mediaType: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  overlayStyle: 'none' | 'dots' | 'noise' | 'scanlines' | 'vignette';
  overlayOpacity: number;
  videoOverlayOpacity: number;
  videoPlaybackRate: number;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs text-slate-500';

export default function AdminHeroPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<HeroConfig>({
    queryKey: ['hero-config'],
    queryFn: async () => {
      const { data } = await api.get('/hero-config');
      return data;
    }
  });

  const [mediaType, setMediaType] = useState<HeroConfig['mediaType']>('video');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [overlayStyle, setOverlayStyle] = useState<HeroConfig['overlayStyle']>('noise');
  const [overlayOpacity, setOverlayOpacity] = useState(75);
  const [videoOverlayOpacity, setVideoOverlayOpacity] = useState(75);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);

  useEffect(() => {
    if (data) {
      setMediaType(data.mediaType);
      setImageUrl(data.imageUrl ?? '');
      setVideoUrl(data.videoUrl ?? '');
      setOverlayStyle(data.overlayStyle);
      setOverlayOpacity(data.overlayOpacity);
      setVideoOverlayOpacity(data.videoOverlayOpacity ?? data.overlayOpacity);
      setVideoPlaybackRate(data.videoPlaybackRate ?? 1);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: Partial<HeroConfig>) => {
      const { data } = await api.put('/hero-config', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-config'] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const handleSave = () => {
    mutation.mutate({
      mediaType,
      imageUrl,
      videoUrl,
      overlayStyle,
      overlayOpacity,
      videoOverlayOpacity,
      videoPlaybackRate
    });
  };

  return (
    <div>
      <h1 className="section-title">Hero</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Change the landing-page background video or banner without editing the rest of the home page.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-card space-y-5 p-6">
          <div>
            <label className={labelClass}>Media type</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as HeroConfig['mediaType'])}
              className={inputClass}
            >
              <option value="video">Video</option>
              <option value="image">Image</option>
            </select>
          </div>

          {mediaType === 'image' && (
            <MediaUpload
              label="Image URL"
              value={imageUrl}
              onChange={setImageUrl}
              accept="image/*"
              placeholder="/uploads/banner.jpg"
            />
          )}

          {mediaType === 'video' && (
            <MediaUpload
              label="Video URL"
              value={videoUrl}
              onChange={setVideoUrl}
              accept="video/*"
              placeholder="/videos/kslsc-hero.webm"
            />
          )}

          <div>
            <label className={labelClass}>Overlay style</label>
            <select
              value={overlayStyle}
              onChange={(e) => setOverlayStyle(e.target.value as HeroConfig['overlayStyle'])}
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="dots">Dots</option>
              <option value="noise">Noise / grain</option>
              <option value="scanlines">Scanlines</option>
              <option value="vignette">Vignette</option>
            </select>
          </div>

          {overlayStyle !== 'none' && mediaType === 'image' && (
            <div>
              <label className={labelClass}>Image overlay opacity ({overlayOpacity}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className={cn(inputClass, 'py-1')}
              />
            </div>
          )}

          {overlayStyle !== 'none' && mediaType === 'video' && (
            <div>
              <label className={labelClass}>Video overlay opacity ({videoOverlayOpacity}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={videoOverlayOpacity}
                onChange={(e) => setVideoOverlayOpacity(Number(e.target.value))}
                className={cn(inputClass, 'py-1')}
              />
            </div>
          )}

          {mediaType === 'video' && (
            <div>
              <label className={labelClass}>Video playback speed ({videoPlaybackRate.toFixed(2)}×)</label>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={videoPlaybackRate}
                onChange={(e) => setVideoPlaybackRate(Number(e.target.value))}
                className={cn(inputClass, 'py-1')}
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending}
            className="btn-primary inline-flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" /> Save hero
          </button>

          {mutation.isError && (
            <p className="text-sm text-red-400">{getApiErrorMessage(mutation.error)}</p>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold">Preview</h3>
          <div className="relative mt-4 aspect-video overflow-hidden rounded-xl border border-white/10">
            {mediaType === 'video' && videoUrl ? (
              <VideoPlayer autoPlay muted loop playsInline playbackRate={videoPlaybackRate} className="h-full w-full object-cover">
                <source src={videoUrl} type={getVideoMimeType(videoUrl)} />
              </VideoPlayer>
            ) : mediaType === 'image' && imageUrl ? (
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No media selected
              </div>
            )}
            {mediaType === 'video' && overlayStyle !== 'none' && (
              <VideoOverlay style={overlayStyle} opacity={videoOverlayOpacity} />
            )}
            {mediaType === 'image' && overlayStyle !== 'none' && (
              <VideoOverlay style={overlayStyle} opacity={overlayOpacity} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
