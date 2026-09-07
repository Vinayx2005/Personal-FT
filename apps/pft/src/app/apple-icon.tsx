import { ImageResponse } from 'next/og';

// Auto-served by Next at /apple-icon and used as the iOS home-screen icon.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 68,
          background: '#F37335',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 900,
          letterSpacing: -2,
          borderRadius: 40,
        }}
      >
        PFT
      </div>
    ),
    { ...size }
  );
}
