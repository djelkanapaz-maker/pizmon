import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** פסקול app icon: the logo (record, horn and wordmark) on ivory. */
export default function Icon() {
  const src = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/brand/paskol-icon.png')).toString('base64')}`;
  // eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser
  return new ImageResponse(<img src={src} width={512} height={512} alt="" />, size);
}
