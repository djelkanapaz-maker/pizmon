export const MEETING_MINUTES = 60;
export const MEETING_TZ = 'Asia/Jerusalem';
/** Studio/office address for "meet at the office". Empty → that option is hidden (meet on Zoom or somewhere else). */
const OFFICE = (process.env.NEXT_PUBLIC_OFFICE_ADDRESS ?? '').trim();
export const OFFICE_ADDRESS = { he: OFFICE, en: OFFICE };
export const MEETING_MODES = (OFFICE ? ['office', 'zoom', 'other'] : ['zoom', 'other']) as ('office' | 'zoom' | 'other')[];
/** Couples are reminded (and the booking calendar pops up) from this many days before the wedding. */
export const MEETING_WINDOW_DAYS = 31;
