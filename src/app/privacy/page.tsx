import { getI18n } from '@/i18n/server';
import { BrandMark } from '@/components/brand';

export const metadata = { title: 'Privacy · ATISUTO' };

const UPDATED = '2026-10-21';

const he = {
  title: 'מדיניות פרטיות',
  intro: 'האפליקציה של ATISUTO עוזרת לזוגות לתכנן את המוזיקה של החתונה יחד עם ה-DJ שלהם. המסמך הזה מסביר איזה מידע נשמר, למה, ומה אפשר לעשות איתו.',
  sections: [
    ['מי אחראי על המידע', 'ATISUTO היא האחראית על המידע באפליקציה. חשבונות נפתחים רק על ידי החברה, עבור זוגות ודיג׳ייז שעובדים איתה.'],
    ['איזה מידע נשמר', 'שם, כתובת מייל, פרטי החתונה (תאריך, מקום, מספר אורחים), בחירות מוזיקליות (שאלון, רגעים מיוחדים, פלייליסטים, שירים שאהבתם או שלא), בקשות והודעות בינכם לבין ה-DJ, ומועד פגישת התיאום. באפליקציה לטלפון נשמר גם מזהה התראות של המכשיר כדי לשלוח לכם התראות.'],
    ['למה', 'כדי שה-DJ שלכם יכיר את הטעם המוזיקלי שלכם, כדי לתאם איתכם פגישה, וכדי לשלוח לכם עדכונים על החתונה. המידע לא נמכר ולא משמש לפרסום.'],
    ['מי רואה את המידע', 'אתם, ה-DJ שמשובץ לחתונה שלכם, ומנהלי החברה. ההרשאות נאכפות במסד הנתונים עצמו.'],
    ['שירותים חיצוניים', 'המידע נשמר אצל Supabase (שרתים באיחוד האירופי) והאתר מתארח ב-Vercel. נגן השירים הוא הנגן הרשמי של Spotify, ו-Spotify עשויים לאסוף מידע לפי מדיניות הפרטיות שלהם. כשנקבעת פגישה, היא נכנסת ליומן Google של ה-DJ, ונשלח לו מייל מכתובת ה-Gmail של החברה. התראות לטלפון נשלחות דרך Apple ו-Google.'],
    ['כמה זמן', 'המידע נשמר כל עוד יש לכם חשבון, ולתקופה סבירה אחרי החתונה לצורך שירות. אפשר לבקש מחיקה בכל זמן.'],
    ['הזכויות שלכם', 'אפשר לעיין במידע, לתקן אותו ולבקש למחוק את החשבון: באפליקציה, במסך פרופיל ← "בקשה למחיקת החשבון", או בפנייה לחברה. בקשת מחיקה מטופלת ותאושר לכם במייל.'],
  ],
  contact: 'שאלות על פרטיות: דרך האתר atisuto.com.',
  updated: 'עודכן לאחרונה',
};

const en = {
  title: 'Privacy policy',
  intro: 'The ATISUTO app helps couples plan their wedding music with their DJ. This page explains what is stored, why, and what you can do about it.',
  sections: [
    ['Who is responsible', 'ATISUTO is responsible for the data in the app. Accounts are created only by the company, for couples and DJs who work with it.'],
    ['What we store', 'Name, email, wedding details (date, venue, guest count), music choices (questionnaire, special moments, playlists, songs you liked or not), requests and messages between you and your DJ, and the planning-meeting time. The phone app also stores a device notification token so we can send you notifications.'],
    ['Why', 'So your DJ knows your musical taste, to schedule a meeting with you, and to send you updates about your wedding. Data is never sold or used for advertising.'],
    ['Who can see it', 'You, the DJ assigned to your wedding, and company admins. Permissions are enforced in the database itself.'],
    ['Outside services', 'Data is stored with Supabase (servers in the EU) and the site is hosted on Vercel. Songs play in Spotify’s official player, and Spotify may collect data under its own privacy policy. When a meeting is booked it is added to the DJ’s Google Calendar and the DJ is emailed from the company Gmail. Phone notifications are delivered through Apple and Google.'],
    ['How long', 'As long as you have an account, and for a reasonable period after the wedding for service purposes. You can ask for deletion at any time.'],
    ['Your rights', 'You can view and correct your data and request account deletion: in the app under Profile → “Request account deletion”, or by contacting the company. Deletion requests are handled and confirmed by email.'],
  ],
  contact: 'Privacy questions: through atisuto.com.',
  updated: 'Last updated',
};

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const t = locale === 'he' ? he : en;
  return (
    <main id="main" className="min-h-dvh">
      <header className="brand-frame gutter h-14 flex items-center"><BrandMark name="ATISUTO" /></header>
      <article className="gutter max-w-2xl py-10 flex flex-col gap-6">
        <h1 className="display-l">{t.title}</h1>
        <p className="text-paper-dim">{t.intro}</p>
        {t.sections.map(([h, b]) => (
          <section key={h} className="flex flex-col gap-2">
            <h2 className="display text-xl">{h}</h2>
            <p className="leading-relaxed">{b}</p>
          </section>
        ))}
        <p className="text-paper-dim">{t.contact}</p>
        <p className="text-xs text-paper-dim">{t.updated}: {UPDATED}</p>
      </article>
    </main>
  );
}
