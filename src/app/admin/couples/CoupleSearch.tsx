'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { Input } from '@/components/ui';

export function CoupleSearch({ initial }: { initial: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Input type="search" value={q} aria-label={m.admin.searchCouples} placeholder={m.admin.searchCouples}
      onChange={(e) => {
        const v = e.target.value; setQ(v);
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => router.replace(v.trim() ? `/admin/couples?q=${encodeURIComponent(v.trim())}` : '/admin/couples'), 300);
      }} />
  );
}
