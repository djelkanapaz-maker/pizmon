import { ImageResponse } from 'next/og';
import { BRAND_COLORS, barsPath } from '@/components/pizmon-mark';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** Pizmon mark: dark sound-wave bars on the brand gradient. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${BRAND_COLORS.violetStrong}, ${BRAND_COLORS.electric} 55%, ${BRAND_COLORS.magenta})` }}>
        <svg width="420" height="420" viewBox="0 0 64 64"><path fill={BRAND_COLORS.ink} d={barsPath()} /></svg>
      </div>
    ),
    size,
  );
}
