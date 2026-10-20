import { getI18n } from '@/i18n/server';

export default async function SetupPage() {
  const { m } = await getI18n();
  return (
    <div>
      <h1 className="display-l mb-4">{m.setup.title}</h1>
      <p className="mb-4">{m.setup.body}</p>
      <p className="text-paper-dim" dir="ltr">{m.setup.steps}</p>
    </div>
  );
}
