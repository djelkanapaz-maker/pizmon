import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'WEDDING MUSIC CLUB';
  return {
    name,
    short_name: name.split(' ').slice(0, 2).join(' '),
    description: 'The digital home of your wedding’s music.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0e0d',
    theme_color: '#0f0e0d',
    lang: 'he',
    dir: 'rtl',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
