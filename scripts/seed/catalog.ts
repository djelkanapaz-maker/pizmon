// DEVELOPMENT SEED CONTENT — clearly marked is_demo in the database.
// Tracks are real, well-known songs as *metadata only* (rights_status = metadata_only):
// no artwork, previews or playback URLs are included, and the app only offers
// clearly-labelled external search links for them.

export const COMPANY = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'atisuto',
  brand_name: 'ATISUTO',
  brand_tagline_he: 'הפסקול של החתונה שלכם — אטיסוטו',
  brand_tagline_en: 'The soundtrack of your wedding — by Atisuto',
};

export const GENRES: [slug: string, he: string, en: string][] = [
  ['pop', 'פופ', 'Pop'],
  ['israeli-pop', 'פופ ישראלי', 'Israeli pop'],
  ['mizrahi', 'מזרחית וים תיכונית', 'Mizrahi & Mediterranean'],
  ['israeli-classics', 'קלאסיקות ישראליות', 'Israeli classics'],
  ['jewish', 'יהודית ומסורתית', 'Jewish & traditional'],
  ['disco-funk', 'דיסקו ופאנק', 'Disco & funk'],
  ['house', 'האוס', 'House'],
  ['tech-house', 'טק האוס', 'Tech house'],
  ['electronic', 'אלקטרוני / EDM', 'Electronic / EDM'],
  ['trance', 'טראנס', 'Trance'],
  ['techno', 'טכנו', 'Techno'],
  ['rnb-hiphop', 'R&B והיפ־הופ', 'R&B & hip-hop'],
  ['rock', 'רוק', 'Rock'],
  ['soul', 'סול וג׳אז', 'Soul & jazz'],
  ['classical', 'קלאסי וקולנועי', 'Classical & cinematic'],
];

export const CATEGORIES: [slug: string, he: string, en: string][] = [
  ['israeli-wedding-hits', 'להיטי חתונות ישראליים', 'Israeli wedding hits'],
  ['jewish-traditional', 'יהודי ומסורתי', 'Jewish & traditional'],
  ['international-hits', 'להיטים בינלאומיים', 'International hits'],
  ['pop', 'פופ', 'Pop'],
  ['disco-funk', 'דיסקו ופאנק', 'Disco & funk'],
  ['house-electronic', 'האוס ואלקטרוני', 'House & electronic'],
  ['tech-house', 'טק האוס', 'Tech house'],
  ['soulful-house', 'סולפול האוס', 'Soulful house'],
  ['rnb-hiphop', 'R&B והיפ־הופ', 'R&B & hip-hop'],
  ['mediterranean-mizrahi', 'ים תיכוני ומזרחי', 'Mediterranean & Mizrahi'],
  ['throwback', 'קלאסיקות נוסטלגיה', 'Throwback classics'],
  ['singalong', 'שירה בציבור', 'Sing-along songs'],
  ['dedications', 'הקדשות מיוחדות', 'Special dedications'],
];

export const MOODS: [slug: string, he: string, en: string][] = [
  ['romantic', 'רומנטי', 'Romantic'],
  ['emotional', 'מרגש', 'Emotional'],
  ['euphoric', 'אופוריה', 'Euphoric'],
  ['groovy', 'גרובי', 'Groovy'],
  ['elegant', 'אלגנטי', 'Elegant'],
  ['nostalgic', 'נוסטלגי', 'Nostalgic'],
];

