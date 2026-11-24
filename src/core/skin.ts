/** The look each user picks for the app: the ivory original or the dark "Noir Violet". */
export const SKINS = ['light', 'dark'] as const;
export type Skin = (typeof SKINS)[number];
export const SKIN_COOKIE = 'paskol_skin';
export const isSkin = (v: unknown): v is Skin => v === 'light' || v === 'dark';
/** Browser bar / status bar color per skin. */
export const SKIN_THEME_COLOR: Record<Skin, string> = { light: '#f8f4ed', dark: '#000000' };
