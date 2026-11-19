'use client';

import { useEffect, useState } from 'react';

/**
 * Extract a dominant brand color from an image by drawing it onto a small
 * canvas and averaging the opaque, non-white, non-black pixels. Returns a
 * hex color or null when the color cannot be read (e.g. the image is
 * cross-origin without CORS headers and taints the canvas).
 */
function extractDominantColor(image: HTMLImageElement): string | null {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 125) continue;
    const rr = data[i] ?? 0;
    const gg = data[i + 1] ?? 0;
    const bb = data[i + 2] ?? 0;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    // Skip near-white and near-black pixels so the result is the brand
    // color rather than the logo's background plate.
    if (min > 245 || max < 15) continue;
    r += rr;
    g += gg;
    b += bb;
    count++;
  }
  if (!count) return null;

  const toHex = (v: number) => Math.round(v / count).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface LogoTileProps {
  src: string;
  alt: string;
  /** Sizing/geometry classes, e.g. 'h-40 w-40 rounded-2xl'. */
  className?: string;
  imgClassName?: string;
}

/**
 * Logo container with a content-aware ambient background: the dominant
 * color of the logo is sampled client-side and rendered as a soft gradient
 * behind the image. Falls back to the classic white tile when the color
 * cannot be extracted.
 */
export function LogoTile({
  src,
  alt,
  className = 'h-40 w-40 rounded-2xl',
  imgClassName = 'h-full w-full object-contain'
}: LogoTileProps) {
  const [accent, setAccent] = useState<string | null>(null);

  useEffect(() => {
    setAccent(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setAccent(extractDominantColor(img));
    img.src = src;
  }, [src]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center p-2 shadow-sm transition-colors duration-500 ${className} ${
        accent
          ? 'border-transparent'
          : 'border-slate-200 bg-white dark:border-white/10'
      }`}
      style={
        accent
          ? { background: `linear-gradient(135deg, ${accent}4d 0%, ${accent}21 100%)` }
          : undefined
      }
    >
      <img src={src} alt={alt} className={imgClassName} />
    </div>
  );
}