export const MOMENTS: { slug: string; he: string; en: string; dhe: string; den: string; required: boolean; lang?: boolean }[] = [
  { slug: 'groom-entrance', he: 'כניסת החתן', en: 'Groom’s entrance', dhe: 'השיר שמלווה את החתן אל החופה.', den: 'The song that walks the groom to the chuppah.', required: true },
  { slug: 'bride-entrance', he: 'כניסת הכלה', en: 'Bride’s entrance', dhe: 'הרגע שכולם מחכים לו.', den: 'The moment everyone is waiting for.', required: true },
  { slug: 'couple-entrance', he: 'כניסת הזוג לרחבה', en: 'Couple’s entrance', dhe: 'הכניסה המשותפת אחרי החופה.', den: 'Your entrance together after the ceremony.', required: true },
  { slug: 'breaking-the-glass', he: 'שבירת הכוס', en: 'Breaking the glass', dhe: 'שנייה של שקט — ואז פיצוץ שמחה. בחרו עברי או בינלאומי.', den: 'A second of silence — then joy. Choose Hebrew or international.', required: true, lang: true },
  { slug: 'first-dance', he: 'הריקוד הראשון', en: 'First dance', dhe: 'הריקוד הראשון שלכם כזוג נשוי.', den: 'Your first dance as a married couple.', required: true },
  { slug: 'family-dances', he: 'ריקודי משפחה', en: 'Family dances', dhe: 'ריקוד עם ההורים או רגע משפחתי.', den: 'A dance with parents or a family moment.', required: false },
  { slug: 'reception-opening', he: 'פתיחת הרחבה', en: 'Reception opening', dhe: 'השיר שפותח את הריקודים.', den: 'The track that opens the dancefloor.', required: true },
  { slug: 'dedications', he: 'הקדשות מיוחדות', en: 'Special dedications', dhe: 'שיר לחברים, למשפחה, למישהו שחסר.', den: 'A song for friends, family, someone missed.', required: false },
  { slug: 'closing-song', he: 'שיר הסיום', en: 'Closing song', dhe: 'השיר האחרון של הלילה.', den: 'The last song of the night.', required: true },
];

type T = {
  title: string; artist: string; genre: string; energy: 1 | 2 | 3 | 4 | 5; lang: 'he' | 'en' | 'instrumental' | 'other';
  decade: number | null; cats?: string[]; moods?: string[]; moments?: (string | [string, 'he' | 'intl'])[];
};

