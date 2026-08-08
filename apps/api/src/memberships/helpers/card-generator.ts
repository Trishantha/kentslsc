import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import QRCode from 'qrcode';

const CARD_WIDTH = 1050;
const CARD_HEIGHT = 600;

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const logoPath = join(process.cwd(), 'public', 'logo.png');
    const buffer = await readFile(logoPath);
    const resized = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
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

export interface CardDetails {
  membershipId: string;
  memberName: string;
  membershipTypeName: string;
  startDate: Date;
  endDate: Date;
  dependantsCount: number;
  qrValue: string;
}

export async function generateCardBuffer(details: CardDetails): Promise<Buffer> {
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(details.qrValue, {
      width: 200,
      margin: 1,
      type: 'image/png'
    }),
    loadLogoDataUrl()
  ]);

  const startDate = details.startDate.toLocaleDateString('en-GB');
  const endDate = details.endDate.toLocaleDateString('en-GB');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <filter id="glass" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"/>
      <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
    </filter>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#ffd700"/>
    </linearGradient>
    <clipPath id="logoClip">
      <circle cx="190" cy="210" r="115" />
    </clipPath>
  </defs>

  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>

  <!-- Glass panels -->
  <rect x="40" y="40" width="970" height="520" rx="32" fill="#ffffff" fill-opacity="0.06" filter="url(#glass)" stroke="url(#neon)" stroke-width="3"/>
  <rect x="70" y="90" width="240" height="240" rx="120" fill="#ffffff" fill-opacity="0.05" stroke="#ffd700" stroke-width="2"/>

  <!-- Club logo -->
  ${logoDataUrl ? `<image x="75" y="95" width="230" height="230" href="${logoDataUrl}" clip-path="url(#logoClip)" />` : `<text x="190" y="225" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="800" fill="#ffd700">K</text><text x="190" y="275" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" fill="#00f0ff">KENT SLSC</text>`}

  <!-- Member details -->
  <text x="340" y="130" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#00f0ff">MEMBER</text>
  <text x="340" y="185" font-family="Inter, system-ui, sans-serif" font-size="40" font-weight="700" fill="#ffffff">${escapeXml(details.memberName)}</text>

  <text x="340" y="250" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="500" fill="#94a3b8">Membership ID</text>
  <text x="340" y="285" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${escapeXml(details.membershipId)}</text>

  <text x="340" y="345" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="500" fill="#94a3b8">Type</text>
  <text x="340" y="375" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#ffd700">${escapeXml(details.membershipTypeName)}</text>

  <text x="650" y="345" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="500" fill="#94a3b8">Valid</text>
  <text x="650" y="375" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600" fill="#ffffff">${escapeXml(startDate)} – ${escapeXml(endDate)}</text>

  <text x="340" y="440" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="500" fill="#94a3b8">Dependants</text>
  <text x="340" y="470" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#ffffff">${details.dependantsCount}</text>

  <!-- QR code -->
  <image x="780" y="180" width="200" height="200" href="${qrDataUrl}" />
  <text x="880" y="405" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" fill="#94a3b8">Scan to verify</text>
</svg>`;

  return sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
}
