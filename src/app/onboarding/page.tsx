import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getActiveAssignment, getEvent, type Dj } from '@/server/queries';
import { OnboardingFlow } from './OnboardingFlow';

export const metadata = { title: 'Welcome' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const s = await requireCouple();
  const sp = await searchParams;
  const db = await supabaseServer();
  const [event, assignment, { data: djs }, { data: mixes }] = await Promise.all([
    getEvent(s.eventId),
    getActiveAssignment(s.eventId),
    db.from('djs').select('id, display_name, slug, bio_he, bio_en, specialties, photo_url, is_active, accepts_new_couples, is_demo')
      .eq('company_id', s.company.id).eq('is_active', true).order('sort_order'),
    db.from('content_items').select('id, title, kind, media_url, creator_dj_id, is_demo').eq('company_id', s.company.id)
      .eq('status', 'published').not('creator_dj_id', 'is', null).not('media_url', 'is', null),
  ]);
  if (!event) return null;
  const requested = ['welcome', 'dj', 'details'].includes(sp.step ?? '') ? sp.step : undefined;
  const initial = (requested ?? (event.onboarding_step === 'done' ? 'welcome' : event.onboarding_step)) as 'welcome' | 'dj' | 'details';
  return (
    <OnboardingFlow
      initialStep={initial}
      event={event}
      assignment={assignment}
      djs={(djs ?? []) as Dj[]}
      mixes={(mixes ?? []) as { id: string; title: string; kind: string; media_url: string; creator_dj_id: string; is_demo: boolean }[]}
      policy={s.company.assignment_policy}
      brand={s.company.brand_name}
    />
  );
}
