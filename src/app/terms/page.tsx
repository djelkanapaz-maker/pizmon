import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { BrandMark } from '@/components/brand';

export const metadata = { title: 'Terms · Paskol' };

const UPDATED = '2026-11-25';
const YEAR = 2026;

const he = {
  title: 'תנאי שימוש',
  intro: 'ברוכים הבאים לפסקול, האפליקציה של אלקנה פז לתכנון המוזיקה של החתונה. השימוש באפליקציה, באתר paskol.app ובאפליקציות לטלפון כפוף לתנאים האלה. התנאים כתובים בלשון רבים ומתייחסים לכל המגדרים.',
  sections: [
    ['מי אנחנו', 'פסקול מופעלת על ידי אלקנה פז (Elkana Paz Music Services). לכל שאלה: elkanapazmusic@gmail.com.'],
    ['השירות', 'פסקול מאפשרת לזוגות לבחור שירים לרגעים בחתונה, לבנות פלייליסטים, לסמן מה לא תרצו לשמוע, לתאם פגישה עם הדיג׳יי ולשלוח לו סיכום מוזיקלי. השירות ניתן לזוגות בחינם. אנחנו רשאים לשנות, להוסיף או להפסיק חלקים מהשירות בכל עת.'],
    ['גיל ושימוש בחשבון', 'השימוש בפסקול מיועד לבני 18 ומעלה. אתם אחראים שהפרטים שמסרתם נכונים, לשמור על הסיסמה שלכם, ולכל פעולה שנעשית בחשבון.'],
    ['שימוש מותר', 'מותר להשתמש בפסקול לתכנון המוזיקה של החתונה שלכם בלבד, לשימוש אישי ולא מסחרי. אסור: להעתיק, לשכפל או להפיץ חלקים מהאפליקציה; לאסוף או למשוך מידע ממנה באופן אוטומטי (סריקה, בוטים, scraping); לנסות לפענח, לעקוף או לפרק את הקוד שלה (הנדסה לאחור); לפגוע בפעילותה או באבטחתה; או להשתמש בה כדי לבנות שירות מתחרה.'],
    ['קניין רוחני', 'כל הזכויות בפסקול שמורות לאלקנה פז, ובכלל זה: קוד המקור והתוכנה, העיצוב, הממשק ומראה המסכים (בגוון הבהיר והכהה), השם ״פסקול״, הלוגו והסיסמה ״הרגעים שלכם. המוזיקה שלנו.״, הטקסטים, השאלון, האוספים והפלייליסטים שנבחרו, נערכו ומתעדכנים על ידינו, וכן הסרטונים, הקריינות והתמונות. אין להעתיק, לשכפל, לשנות, להפיץ, לפרסם, להציג בפומבי, ליצור יצירות נגזרות או לעשות שימוש מסחרי בכל אחד מאלה, כולו או חלקו, בלי אישור מראש ובכתב מאלקנה פז. השימוש באפליקציה לא מעניק לכם שום זכות בקניין הרוחני הזה, מלבד הרשות להשתמש בה לפי התנאים האלה.'],
    ['מוזיקה ושירותים חיצוניים', 'השירים, שמות האמנים ועטיפות האלבומים שייכים לבעלי הזכויות שלהם. השמעת השירים נעשית דרך הנגן הרשמי של Spotify ובהתאם לתנאים של Spotify. פסקול לא מעניקה זכויות בשירים עצמם.'],
    ['התוכן שלכם', 'הבחירות, ההערות והבקשות שאתם מוסיפים נשארות שלכם. אתם מאשרים לנו להשתמש בהן כדי לתת לכם את השירות, למשל להציג אותן לדיג׳יי שלכם ולהפיק את הסיכום המוזיקלי.'],
    ['אחריות', 'פסקול ניתנת כמו שהיא (AS IS). אנחנו משקיעים כדי שתעבוד היטב, אבל לא מתחייבים שתהיה זמינה תמיד או נקייה מתקלות. פסקול היא כלי תכנון: הביצוע בפועל בחתונה הוא באחריות הדיג׳יי שמנגן בה, ואם זה דיג׳יי אחר, אלקנה פז אינו אחראי לשירות שלו. ככל שהחוק מתיר, לא נהיה אחראים לנזק עקיף או תוצאתי שנגרם מהשימוש באפליקציה.'],
    ['הפרה של התנאים', 'אם התנאים יופרו, ובמיוחד אם תהיה העתקה או שימוש לא מורשה בקניין הרוחני של פסקול, נוכל לחסום את הגישה ולנקוט צעדים משפטיים.'],
    ['פרטיות', 'מה נשמר ואיך, כתוב במדיניות הפרטיות.'],
    ['שינויים בתנאים', 'אנחנו רשאים לעדכן את התנאים מעת לעת. הנוסח המעודכן יופיע בעמוד הזה, והמשך השימוש אחרי עדכון מהווה הסכמה לו.'],
    ['דין וסמכות שיפוט', 'על התנאים האלה יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט נתונה לבתי המשפט המוסמכים בישראל.'],
  ] as [string, string][],
  privacy: 'למדיניות הפרטיות',
  updated: 'עודכן לאחרונה',
  rights: `© ${YEAR} אלקנה פז (Elkana Paz Music Services). כל הזכויות שמורות.`,
};

