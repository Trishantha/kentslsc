'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, X, ImageIcon, Film } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export type MediaType = 'image' | 'video';

interface MediaUploadProps {
  value?: string | null;
  onChange: (url: string, path?: string) => void;
  accept?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  previewClassName?: string;
  showPreview?: boolean;
  hideUrlInput?: boolean;
}

function detectMediaType(accept: string): MediaType {
  if (accept.startsWith('video')) return 'video';
  return 'image';
}

export function MediaUpload({
  value,
  onChange,
  accept = 'image/*',
  label = 'Media',
  placeholder = 'https://...',
  className,
  previewClassName,
  showPreview = true,
  hideUrlInput = false
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaType = detectMediaType(accept);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/uploads', formData);
      onChange(data.url, data.path);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = () => onChange('');

  return (
    <div className={cn('space-y-2', className)}>
      <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
        {label}
      </label>

      <div className="flex gap-2">
        {!hideUrlInput && (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mediaType === 'video' ? (
            <Film className="h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {showPreview && value && (
        <div
          className={cn(
            'relative mt-2 inline-block overflow-hidden rounded-xl border border-white/10',
            previewClassName
          )}
        >
          {mediaType === 'video' ? (
            <video
              src={value}
              controls
              className="h-24 w-24 object-cover"
              onError={(e) => {
                (e.target as HTMLVideoElement).style.display = 'none';
              }}
            />
          ) : (
            <img
              src={value}
              alt="Preview"
              className="h-24 w-24 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ImageUpload(props: Omit<MediaUploadProps, 'accept'>) {
  return <MediaUpload {...props} accept="image/*" label={props.label ?? 'Image'} />;
}
