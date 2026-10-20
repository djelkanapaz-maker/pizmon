import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#0f0e0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 340, height: 340, borderRadius: 999, background: '#ff5b35', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 230, height: 230, borderRadius: 999, border: '10px solid rgba(15,14,13,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 110, height: 110, borderRadius: 999, background: '#0f0e0d' }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
