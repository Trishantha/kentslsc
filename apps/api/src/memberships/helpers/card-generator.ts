import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import QRCode from 'qrcode';

const CARD_WIDTH = 1050;
const CARD_HEIGHT = 600;

interface TierPalette {
  name: string;
  accent: string;
  accentLight: string;
  gradientStart: string;
  gradientEnd: string;
  ring: string;
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const logoPath = join(process.cwd(), 'public', 'logo.png');
    const buffer = await readFile(logoPath);
    const resized = await sharp(buffer)
      .resize(220, 220, { fit: 'cover' })
      .png()
      .toBuffer();
    return `data:image/png;base64,${resized.toString('base64')}`;
  } catch {
    return null;
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

export async function generateCardBuffer(details: CardDetails): Promise<Buffer> {
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(details.qrValue, {
      width: 170,
      margin: 1,
      type: 'image/png'
    }),
    loadLogoDataUrl()
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
  <text x="525" y="82" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="800" fill="${palette.accentLight}" letter-spacing="3">${escapeXml(typeLabel)}</text>
  <text x="525" y="102" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600" fill="${palette.accent}" letter-spacing="4" opacity="0.9">MEMBERSHIP CARD</text>

  <!-- Club logo ring -->
  <circle cx="180" cy="250" r="115" fill="#ffffff" fill-opacity="0.06" stroke="${palette.ring}" stroke-width="3.5"/>
  <circle cx="180" cy="250" r="108" fill="#0f172a" fill-opacity="0.35"/>
  ${logoDataUrl
    ? `<image x="70" y="140" width="220" height="220" href="${logoDataUrl}" clip-path="url(#logoClip)"/>`
    : `<text x="180" y="260" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="900" fill="${palette.accent}">K</text><text x="180" y="310" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" fill="${palette.accentLight}">KENT SLSC</text>`}

  <!-- Member details -->
  <text x="340" y="170" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" fill="${palette.accent}" letter-spacing="2">MEMBER NAME</text>
  <text x="340" y="218" font-family="Inter, system-ui, sans-serif" font-size="42" font-weight="800" fill="#ffffff">${escapeXml(details.memberName)}</text>

  <text x="340" y="290" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" letter-spacing="2">MEMBERSHIP ID</text>
  <text x="340" y="325" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="700" fill="#ffffff" letter-spacing="1">${escapeXml(details.membershipId)}</text>

  <text x="340" y="400" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" letter-spacing="2">VALID THROUGH</text>
  <text x="340" y="435" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="600" fill="#ffffff">${escapeXml(startDate)} – ${escapeXml(endDate)}</text>

  <text x="680" y="400" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" letter-spacing="2">DEPENDANTS</text>
  <text x="680" y="435" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="600" fill="#ffffff">${details.dependantsCount}</text>

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
    <text y="-4" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="900" fill="#0f172a" letter-spacing="1">KENT SLSC</text>
    <text y="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="900" fill="#0f172a" letter-spacing="1.5">AUTHENTIC</text>
  </g>

  <text x="885" y="502" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="12" fill="#94a3b8" letter-spacing="1">Scan to verify</text>

  <!-- Footer strip -->
  <text x="525" y="565" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="500" fill="#64748b" letter-spacing="1.5">KENT SRI LANKAN SOCIAL CLUB</text>
</svg>`;

  return sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
}
