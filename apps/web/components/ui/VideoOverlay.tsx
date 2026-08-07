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
  const base = `rgba(0,0,0,${alpha})`;

  const className =
    'pointer-events-none absolute inset-0 -z-10 bg-repeat';
  const styleProp: CSSProperties = {};

  switch (style) {
    case 'noise':
      styleProp.backgroundColor = base;
      styleProp.backgroundImage = 'url(/videos/noise.png)';
      styleProp.backgroundBlendMode = 'overlay';
      break;
    case 'dots':
      styleProp.backgroundImage = `radial-gradient(circle, ${base} 1px, transparent 1.5px)`;
      styleProp.backgroundSize = '4px 4px';
      break;
    case 'scanlines':
      styleProp.backgroundImage = `repeating-linear-gradient(to bottom, transparent, transparent 2px, ${base} 2px, ${base} 4px)`;
      break;
    case 'vignette':
      styleProp.background = `radial-gradient(circle at center, transparent 30%, ${base} 90%)`;
      break;
  }

  return <div aria-hidden="true" className={className} style={styleProp} />;
}
