import type { SelectionStatus } from '@/core/moments';

export const STATUS_TONE: Record<SelectionStatus, 'neutral' | 'ember' | 'gold' | 'danger'> = {
  not_started: 'neutral', browsing: 'neutral', shortlisted: 'neutral', awaiting_confirmation: 'ember', confirmed: 'gold', change_requested: 'danger',
};
