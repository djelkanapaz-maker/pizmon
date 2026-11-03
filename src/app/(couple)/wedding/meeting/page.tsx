import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { getActiveAssignment, getEvent } from '@/server/queries';
import { LeadCard } from '@/components/lead/LeadCard';
import { PageHeader } from '@/components/ui';
import { MeetingPanel, type BookedMeeting } from '@/components/meeting/MeetingPanel';

export default async function MeetingPage() {
  const s = await requireCouple();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const [{ data: meeting }, assignment, event] = await Promise.all([
    db.from('dj_meetings').select('id, starts_at, mode, location').eq('event_id', s.eventId).eq('status', 'booked').maybeSingle(),
    getActiveAssignment(s.eventId),
    getEvent(s.eventId),
  ]);
  const selfService = event?.signup_source === 'self' && !assignment;
  const djName = assignment?.status === 'confirmed' ? assignment.dj?.display_name ?? '' : '';
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.meeting.title} sub={m.meeting.sub} />
      <div className="gutter max-w-xl">
        {djName ? <MeetingPanel meeting={(meeting as BookedMeeting | null) ?? null} djName={djName} />
          : selfService && event ? <LeadCard event={event} compact /> : <p className="text-paper-dim">{m.meeting.noDj}</p>}
      </div>
    </div>
  );
}
