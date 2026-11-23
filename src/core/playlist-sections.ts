/** The stages of the wedding the couple's playlist is split into, in the order of the night. */
export const PLAYLIST_SECTIONS = ['ceremony', 'reception', 'party'] as const;
export type PlaylistSection = (typeof PLAYLIST_SECTIONS)[number];

/** A song with no section (added before sections existed, or from search/import) belongs to the party. */
export const sectionOf = (v: string | null | undefined): PlaylistSection =>
  v === 'ceremony' || v === 'reception' ? v : 'party';

/** Groups items by section in the order of the night, keeping each group's own order; empty groups are left out. */
export function groupBySection<T extends { section?: string | null }>(items: T[]): { section: PlaylistSection; items: T[] }[] {
  return PLAYLIST_SECTIONS.map((section) => ({ section, items: items.filter((x) => sectionOf(x.section) === section) })).filter((g) => g.items.length > 0);
}
