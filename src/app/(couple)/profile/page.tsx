import { requireCouple } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { signOut } from '@/server/actions/common';
import { Button, PageHeader } from '@/components/ui';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { ProfileName } from './ProfileName';
import { AccountDeletion } from '@/components/AccountDeletion';

export default async function ProfilePage() {
  const s = await requireCouple();
  const { m } = await getI18n();
  return (
    <div>
      <PageHeader title={m.profile.title} />
      <div className="gutter flex flex-col gap-4 max-w-xl">
        <section className="card p-5 flex flex-col gap-4">
          <p className="label">{m.profile.account}</p>
          <p className="text-sm" dir="auto">{fmt(m.profile.signedInAs, { email: s.email })}</p>
          <ProfileName initial={s.fullName ?? ''} />
        </section>
        <section className="card p-5 flex flex-col gap-3">
          <p className="label">{m.common.language}</p>
          <LocaleSwitch />
          <p className="text-sm text-paper-dim">{m.profile.languageHint}</p>
        </section>
        <section className="card p-5 flex flex-col gap-2">
          <p className="label">{m.profile.install}</p>
          <p className="text-sm text-paper-dim">{m.profile.installHint}</p>
        </section>
        <AccountDeletion />
        <form action={signOut}><Button variant="secondary" full>{m.common.signOut}</Button></form>
      </div>
    </div>
  );
}
