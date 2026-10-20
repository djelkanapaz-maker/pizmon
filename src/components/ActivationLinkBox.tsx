'use client';
import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Badge, Button } from './ui';
import { IconCopy } from './icons';

/** One-time activation link for the admin to hand over (e.g. via WhatsApp). */
export function ActivationLinkBox({ link, emailSent }: { link: string; emailSent?: boolean }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="card p-4 border-gold/60 flex flex-col gap-3">
      <p className="label">{m.admin.activationLink}</p>
      <p className="text-sm text-paper-dim">{m.admin.activationHint}</p>
      <code className="block break-all text-xs bg-ink-3 rounded-[10px] p-3" dir="ltr">{link}</code>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="gold" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          <IconCopy size={16} />{copied ? m.common.copied : m.common.copy}
        </Button>
        <a className="text-sm font-bold underline underline-offset-4" href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        {emailSent && <Badge tone="ok">✓ email</Badge>}
      </div>
    </div>
  );
}
