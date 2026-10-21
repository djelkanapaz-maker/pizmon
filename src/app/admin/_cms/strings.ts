// Admin CMS strings that don't exist in src/i18n yet. Pick with cmsStrings(locale).
import type { Locale } from '@/core/i18n-text';

const en = {
  errors: {
    duplicate: 'That slug or name is already used.',
    in_use: 'It’s still in use elsewhere — remove those links first.',
    upload_failed: 'Upload failed. Nothing was saved.',
    file_type: 'That file type isn’t allowed.',
    file_too_large: 'That file is too large.',
    no_station: 'Save the station first.',
    rights: 'This URL needs a matching rights level.',
    url: 'Use an https:// URL or a /demo-audio/ path.',
    invalid: 'Check this field.',
  },
  genres: 'Genres', categories: 'Categories', moods: 'Moods', newMood: 'Add mood', sortOrder: 'Order',
  searchTracks: 'Search title or artist', page: 'Page {n} of {total}', prev: 'Previous', next: 'Next',
  tracksCount: '{count} tracks', noTracks: 'No tracks yet.', noMatches: 'Nothing matches.',
  decade: 'Decade', energy: 'Energy', language: 'Language', genre: 'Genre', provider: 'Provider', providerId: 'Provider track ID',
  tagsTitle: 'Categories & moods', momentsTitle: 'Curated for moments', collection: 'Collection', anyCollection: 'Any',
  deleteConfirm: 'Tap again to delete', basics: 'Basics', media: 'Media & links', save: 'Save',
  title: 'Title', description: 'Description', purpose: 'Purpose', tracksTitle: 'Tracks', addTracksHint: 'Search the catalog to add tracks.',
  inPlaylist: 'Added', spotifyTitle: 'Spotify playlists', spotifyHelp: 'Paste links to public Spotify playlists (one or many). Each becomes a collection in the Music library; songs become part of the catalog.', spotifyImport: 'Import / sync', spotifySyncAll: 'Sync all from Spotify', spotifyFailed: 'Could not read', spotifyTruncated: 'First 100 songs only', spotifySynced: 'Synced {time}', spotifyResult: '{title}: {count} songs', emptyPlaylists: 'No editorial playlists yet.', emptyContent: 'No content yet.', emptyMoments: 'No moments yet.',
  emptyList: 'Nothing here yet.', inactive: 'Inactive', genreTags: 'Genre tags (comma separated)', uploading: 'Uploading…',
  uploadedTo: 'Uploaded — URL filled in.', couple: 'Couple', stationName: 'Station name', emptySchedule: 'No shows scheduled.',
  draftEditor: 'Draft editor', valid: 'Valid JSON', responses: 'Responses', state: 'State', noVersions: 'No questionnaire versions yet.',
  publishConfirm: 'Tap again to publish — this locks the version', deleteDraft: 'Delete draft', settingsSaved: 'Settings saved',
  minutes: 'min', edit: 'Edit', current: 'Live for new couples',
};
type Strings = typeof en;

const he: Strings = {
  errors: {
    duplicate: 'המזהה או השם כבר בשימוש.',
    in_use: 'הפריט עדיין בשימוש — יש להסיר את הקישורים אליו קודם.',
    upload_failed: 'ההעלאה נכשלה. לא נשמר דבר.',
    file_type: 'סוג הקובץ אינו נתמך.',
    file_too_large: 'הקובץ גדול מדי.',
    no_station: 'יש לשמור את התחנה קודם.',
    rights: 'כתובת זו דורשת רמת זכויות מתאימה.',
    url: 'יש להזין כתובת https://‎ או נתיב ‎/demo-audio/‎.',
    invalid: 'יש לבדוק שדה זה.',
  },
  genres: 'ז׳אנרים', categories: 'קטגוריות', moods: 'אווירות', newMood: 'הוספת אווירה', sortOrder: 'סדר',
  searchTracks: 'חיפוש לפי שם או אמן', page: 'עמוד {n} מתוך {total}', prev: 'הקודם', next: 'הבא',
  tracksCount: '{count} שירים', noTracks: 'אין עדיין שירים.', noMatches: 'לא נמצאו תוצאות.',
  decade: 'עשור', energy: 'אנרגיה', language: 'שפה', genre: 'ז׳אנר', provider: 'ספק', providerId: 'מזהה אצל הספק',
  tagsTitle: 'קטגוריות ואווירות', momentsTitle: 'מומלץ לרגעים', collection: 'אוסף', anyCollection: 'כללי',
  deleteConfirm: 'הקישו שוב למחיקה', basics: 'פרטים', media: 'מדיה וקישורים', save: 'שמירה',
  title: 'כותרת', description: 'תיאור', purpose: 'מטרה', tracksTitle: 'שירים', addTracksHint: 'חפשו בקטלוג כדי להוסיף שירים.',
  inPlaylist: 'נוסף', spotifyTitle: 'פלייליסטים מספוטיפיי', spotifyHelp: 'הדביקו קישורים לפלייליסטים ציבוריים בספוטיפיי (אחד או כמה). כל פלייליסט יופיע כאוסף במאגר המוזיקה, והשירים ייכנסו למאגר.', spotifyImport: 'ייבוא / סנכרון', spotifySyncAll: 'סנכרון הכול מספוטיפיי', spotifyFailed: 'לא הצלחנו לקרוא', spotifyTruncated: 'רק 100 השירים הראשונים', spotifySynced: 'סונכרן {time}', spotifyResult: '{title}: {count} שירים', emptyPlaylists: 'אין עדיין פלייליסטים מערכתיים.', emptyContent: 'אין עדיין תוכן.', emptyMoments: 'אין עדיין רגעים.',
  emptyList: 'אין כאן עדיין כלום.', inactive: 'לא פעיל', genreTags: 'תגיות ז׳אנר (מופרדות בפסיק)', uploading: 'מעלה…',
  uploadedTo: 'הועלה — הכתובת מולאה.', couple: 'זוג', stationName: 'שם התחנה', emptySchedule: 'אין תוכניות מתוזמנות.',
  draftEditor: 'עריכת טיוטה', valid: 'JSON תקין', responses: 'תשובות', state: 'מצב', noVersions: 'אין עדיין גרסאות שאלון.',
  publishConfirm: 'הקישו שוב לפרסום — הגרסה תינעל', deleteDraft: 'מחיקת טיוטה', settingsSaved: 'ההגדרות נשמרו',
  minutes: 'דק׳', edit: 'עריכה', current: 'פעילה לזוגות חדשים',
};

export const cmsStrings = (locale: Locale): Strings => (locale === 'he' ? he : en);
export type CmsStrings = Strings;