export const TRACKS: T[] = [
  // Israeli & Jewish
  { title: 'ירושלים של זהב', artist: 'נעמי שמר', genre: 'israeli-classics', energy: 2, lang: 'he', decade: 1960, cats: ['jewish-traditional', 'singalong'], moods: ['emotional', 'nostalgic'], moments: ['bride-entrance', ['breaking-the-glass', 'he']] },
  { title: 'אני ואתה', artist: 'אריק איינשטיין', genre: 'israeli-classics', energy: 2, lang: 'he', decade: 1970, cats: ['singalong', 'throwback'], moods: ['nostalgic', 'romantic'], moments: ['first-dance', 'dedications'] },
  { title: 'ממעמקים', artist: 'הפרויקט של עידן רייכל', genre: 'israeli-pop', energy: 2, lang: 'he', decade: 2000, moods: ['romantic', 'emotional'], moments: ['bride-entrance', 'first-dance'] },
  { title: 'הפרח בגני', artist: 'זוהר ארגוב', genre: 'mizrahi', energy: 3, lang: 'he', decade: 1980, cats: ['mediterranean-mizrahi', 'singalong', 'throwback'], moods: ['nostalgic'], moments: ['dedications', 'family-dances'] },
  { title: 'Im Nin’alu', artist: 'Ofra Haza', genre: 'mizrahi', energy: 4, lang: 'he', decade: 1980, cats: ['mediterranean-mizrahi', 'throwback'], moods: ['euphoric'] },
  { title: 'Tudo Bom', artist: 'Static & Ben El', genre: 'israeli-pop', energy: 5, lang: 'he', decade: 2010, cats: ['israeli-wedding-hits', 'pop'], moods: ['euphoric'], moments: ['couple-entrance', 'reception-opening'] },
  { title: 'Further Up (Na, Na, Na, Na, Na)', artist: 'Static & Ben El', genre: 'pop', energy: 5, lang: 'en', decade: 2010, cats: ['israeli-wedding-hits', 'international-hits'], moods: ['euphoric'], moments: [['breaking-the-glass', 'intl']] },
  { title: 'תל אביב', artist: 'עומר אדם', genre: 'mizrahi', energy: 5, lang: 'he', decade: 2010, cats: ['israeli-wedding-hits', 'mediterranean-mizrahi'], moods: ['euphoric'], moments: ['couple-entrance', ['breaking-the-glass', 'he']] },
  { title: 'Toy', artist: 'Netta', genre: 'pop', energy: 5, lang: 'en', decade: 2010, cats: ['israeli-wedding-hits', 'pop'], moods: ['euphoric'] },
  { title: 'מלכת השושנים', artist: 'עדן בן זקן', genre: 'mizrahi', energy: 4, lang: 'he', decade: 2010, cats: ['israeli-wedding-hits', 'mediterranean-mizrahi'], moods: ['groovy'] },
  { title: 'תותים', artist: 'חנן בן ארי', genre: 'israeli-pop', energy: 3, lang: 'he', decade: 2010, cats: ['singalong'], moods: ['emotional'], moments: ['dedications'] },
  { title: 'תרקוד', artist: 'שלמה ארצי', genre: 'israeli-classics', energy: 4, lang: 'he', decade: 1980, cats: ['singalong', 'throwback'], moods: ['nostalgic'], moments: ['closing-song'] },
  { title: 'יו יה', artist: 'כוורת', genre: 'israeli-classics', energy: 4, lang: 'he', decade: 1970, cats: ['singalong', 'throwback'], moods: ['nostalgic'] },
  { title: 'עוד ישמע', artist: 'שלמה קרליבך', genre: 'jewish', energy: 4, lang: 'he', decade: null, cats: ['jewish-traditional'], moods: ['euphoric'], moments: [['breaking-the-glass', 'he'], 'couple-entrance'] },
  { title: 'הבה נגילה', artist: 'Traditional', genre: 'jewish', energy: 5, lang: 'he', decade: null, cats: ['jewish-traditional', 'singalong'], moods: ['euphoric'], moments: ['family-dances'] },
  // Ceremony & first dance
  { title: 'Canon in D', artist: 'Johann Pachelbel', genre: 'classical', energy: 1, lang: 'instrumental', decade: null, moods: ['elegant', 'romantic'], moments: ['bride-entrance', 'groom-entrance'] },
  { title: 'Con te partirò', artist: 'Andrea Bocelli', genre: 'classical', energy: 2, lang: 'other', decade: 1990, moods: ['elegant', 'emotional'], moments: ['bride-entrance'] },
  { title: 'A Thousand Years', artist: 'Christina Perri', genre: 'pop', energy: 2, lang: 'en', decade: 2010, moods: ['romantic'], moments: ['bride-entrance', 'first-dance'] },
  { title: 'Perfect', artist: 'Ed Sheeran', genre: 'pop', energy: 2, lang: 'en', decade: 2010, cats: ['international-hits'], moods: ['romantic'], moments: ['first-dance'] },
  { title: 'At Last', artist: 'Etta James', genre: 'soul', energy: 2, lang: 'en', decade: 1960, cats: ['throwback'], moods: ['romantic', 'elegant'], moments: ['first-dance'] },
  { title: 'Can’t Help Falling in Love', artist: 'Elvis Presley', genre: 'soul', energy: 1, lang: 'en', decade: 1960, cats: ['throwback'], moods: ['romantic', 'nostalgic'], moments: ['first-dance', 'groom-entrance'] },
  { title: 'All of Me', artist: 'John Legend', genre: 'soul', energy: 2, lang: 'en', decade: 2010, moods: ['romantic'], moments: ['first-dance'] },
  { title: 'Somewhere Over the Rainbow', artist: 'Israel Kamakawiwoʻole', genre: 'pop', energy: 1, lang: 'en', decade: 1990, moods: ['emotional'], moments: ['groom-entrance', 'family-dances'] },
  { title: 'The Way You Look Tonight', artist: 'Frank Sinatra', genre: 'soul', energy: 2, lang: 'en', decade: 1960, moods: ['elegant', 'romantic'], moments: ['family-dances'] },
  { title: 'Marry You', artist: 'Bruno Mars', genre: 'pop', energy: 4, lang: 'en', decade: 2010, cats: ['international-hits'], moods: ['euphoric'], moments: ['couple-entrance', ['breaking-the-glass', 'intl']] },
  // Dancefloor — disco, funk, pop
  { title: 'September', artist: 'Earth, Wind & Fire', genre: 'disco-funk', energy: 4, lang: 'en', decade: 1970, cats: ['disco-funk', 'throwback', 'singalong'], moods: ['groovy'], moments: ['reception-opening'] },
  { title: 'Le Freak', artist: 'Chic', genre: 'disco-funk', energy: 4, lang: 'en', decade: 1970, cats: ['disco-funk', 'throwback'], moods: ['groovy'] },
  { title: 'Celebration', artist: 'Kool & The Gang', genre: 'disco-funk', energy: 4, lang: 'en', decade: 1980, cats: ['disco-funk', 'singalong'], moods: ['euphoric'], moments: [['breaking-the-glass', 'intl']] },
  { title: 'Stayin’ Alive', artist: 'Bee Gees', genre: 'disco-funk', energy: 4, lang: 'en', decade: 1970, cats: ['disco-funk', 'throwback'], moods: ['groovy'] },
  { title: 'Dancing Queen', artist: 'ABBA', genre: 'disco-funk', energy: 4, lang: 'en', decade: 1970, cats: ['disco-funk', 'singalong'], moods: ['euphoric', 'nostalgic'] },
  { title: 'I Will Survive', artist: 'Gloria Gaynor', genre: 'disco-funk', energy: 4, lang: 'en', decade: 1970, cats: ['disco-funk', 'singalong'], moods: ['euphoric'] },
  { title: 'Get Lucky', artist: 'Daft Punk', genre: 'disco-funk', energy: 4, lang: 'en', decade: 2010, cats: ['disco-funk', 'international-hits'], moods: ['groovy'], moments: ['reception-opening'] },
  { title: 'Uptown Funk', artist: 'Mark Ronson', genre: 'disco-funk', energy: 5, lang: 'en', decade: 2010, cats: ['international-hits', 'disco-funk'], moods: ['groovy', 'euphoric'], moments: ['couple-entrance'] },
  { title: 'I Wanna Dance with Somebody (Who Loves Me)', artist: 'Whitney Houston', genre: 'pop', energy: 4, lang: 'en', decade: 1980, cats: ['throwback', 'singalong'], moods: ['euphoric'] },
  { title: 'Don’t Stop Me Now', artist: 'Queen', genre: 'rock', energy: 5, lang: 'en', decade: 1970, cats: ['singalong', 'throwback'], moods: ['euphoric'] },
  { title: 'Livin’ on a Prayer', artist: 'Bon Jovi', genre: 'rock', energy: 5, lang: 'en', decade: 1980, cats: ['singalong', 'throwback'], moods: ['euphoric'] },
  { title: 'Don’t Stop Believin’', artist: 'Journey', genre: 'rock', energy: 4, lang: 'en', decade: 1980, cats: ['singalong', 'throwback'], moods: ['nostalgic'], moments: ['closing-song'] },
  { title: 'Happy', artist: 'Pharrell Williams', genre: 'pop', energy: 4, lang: 'en', decade: 2010, cats: ['international-hits', 'pop'], moods: ['euphoric'] },
  { title: 'Levitating', artist: 'Dua Lipa', genre: 'pop', energy: 4, lang: 'en', decade: 2020, cats: ['international-hits', 'pop'], moods: ['groovy'] },
  { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'pop', energy: 4, lang: 'en', decade: 2010, cats: ['international-hits', 'pop'], moods: ['euphoric'] },
  { title: 'As It Was', artist: 'Harry Styles', genre: 'pop', energy: 3, lang: 'en', decade: 2020, cats: ['international-hits', 'pop'], moods: ['nostalgic'] },
  { title: 'Hey Ya!', artist: 'OutKast', genre: 'rnb-hiphop', energy: 5, lang: 'en', decade: 2000, cats: ['rnb-hiphop', 'singalong'], moods: ['euphoric'] },
  { title: 'Crazy in Love', artist: 'Beyoncé', genre: 'rnb-hiphop', energy: 5, lang: 'en', decade: 2000, cats: ['rnb-hiphop', 'international-hits'], moods: ['euphoric'] },
  { title: 'Yeah!', artist: 'Usher', genre: 'rnb-hiphop', energy: 5, lang: 'en', decade: 2000, cats: ['rnb-hiphop', 'throwback'], moods: ['euphoric'] },
  // House & electronic
  { title: 'Show Me Love', artist: 'Robin S', genre: 'house', energy: 4, lang: 'en', decade: 1990, cats: ['house-electronic', 'soulful-house', 'throwback'], moods: ['groovy'] },
  { title: 'Gypsy Woman (She’s Homeless)', artist: 'Crystal Waters', genre: 'house', energy: 4, lang: 'en', decade: 1990, cats: ['house-electronic', 'soulful-house', 'throwback'], moods: ['groovy'] },
  { title: 'Latch', artist: 'Disclosure', genre: 'house', energy: 4, lang: 'en', decade: 2010, cats: ['house-electronic', 'soulful-house'], moods: ['groovy'] },
  { title: 'Losing It', artist: 'FISHER', genre: 'tech-house', energy: 5, lang: 'instrumental', decade: 2010, cats: ['tech-house', 'house-electronic'], moods: ['euphoric'] },
  { title: 'Wake Me Up', artist: 'Avicii', genre: 'electronic', energy: 5, lang: 'en', decade: 2010, cats: ['house-electronic', 'singalong'], moods: ['euphoric'], moments: ['closing-song'] },
  { title: 'Feel So Close', artist: 'Calvin Harris', genre: 'electronic', energy: 5, lang: 'en', decade: 2010, cats: ['house-electronic', 'international-hits'], moods: ['euphoric'] },
  // Closing
  { title: '(I’ve Had) The Time of My Life', artist: 'Bill Medley & Jennifer Warnes', genre: 'pop', energy: 4, lang: 'en', decade: 1980, cats: ['throwback', 'singalong'], moods: ['nostalgic', 'romantic'], moments: ['closing-song', 'couple-entrance'] },
];

