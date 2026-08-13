import { generateSharedOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Kent Sri Lankan Social Club';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return generateSharedOgImage();
}
