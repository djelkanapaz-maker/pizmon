import { ImageResponse } from 'next/og';
import { BRAND_COLORS, PE_PATH } from '@/components/pizmon-mark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** פזמון app icon: the thin "פ" in charcoal on ivory (brand board, icon variation "Ivory"). */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND_COLORS.ivory }}>
        <svg width="116" height="116" viewBox="0 0 64 64">
          <path d={PE_PATH} fill="none" stroke={BRAND_COLORS.charcoal} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