// Atisuto roster — names, bios, links and portraits come from atisuto.com (used with permission),
// extracted to scripts/seed/atisuto/roster.json and public/djs/*. Specialties are short tags
// summarising each published bio; edit them in Admin → DJs.
export const SPECIALTIES: Record<string, string[]> = {
  'ITAY GALO': ['Founder', 'Weddings', 'Clubs', 'Festivals'],
  'EVE HAKMON': ['Weddings', 'Large events', 'Precise timing'],
  'NOAM KOCHAV': ['Nostalgic hits', 'Multi-genre', 'Musician'],
  'SHAI ARGAMAN': ['Late-night energy', 'Personal requests'],
  'LIOR ZEEVI': ['Mainstream', 'Producer', 'Festivals'],
  'TA-YO': ['Hard techno', 'Producer', 'Multi-genre'],
  'NIR ROZENBERG': ['18 years experience', 'Multi-genre', 'Emotional moments'],
  'LIAV YEHUDA': ['Mainstream', 'Weddings', 'Clubs'],
  'ITAY ITSHAKI': ['Mainstream', 'Festivals', 'Crowd reading'],
  'YAHAV BOAZ': ['Mainstream', 'Electronic', 'Afro house'],
  'ROTEM ASHASH': ['Mainstream', 'Hits & remixes', 'Weddings'],
  'DALIT RECHESTER': ['Radio', 'Deep music knowledge'],
  'RON NARIZ': ['Brazilian rhythms', 'High energy'],
  'FayJ': ['Eclectic', 'Performance', 'Dance-floor energy'],
  'HARD TO TELL': ['Techno', 'House', 'New wave', 'Marathon sets'],
  'EILON HAZAN': ['Live guitar', 'Live on DJ', 'Techno / house / psy'],
};


