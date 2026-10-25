import type { ReactNode } from 'react';
import { BrandMark, FlowLines } from '@/components/brand';
import { LocaleSwitch } from '@/components/LocaleSwitch';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="relative min-h-dvh flex flex-col overflow-hidden bg-ink">
      {/* brand flow lines along the bottom of the page */}
      <FlowLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] w-full" />
      <div className="relative gutter pt-[max(22px,env(safe-area-inset-top))] flex items-start justify-between">
        <BrandMark tagline size={34} />
        <LocaleSwitch compact />
      </div>
      <div className="relative flex-1 grid place-items-center gutter pt-10 pb-[30vh]">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
