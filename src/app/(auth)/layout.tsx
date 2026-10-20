import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand';
import { LocaleSwitch } from '@/components/LocaleSwitch';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="min-h-dvh flex flex-col">
      <div className="gutter pt-[max(20px,env(safe-area-inset-top))] flex items-center justify-between">
        <BrandMark />
        <LocaleSwitch compact />
      </div>
      <div className="flex-1 grid place-items-center gutter py-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
