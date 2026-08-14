/** Lazily loaded Supabase client. Absent env keeps the app local-only. */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let clientPromise = null;

/** True when both cloud env vars are present at build time. */
export const isCloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Resolve the shared client, or null when cloud sync is unavailable. */
export const getSupabase = async () => {
  if (!isCloudConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      }))
      .catch(() => {
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
};
