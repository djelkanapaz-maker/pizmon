import { getI18n } from '@/i18n/server';
import { BrandMark } from '@/components/brand';

export const metadata = { title: 'Privacy · Paskol' };

const UPDATED = '2026-11-14';

const he = {
  title: 'מדיניות פרטיות',
  intro: 'פסקול, האפליקציה של אלקנה פז, עוזרת לזוגות לתכנן את המוזיקה של החתונה יחד עם ה-DJ שלהם. המסמך הזה מסביר איזה מידע נשמר, למה, ומה אפשר לעשות איתו.',
  sections: [
    ['מי אחראי על המידע', 'אלקנה פז (Elkana Paz Music Services) אחראי על המידע באפליקציה. חשבון נפתח על ידי אלקנה עבור זוגות שעובדים איתו, או על ידי הזוג עצמו בהרשמה החינמית.'],
    ['איזה מידע נשמר', 'שם, כתובת מייל, מספר טלפון, פרטי החתונה (תאריך, מקום, מספר אורחים, ואם כבר סגרתם דיג׳יי), בחירות מוזיקליות (שאלון, רגעים מיוחדים, פלייליסטים, שירים שאהבתם או שלא), בקשות והודעות בינכם לבין ה-DJ, ומועד פגישת התיאום. באפליקציה לטלפון נשמר גם מזהה התראות של המכשיר כדי לשלוח לכם התראות.'],
    ['למה', 'כדי שה-DJ שלכם יכיר את הטעם המוזיקלי שלכם, כדי לתאם איתכם פגישה, וכדי לשלוח לכם עדכונים על החתונה. המידע לא נמכר ולא מועבר לאף אחד. אם נרשמתם בעצמכם, אלקנה פז עשוי ליצור איתכם קשר בטלפון או בוואטסאפ בנוגע לחתונה ולשירותי דיג׳יי. אם אינכם מעוניינים בכך, אמרו לנו בכל שלב ולא נפנה אליכם שוב.'],
    ['מי רואה את המידע', 'אתם, ה-DJ שמשובץ לחתונה שלכם, ומנהלי החברה. ההרשאות נאכפות במסד הנתונים עצמו.'],
    ['שירותים חיצוניים', 'המידע נשמר אצל Supabase (שרתים באיחוד האירופי) והאתר מתארח ב-Vercel. נגן השירים הוא הנגן הרשמי של Spotify, ו-Spotify עשויים לאסוף מידע לפי מדיניות הפרטיות שלהם. כשנקבעת פגישה, היא נכנסת ליומן Google של ה-DJ, ונשלח לו מייל מכתובת ה-Gmail של החברה. התראות לטלפון נשלחות דרך Apple ו-Google.'],
    ['כמה זמן', 'המידע נשמר כל עוד יש לכם חשבון, ולתקופה סבירה אחרי החתונה לצורך שירות. אפשר לבקש מחיקה בכל זמן.'],
    ['הזכויות שלכם', 'אפשר לעיין במידע, לתקן אותו ולבקש למחוק את החשבון: באפליקציה, במסך פרופיל ← "בקשה למחיקת החשבון", או בפנייה לחברה. בקשת מחיקה מטופלת ותאושר לכם במייל.'],
  ],
  deletion: {
    title: 'מחיקת החשבון בפסקול',
    intro: 'אפשר למחוק את החשבון שלכם בפסקול ואת כל המידע שקשור אליו, בכל זמן ובלי עלות.',
    steps: [
      'באפליקציה פסקול או באתר paskol.app, היכנסו לחשבון.',
      'עברו למסך "פרופיל".',
      'לחצו על "בקשה למחיקת החשבון" ואשרו.',
      'אין לכם גישה לחשבון? שלחו מייל ל-elkanapazmusic@gmail.com מהכתובת שאיתה נרשמתם, עם הכותרת "מחיקת חשבון פסקול".',
    ],
    what: 'מה נמחק: החשבון, פרטי החתונה, הטלפון, כל הבחירות המוזיקליות, ההודעות והבקשות, ומזהי ההתראות של המכשירים. הבקשה מטופלת תוך 30 יום ותאושר לכם במייל. לא נשמר מידע אחרי המחיקה, מלבד מה שהחוק מחייב לשמור.',
  },
  contact: 'שאלות על פרטיות: elkanapazmusic@gmail.com או דרך האתר elkanapaz.com.',
  updated: 'עודכן לאחרונה',
};

