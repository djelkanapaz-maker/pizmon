import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { BrandMark } from '@/components/brand';
import { ShareClient, type ShareTrack } from './ShareClient';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type View = { names: (string | null)[]; brand: string; tracks: ShareTrack[]; suggested: number } | null;

/** Public page a couple shares with friends: their playlist + suggest songs (no account). */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data } = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await db.rpc('share_view', { p_token: token }) : { data: null };
  const view = data as View;
  return (
    <main id="main" className="min-h-dvh pb-24">
      <header className="brand-frame gutter h-14 flex items-center"><BrandMark name={view?.brand ?? 'ATISUTO'} href="#" /></header>
      {!view ? (
        <p className="gutter max-w-2xl mx-auto py-16 text-center text-paper-dim">{m.friends.invalid}</p>
      ) : (
        <ShareClient token={token} names={view.names.filter(Boolean).join(' & ')} tracks={view.tracks} />
      )}
      <p className="gutter text-center text-xs text-paper-dim mt-12">{fmt(m.friends.poweredBy, { brand: view?.brand ?? 'ATISUTO' })}</p>
    </main>
  );
}
