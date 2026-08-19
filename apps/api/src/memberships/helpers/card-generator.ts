import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import * as fontkit from 'fontkit';

const CARD_WIDTH = 1050;
const CARD_HEIGHT = 600;

type FontWeight = 400 | 700 | 900;

interface FontSet {
  400: fontkit.Font;
  700: fontkit.Font;
  900: fontkit.Font;
}

let fontCache: FontSet | null = null;

export type FontFileResolver = (file: string) => Promise<string> | string;

async function loadFonts(fontResolver?: FontFileResolver): Promise<FontSet> {
  if (fontCache) {
    return fontCache;
  }

  const weights: FontWeight[] = [400, 700, 900];
  const files: Record<FontWeight, string> = {
    400: 'inter-latin-400-normal.woff',
    700: 'inter-latin-700-normal.woff',
    900: 'inter-latin-900-normal.woff'
  };

  const resolveFont =
    fontResolver ??
    (async (file: string) => {
      const { resolveFontFile } = await import('./font-resolver.js');
      return resolveFontFile(file);
    });

  const fonts: Record<FontWeight, fontkit.Font> = {
    400: undefined,
    700: undefined,
    900: undefined
  } as unknown as Record<FontWeight, fontkit.Font>;
  await Promise.all(
    weights.map(async (weight) => {
      const fontPath = await resolveFont(files[weight]);
      const buffer = await readFile(fontPath);
      const font = fontkit.create(buffer) as fontkit.Font;
      fonts[weight] = font;
    })
  );

  fontCache = fonts;
  return fontCache;
}

function nearestWeight(weight: number): FontWeight {
  if (weight >= 800) return 900;
  if (weight >= 600) return 700;
  return 400;
}

interface TextPathOptions {
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
  fill: string;
  opacity?: number;
}

function textToPath(
  fonts: FontSet,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  options: TextPathOptions
): string {
  const weight = nearestWeight(options.weight ?? 400);
  const font = fonts[weight];
  const scale = fontSize / font.unitsPerEm;
  const extraAdvance = (options.letterSpacing ?? 0) / scale;

  const run = font.layout(text);
  const glyphs = run.glyphs;
  const positions = run.positions;

  let totalWidth = 0;
  for (let i = 0; i < glyphs.length; i++) {
    totalWidth += (positions[i]?.xAdvance ?? 0) + extraAdvance;
  }

  let cursorX = x;
  if (options.anchor === 'middle') {
    cursorX = x - totalWidth * scale / 2;
  } else if (options.anchor === 'end') {
    cursorX = x - totalWidth * scale;
  }

  const paths: string[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    if (!glyph) continue;
    const position = positions[i];
    const glyphX = cursorX + (position?.xOffset ?? 0) * scale;
    const glyphY = y + (position?.yOffset ?? 0) * scale;
    const pathData = glyph.path.toSVG();
    if (pathData) {
      paths.push(`<path transform="translate(${glyphX.toFixed(2)}, ${glyphY.toFixed(2)}) scale(${scale.toFixed(6)}, -${scale.toFixed(6)})" d="${pathData}" fill="${options.fill}" />`);
    }
    cursorX += ((position?.xAdvance ?? 0) + extraAdvance) * scale;
  }

  const group = paths.join('');
  if (options.opacity === undefined) {
    return group;
  }
  return `<g opacity="${options.opacity}">${group}</g>`;
}

