import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#0f0e0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: 999, background: '#ff5b35', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 82, height: 82, borderRadius: 999, border: '4px solid rgba(15,14,13,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: '#0f0e0d' }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
