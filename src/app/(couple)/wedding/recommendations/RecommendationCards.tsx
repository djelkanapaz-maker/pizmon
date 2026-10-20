'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { relativeTime } from '@/i18n/format';
import { respondToRecommendation } from '@/server/actions/couple';
import { useToast } from '@/components/overlay';
import { Badge, Button, Cover, Input, cx } from '@/components/ui';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { externalOptions, playableSource } from '@/components/music/listening';
import { IconExternal } from '@/components/icons';
import type { Track } from '@/server/queries';

type Rec = { id: string; message: string | null; created_at: string; is_ai_suggestion: boolean; moment_id: string | null; dj: { display_name: string } | null; track: Track | null; playlist: { id: string; title: string } | null; response: { status: string; comment: string | null } | null };

export function RecommendationCards({ recs, momentNames }: { recs: Rec[]; momentNames: Record<string, string> }) {
  const { m, locale, fmt } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [asking, setAsking] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const respond = (id: string, status: 'approved' | 'rejected' | 'saved' | 'question', comment?: string) => start(async () => {
    const r = await respondToRecommendation(id, status, comment);
    if (!r.ok) return toast(m.common.error, 'error');
    toast(m.recommendations.status[status]); setAsking(null); setQuestion(''); router.refresh();
  });
  return (
    <ul className="gutter flex flex-col gap-3">
      {recs.map((r) => {
        const st = (r.response?.status ?? 'pending') as keyof typeof m.recommendations.status;
        const src = r.track ? playableSource(r.track) : null;
        return (
          <li key={r.id} className={cx('card p-4 flex flex-col gap-3', st === 'pending' && 'border-ember/60')}>
            <div className="flex items-center justify-between gap-2 text-xs text-paper-dim">
              <span>{r.dj?.display_name}{r.moment_id && momentNames[r.moment_id] ? ` · ${fmt(m.recommendations.forMoment, { moment: momentNames[r.moment_id] })}` : ''}</span>
              <span className="flex items-center gap-2">{r.is_ai_suggestion && <Badge>{m.recommendations.ai}</Badge>}<Badge tone={st === 'pending' ? 'ember' : st === 'approved' ? 'gold' : 'neutral'}>{m.recommendations.status[st]}</Badge>{relativeTime(r.created_at, locale)}</span>
            </div>
            {r.track && (
              <div className="flex items-center gap-3">
                <Cover seed={r.track.id} label={r.track.title} src={r.track.artwork_url} size={64} />
                <div className="flex-1 min-w-0"><p className="font-bold" dir="auto">{r.track.title}</p><p className="text-sm text-paper-dim" dir="auto">{r.track.artist?.name}</p></div>
                {src ? <PlayToggle source={src} /> : (
                  <a href={externalOptions(r.track)[0].url} target="_blank" rel="noopener noreferrer" aria-label={fmt(m.discover.searchOn, { service: externalOptions(r.track)[0].service })} className="size-11 grid place-items-center rounded-full border border-line hover:border-paper"><IconExternal size={18} /></a>
                )}
              </div>
            )}
            {r.playlist && <Link href={`/discover/collection/${r.playlist.id}`} className="font-bold underline underline-offset-4">{m.recommendations.playlist}: {r.playlist.title}</Link>}
            {r.message && <p className="text-sm rounded-[12px] bg-ink-3 p-3" dir="auto">{r.message}</p>}
            {r.response?.comment && <p className="text-sm text-paper-dim" dir="auto">→ {r.response.comment}</p>}
            {asking === r.id ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) respond(r.id, 'question', question); }}>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={m.recommendations.askPlaceholder} aria-label={m.recommendations.ask} maxLength={1000} dir="auto" autoFocus />
                <Button type="submit" disabled={busy || !question.trim()}>{m.common.send}</Button>
              </form>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <Button size="sm" variant={st === 'approved' ? 'gold' : 'primary'} disabled={busy} onClick={() => respond(r.id, 'approved')}>{m.recommendations.approve}</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => respond(r.id, 'rejected')}>{m.recommendations.reject}</Button>
                <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => respond(r.id, 'saved')}>{m.recommendations.later}</Button>
                <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => setAsking(r.id)}>{m.recommendations.ask}</Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
