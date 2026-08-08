'use client';

import type { CSSProperties } from 'react';

export type OverlayStyle = 'none' | 'dots' | 'noise' | 'scanlines' | 'vignette';

interface Props {
  style?: OverlayStyle;
  opacity?: number;
}

export default function VideoOverlay({ style = 'noise', opacity = 75 }: Props) {
  if (style === 'none') return null;

  const alpha = Math.max(0, Math.min(100, opacity)) / 100;
  const textureAlpha = Math.min(1, alpha * 0.55 + 0.15);
  const base = `rgba(0,0,0,${textureAlpha})`;

  const textureStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none'
  };

  switch (style) {
    case 'noise':
      // Grain overlay: tile the noise texture on top of the dark base.
      textureStyle.backgroundImage = 'url(/videos/noise.png)';
      textureStyle.opacity = textureAlpha;
      textureStyle.mixBlendMode = 'overlay';
      break;
    case 'dots':
      // Finer dot grid so the video stays visible but textured.
      textureStyle.backgroundImage = `radial-gradient(circle, ${base} 0.5px, transparent 0.6px)`;
      textureStyle.backgroundSize = '2px 2px';
      break;
    case 'scanlines':
      textureStyle.backgroundImage = `repeating-linear-gradient(to bottom, transparent, transparent 2px, ${base} 2px, ${base} 4px)`;
      break;
    case 'vignette':
      textureStyle.background = `radial-gradient(circle at center, transparent 30%, ${base} 90%)`;
      break;
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {/* Base darkening layer: always darkens the video/image by the configured amount. */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: alpha }}
      />
      {/* Texture layer on top of the darkening layer. */}
      <div style={textureStyle} />
    </div>
  );
}