async function tryReadFile(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function loadLogoDataUrl(): Promise<string | null> {
  const candidates = [
    join(process.cwd(), 'apps', 'api', 'public', 'logo.png'),
    join(process.cwd(), '..', 'public', 'logo.png'),
    join(process.cwd(), 'public', 'logo.png')
  ];

  for (const logoPath of candidates) {
    const buffer = await tryReadFile(logoPath);
    if (!buffer) continue;
    const resized = await sharp(buffer)
      .resize(220, 220, { fit: 'cover' })
      .png()
      .toBuffer();
    return `data:image/png;base64,${resized.toString('base64')}`;
  }

  return null;
}

interface TierPalette {
  name: string;
  accent: string;
  accentLight: string;
  gradientStart: string;
  gradientEnd: string;
  ring: string;
}

function resolveTierPalette(membershipTypeName: string, isFree: boolean): TierPalette {
  const name = membershipTypeName.toLowerCase();

  if (isFree || name.includes('free') || name.includes('community')) {
    return {
      name: 'Community',
      accent: '#94a3b8',
      accentLight: '#e2e8f0',
      gradientStart: '#334155',
      gradientEnd: '#0f172a',
      ring: '#cbd5e1'
    };
  }

  if (name.includes('bronze')) {
    return {
      name: 'Bronze',
      accent: '#cd7f32',
      accentLight: '#f4d0a4',
      gradientStart: '#7c3a15',
      gradientEnd: '#2a1508',
      ring: '#cd7f32'
    };
  }

  if (name.includes('silver')) {
    return {
      name: 'Silver',
      accent: '#22d3ee',
      accentLight: '#a5f3fc',
      gradientStart: '#0e7490',
      gradientEnd: '#083344',
      ring: '#22d3ee'
    };
  }

  if (name.includes('gold') || name.includes('premium')) {
    return {
      name: 'Gold',
      accent: '#ffd700',
      accentLight: '#fef08a',
      gradientStart: '#92400e',
      gradientEnd: '#3f2208',
      ring: '#ffd700'
    };
  }

  if (name.includes('platinum') || name.includes('lifetime') || name.includes('life') || name.includes('vip')) {
    return {
      name: 'Platinum',
      accent: '#c084fc',
      accentLight: '#f3e8ff',
      gradientStart: '#6d28d9',
      gradientEnd: '#2e1065',
      ring: '#c084fc'
    };
  }

  return {
    name: 'Member',
    accent: '#00f0ff',
    accentLight: '#a5f3fc',
    gradientStart: '#0e7490',
    gradientEnd: '#020617',
    ring: '#00f0ff'
  };
}

export interface CardDetails {
  membershipId: string;
  memberName: string;
  membershipTypeName: string;
  isFree: boolean;
  startDate: Date;
  endDate: Date;
  dependantsCount: number;
  qrValue: string;
}

export async function generateCardBuffer(
  details: CardDetails,
  fontResolver?: FontFileResolver
): Promise<Buffer> {
  const [qrDataUrl, logoDataUrl, fonts] = await Promise.all([
    QRCode.toDataURL(details.qrValue, {
      width: 170,
      margin: 1,
      type: 'image/png'
    }),
    loadLogoDataUrl(),
    loadFonts(fontResolver)
  ]);

  const startDate = details.startDate.toLocaleDateString('en-GB');
  const endDate = details.endDate.toLocaleDateString('en-GB');
  const palette = resolveTierPalette(details.membershipTypeName, details.isFree);
  const typeLabel = details.membershipTypeName.toUpperCase();

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.gradientStart}"/>
      <stop offset="100%" stop-color="${palette.gradientEnd}"/>
    </linearGradient>

    <linearGradient id="bgShine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03"/>
    </linearGradient>

    <pattern id="dotPattern" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="1.5" fill="#ffffff" opacity="0.04"/>
    </pattern>

    <linearGradient id="bannerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.gradientStart}" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="${palette.accent}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${palette.gradientEnd}" stop-opacity="0.95"/>
    </linearGradient>

    <linearGradient id="holoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="25%" stop-color="#ff00a0"/>
      <stop offset="50%" stop-color="#ffd700"/>
      <stop offset="75%" stop-color="#7c1bbd"/>
      <stop offset="100%" stop-color="#00f0ff"/>
    </linearGradient>

    <linearGradient id="holoShine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>

    <filter id="glass" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"/>
      <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
    </filter>

    <clipPath id="logoClip">
      <circle cx="180" cy="250" r="105"/>
    </clipPath>

    <polygon id="holoStar" points="0,-38 9,-12 37,-12 15,5 23,34 0,17 -23,34 -15,5 -37,-12 -9,-12"/>
  </defs>

  <!-- Background -->
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bgGradient)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bgShine)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#dotPattern)"/>

  <!-- Main glass card -->
  <rect x="32" y="32" width="986" height="536" rx="28" fill="#ffffff" fill-opacity="0.04" filter="url(#glass)" stroke="${palette.accent}" stroke-width="2.5" stroke-opacity="0.45"/>

  <!-- Top membership-type banner -->
  <path d="M 32 60 A 28 28 0 0 1 60 32 L 990 32 A 28 28 0 0 1 1018 60 L 1018 112 L 32 112 Z" fill="url(#bannerGradient)" stroke="${palette.accent}" stroke-width="1.5" stroke-opacity="0.35"/>
  ${textToPath(fonts, typeLabel, 525, 82, 22, { weight: 800, anchor: 'middle', letterSpacing: 3, fill: palette.accentLight })}
  ${textToPath(fonts, 'MEMBERSHIP CARD', 525, 102, 10, { weight: 600, anchor: 'middle', letterSpacing: 4, fill: palette.accent, opacity: 0.9 })}

  ${logoDataUrl
    ? `<image x="70" y="140" width="220" height="220" href="${logoDataUrl}" clip-path="url(#logoClip)"/>`
    : `${textToPath(fonts, 'K', 180, 260, 72, { weight: 900, anchor: 'middle', fill: palette.accent })}${textToPath(fonts, 'KENT SLSC', 180, 310, 13, { weight: 700, anchor: 'middle', fill: palette.accentLight })}`}

  <!-- Member details -->
  ${textToPath(fonts, 'MEMBER NAME', 340, 170, 13, { weight: 700, letterSpacing: 2, fill: palette.accent })}
  ${textToPath(fonts, details.memberName, 340, 218, 42, { weight: 800, fill: '#ffffff' })}

  ${textToPath(fonts, 'MEMBERSHIP ID', 340, 290, 13, { weight: 700, letterSpacing: 2, fill: '#94a3b8' })}
  ${textToPath(fonts, details.membershipId, 340, 325, 24, { weight: 700, letterSpacing: 1, fill: '#ffffff' })}

  ${textToPath(fonts, 'VALID THROUGH', 340, 400, 13, { weight: 700, letterSpacing: 2, fill: '#94a3b8' })}
  ${textToPath(fonts, `${startDate} – ${endDate}`, 340, 435, 19, { weight: 600, fill: '#ffffff' })}

  ${textToPath(fonts, 'DEPENDANTS', 680, 400, 13, { weight: 700, letterSpacing: 2, fill: '#94a3b8' })}
  ${textToPath(fonts, String(details.dependantsCount), 680, 435, 19, { weight: 600, fill: '#ffffff' })}

  <!-- QR code panel -->
  <rect x="790" y="150" width="190" height="190" rx="18" fill="#ffffff"/>
  <image x="800" y="160" width="170" height="170" href="${qrDataUrl}"/>

  <!-- Holographic authentication seal -->
  <g transform="translate(885, 420)">
    <circle r="52" fill="url(#holoGradient)" opacity="0.92"/>
    <circle r="46" fill="#0f172a" fill-opacity="0.25"/>
    <circle r="46" fill="url(#holoShine)" opacity="0.35"/>
    <line x1="-46" y1="-46" x2="46" y2="46" stroke="url(#holoShine)" stroke-width="16" opacity="0.45" stroke-linecap="round"/>
    <use href="#holoStar" fill="#ffffff" opacity="0.95"/>
    ${textToPath(fonts, 'KENT SLSC', 0, -4, 9, { weight: 900, anchor: 'middle', letterSpacing: 1, fill: '#0f172a' })}
    ${textToPath(fonts, 'AUTHENTIC', 0, 12, 11, { weight: 900, anchor: 'middle', letterSpacing: 1.5, fill: '#0f172a' })}
  </g>

  ${textToPath(fonts, 'Scan to verify', 885, 502, 12, { anchor: 'middle', letterSpacing: 1, fill: '#94a3b8' })}

  <!-- Footer strip -->
  ${textToPath(fonts, 'KENT SRI LANKAN SOCIAL CLUB', 525, 565, 11, { weight: 500, anchor: 'middle', letterSpacing: 1.5, fill: '#64748b' })}
</svg>`;

  try {
    return sharp(Buffer.from(svg), { density: 96 })
      .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'fill' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  } catch (err) {
    throw new Error(`Card generation failed for ${details.membershipId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
