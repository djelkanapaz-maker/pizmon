/** Instant placeholder shown while a page's data loads, so every tap responds immediately. */
export function PageSkeleton() {
  return (
    <div className="gutter py-6 flex flex-col gap-4 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-4 w-24 rounded-full bg-ink-2" />
      <div className="h-9 w-2/3 max-w-[420px] rounded-[10px] bg-ink-2" />
      <div className="h-24 rounded-[14px] bg-ink-2" />
      <div className="h-16 rounded-[14px] bg-ink-2" />
      <div className="h-16 rounded-[14px] bg-ink-2" />
      <div className="h-16 rounded-[14px] bg-ink-2" />
    </div>
  );
}