const en = {
  title: 'Privacy policy',
  intro: 'Paskol, Elkana Paz’s app, helps couples plan their wedding music with their DJ. This page explains what is stored, why, and what you can do about it.',
  sections: [
    ['Who is responsible', 'Elkana Paz (Elkana Paz Music Services) is responsible for the data in the app. Accounts are created by Elkana for couples who work with him, or by couples themselves through the free sign-up.'],
    ['What we store', 'Name, email, phone number, wedding details (date, venue, guest count, and whether you already booked a DJ), music choices (questionnaire, special moments, playlists, songs you liked or not), requests and messages between you and your DJ, and the planning-meeting time. The phone app also stores a device notification token so we can send you notifications.'],
    ['Why', 'So your DJ knows your musical taste, to schedule a meeting with you, and to send you updates about your wedding. Data is never sold or passed on. If you signed up yourself, Elkana Paz may contact you by phone or WhatsApp about your wedding and DJ services. If you’d rather not, tell us at any time and we won’t contact you again.'],
    ['Who can see it', 'You, the DJ assigned to your wedding, and company admins. Permissions are enforced in the database itself.'],
    ['Outside services', 'Data is stored with Supabase (servers in the EU) and the site is hosted on Vercel. Songs play in Spotify’s official player, and Spotify may collect data under its own privacy policy. When a meeting is booked it is added to the DJ’s Google Calendar and the DJ is emailed from the company Gmail. Phone notifications are delivered through Apple and Google.'],
    ['How long', 'As long as you have an account, and for a reasonable period after the wedding for service purposes. You can ask for deletion at any time.'],
    ['Your rights', 'You can view and correct your data and request account deletion: in the app under Profile → “Request account deletion”, or by contacting the company. Deletion requests are handled and confirmed by email.'],
  ],
  deletion: {
    title: 'Deleting your Paskol account',
    intro: 'You can delete your Paskol account and all the data linked to it at any time, free of charge.',
    steps: [
      'Sign in to the Paskol app or to paskol.app.',
      'Go to the “Profile” screen.',
      'Tap “Request account deletion” and confirm.',
      'Can’t sign in? Email elkanapazmusic@gmail.com from the address you signed up with, with the subject “Delete my Paskol account”.',
    ],
    what: 'What is deleted: your account, wedding details, phone number, all music choices, messages and requests, and device notification tokens. Requests are completed within 30 days and confirmed by email. Nothing is kept after deletion except what the law requires us to keep.',
  },
  contact: 'Privacy questions: elkanapazmusic@gmail.com or through elkanapaz.com.',
  updated: 'Last updated',
};

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const t = locale === 'he' ? he : en;
  return (
    <main id="main" className="min-h-dvh">
      <header className="brand-frame gutter h-14 flex items-center"><BrandMark /></header>
      <article className="gutter max-w-2xl py-10 flex flex-col gap-6">
        <h1 className="display-l">{t.title}</h1>
        <p className="text-paper-dim">{t.intro}</p>
        {t.sections.map(([h, b]) => (
          <section key={h} className="flex flex-col gap-2">
            <h2 className="display text-xl">{h}</h2>
            <p className="leading-relaxed">{b}</p>
          </section>
        ))}
        <section id="delete-account" className="flex flex-col gap-2 scroll-mt-6">
          <h2 className="display text-xl">{t.deletion.title}</h2>
          <p className="leading-relaxed">{t.deletion.intro}</p>
          <ol className="list-decimal ps-5 flex flex-col gap-1 leading-relaxed">
            {t.deletion.steps.map((x) => <li key={x}>{x}</li>)}
          </ol>
          <p className="leading-relaxed">{t.deletion.what}</p>
        </section>
        <p className="text-paper-dim">{t.contact}</p>
        <p className="text-xs text-paper-dim">{t.updated}: {UPDATED}</p>
      </article>
    </main>
  );
}