// Original demo audio generated by scripts/seed/make-demo-audio.py (company-owned).
export const CONTENT = [
  { kind: 'mix', title: 'Golden Hour — Reception Warm-Up (Demo)', dj: null, file: '/demo-audio/golden-hour.mp3', tags: ['house', 'groovy'], featured: true },
  { kind: 'genre_set', title: 'Disco Floor Starter (Demo)', dj: null, file: '/demo-audio/disco-floor.mp3', tags: ['disco', 'funk'], featured: false },
  { kind: 'training_set', title: 'Morning Run 128 BPM (Demo)', dj: null, file: '/demo-audio/morning-run.mp3', tags: ['electronic', 'workout'], featured: false },
  { kind: 'wedding_collection', title: 'Chuppah Strings Sketch (Demo)', dj: null, file: '/demo-audio/chuppah-sketch.mp3', tags: ['ceremony', 'elegant'], featured: true },
] as const;

export const EDITORIAL_PLAYLISTS = [
  { title: 'כניסה לחופה — הקלאסיקות', title_en: 'Ceremony classics', purpose: 'ceremony', featured: true,
    tracks: ['Canon in D', 'Con te partirò', 'A Thousand Years', 'ממעמקים', 'ירושלים של זהב', 'Can’t Help Falling in Love'] },
  { title: 'דיסקו לרחבה', title_en: 'Disco for the dancefloor', purpose: 'dancefloor', featured: true,
    tracks: ['September', 'Le Freak', 'Stayin’ Alive', 'Get Lucky', 'Dancing Queen', 'I Will Survive', 'Celebration'] },
  { title: 'שבירת כוס — עברית ובינלאומית', title_en: 'Breaking the glass picks', purpose: 'breaking_the_glass', featured: false,
    tracks: ['תל אביב', 'עוד ישמע', 'Further Up (Na, Na, Na, Na, Na)', 'Marry You', 'Celebration'] },
];
