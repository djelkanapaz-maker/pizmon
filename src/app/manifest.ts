import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'פסקול';
  return {
    name,
    short_name: name.split(' ').slice(0, 2).join(' '),
    description: 'הרגעים שלכם. המוזיקה שלנו.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f4ed',
    theme_color: '#f8f4ed',
    lang: 'he',
    dir: 'rtl',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
