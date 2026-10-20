import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
});

export const IconHome = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>);
export const IconDiscover = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>);
export const IconRings = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="9" cy="14" r="6" /><circle cx="15" cy="14" r="6" /><path d="m10 3 2 2 2-2" /></svg>);
export const IconRadio = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="m7 8 9-5" /><circle cx="15" cy="14.5" r="2.5" /><path d="M7 13h3M7 16h3" /></svg>);
export const IconUser = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const IconBell = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg>);
export const IconPlay = ({ size, ...p }: P) => (<svg {...base(size)} fill="currentColor" stroke="none" {...p}><path d="M7 4.5v15a.5.5 0 0 0 .77.42l11.5-7.5a.5.5 0 0 0 0-.84L7.77 4.08A.5.5 0 0 0 7 4.5z" /></svg>);
export const IconPause = ({ size, ...p }: P) => (<svg {...base(size)} fill="currentColor" stroke="none" {...p}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>);
export const IconHeart = ({ size, filled, ...p }: P & { filled?: boolean }) => (<svg {...base(size)} fill={filled ? 'currentColor' : 'none'} {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>);
export const IconX = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconPlus = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCheck = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m5 12 5 5L20 7" /></svg>);
export const IconBan = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>);
export const IconStar = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>);
export const IconExternal = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const IconChevron = ({ size, ...p }: P) => (<svg {...base(size)} {...p} className={`rtl:-scale-x-100 ${p.className ?? ''}`}><path d="m9 6 6 6-6 6" /></svg>);
export const IconArrowBack = ({ size, ...p }: P) => (<svg {...base(size)} {...p} className={`rtl:-scale-x-100 ${p.className ?? ''}`}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>);
export const IconList = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
export const IconFilter = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 5h16M7 12h10M10 19h4" /></svg>);
export const IconMessage = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 5h16v11H8l-4 4z" /></svg>);
export const IconNote = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>);
export const IconLock = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const IconArrowUp = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconArrowDown = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>);
export const IconGlobe = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>);
export const IconCompare = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 3v18M16 3v18M3 8h5M16 16h5" /></svg>);
export const IconSpark = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>);
export const IconUpload = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>);
export const IconTrash = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const IconCopy = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>);
export const IconVolume = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>);
