'use client';
import { useSyncExternalStore } from 'react';

/** true only after hydration — used to keep auth forms from submitting natively before JS is ready. */
export function useHydrated() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}
