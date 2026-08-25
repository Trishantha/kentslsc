import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function generateSharedOgImage() {
  let logoDataUrl: string | undefined;
  try {
    const logoPath = join(process.cwd(), 'public', 'logo.png');
    const logoBuffer = readFileSync(logoPath);
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    logoDataUrl = undefined;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 30% 30%, rgba(0, 184, 148, 0.25) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.25) 0%, transparent 45%), linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
          color: '#f8fafc',
          padding: '64px',
          textAlign: 'center'
        }}
      >
        {logoDataUrl && (
          <img
            src={logoDataUrl}
            alt=""
            width={160}
            height={160}
            style={{ borderRadius: '28px', marginBottom: '36px' }}
          />
        )}
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
          Kent Sri Lankan Social Club
        </div>
        <div
          style={{
            marginTop: '28px',
            fontSize: 32,
            color: '#cbd5e1',
            maxWidth: '900px',
            lineHeight: 1.4
          }}
        >
          Connecting the Sri Lankan community in Kent through events, culture, business, and fellowship.
        </div>
      </div>
    ),
    { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }
  );
}