const en = {
  title: 'Terms of use',
  intro: 'Welcome to Paskol, Elkana Paz’s app for planning your wedding music. Using the app, paskol.app and the phone apps is subject to these terms.',
  sections: [
    ['Who we are', 'Paskol is operated by Elkana Paz (Elkana Paz Music Services). Questions: elkanapazmusic@gmail.com.'],
    ['The service', 'Paskol lets couples pick songs for the moments of their wedding, build playlists, mark what they never want to hear, book a meeting with their DJ and send them a music summary. It is free for couples. We may change, add or discontinue parts of the service at any time.'],
    ['Age and your account', 'Paskol is for people aged 18 and over. You are responsible for giving accurate details, for keeping your password safe, and for everything done in your account.'],
    ['Permitted use', 'You may use Paskol to plan the music for your own wedding, for personal, non-commercial use only. You may not: copy, reproduce or distribute any part of the app; collect or pull data from it automatically (crawlers, bots, scraping); try to decompile, bypass or take apart its code (reverse engineering); interfere with its operation or security; or use it to build a competing service.'],
    ['Intellectual property', 'All rights in Paskol belong to Elkana Paz, including: the source code and software, the design, interface and look of the screens (light and dark), the name “Paskol” (פסקול), the logo and the tagline, the texts, the questionnaire, the collections and playlists we select, edit and keep updated, and the videos, voice-overs and images. You may not copy, reproduce, modify, distribute, publish, publicly display, create derivative works from or commercially use any of these, in whole or in part, without Elkana Paz’s prior written permission. Using the app gives you no rights in this intellectual property other than the permission to use it under these terms.'],
    ['Music and outside services', 'Songs, artist names and album artwork belong to their rights holders. Songs play through Spotify’s official player under Spotify’s terms. Paskol grants no rights in the songs themselves.'],
    ['Your content', 'The choices, notes and requests you add remain yours. You allow us to use them to provide the service, for example to show them to your DJ and to produce your music summary.'],
    ['Liability', 'Paskol is provided as is. We work to keep it running well but do not promise it will always be available or error-free. Paskol is a planning tool: what is actually played at the wedding is the responsibility of the DJ playing it, and if that is another DJ, Elkana Paz is not responsible for their service. To the extent the law allows, we are not liable for indirect or consequential damage from using the app.'],
    ['Breach', 'If these terms are breached, and in particular if Paskol’s intellectual property is copied or used without permission, we may block access and take legal action.'],
    ['Privacy', 'What we store and how is set out in the privacy policy.'],
    ['Changes', 'We may update these terms from time to time. The current version is on this page, and continuing to use the app after an update means you accept it.'],
    ['Governing law', 'These terms are governed solely by the laws of the State of Israel, and the competent courts in Israel have jurisdiction.'],
  ] as [string, string][],
  privacy: 'Privacy policy',
  updated: 'Last updated',
  rights: `© ${YEAR} Elkana Paz (Elkana Paz Music Services). All rights reserved.`,
};

export default async function TermsPage() {
  const { locale } = await getI18n();
  const t = locale === 'he' ? he : en;
  return (
    <main id="main" className="min-h-dvh">
      <header className="brand-frame gutter h-14 flex items-center"><BrandMark /></header>
      <article className="gutter max-w-2xl py-10 flex flex-col gap-6">
        <h1 className="display-l">{t.title}</h1>
        <p className="text-paper-dim">{t.intro}</p>
        {t.sections.map(([h, b]) => (
          <section key={h} id={h === 'קניין רוחני' || h === 'Intellectual property' ? 'ip' : undefined} className="flex flex-col gap-2 scroll-mt-6">
            <h2 className="display text-xl">{h}</h2>
            <p className="leading-relaxed">{b}</p>
          </section>
        ))}
        <Link href="/privacy" className="underline underline-offset-4 self-start">{t.privacy}</Link>
        <p className="text-xs text-paper-dim">{t.updated}: {UPDATED}</p>
        <p className="text-xs text-paper-dim">{t.rights}</p>
      </article>
    </main>
  );
}
