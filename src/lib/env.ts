// Only public, browser-safe values live here. There is deliberately no service-role key
// anywhere in the web app: privileged operations run in the `admin-users` edge function.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};

export const isConfigured = () => !!publicEnv.supabaseUrl && !!publicEnv.supabaseAnonKey;
