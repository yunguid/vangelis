/** Cloud pattern library. Every call no-ops when unconfigured or signed out. */
import { getSupabase, isCloudConfigured } from './supabaseClient.js';

export { isCloudConfigured };

const TABLE = 'patterns';
const COLUMNS = 'id, name, data, created_at, updated_at';

const toEntry = (row) => ({
  id: row.id,
  name: row.name,
  pattern: row.data,
  updatedAt: row.updated_at ?? row.created_at ?? null
});

const readSession = async (supabase) => {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
};

/** The signed-in session, or null when signed out or unconfigured. */
export const getSession = async () => {
  const supabase = await getSupabase();
  if (!supabase) return null;
  return readSession(supabase);
};

/** Subscribe to sign-in/sign-out; returns an unsubscribe function. */
export const onAuthChange = (callback) => {
  let subscription = null;
  let active = true;
  getSupabase().then((supabase) => {
    if (!supabase || !active) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) callback(session ?? null);
    });
    subscription = data?.subscription ?? null;
  });
  return () => {
    active = false;
    subscription?.unsubscribe();
    subscription = null;
  };
};

/** Send a magic link. Resolves { error } — never throws. */
export const signInWithEmail = async (email) => {
  const supabase = await getSupabase();
  if (!supabase) return { error: new Error('Cloud sync is not configured.') };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
  return { error: error ?? null };
};

export const signOut = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
};

/** Saved patterns, newest first. Empty when unconfigured or signed out. */
export const listCloudPatterns = async () => {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const session = await readSession(supabase);
  if (!session) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order('updated_at', { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map(toEntry);
};

/** Insert without an id, update with one. Resolves the saved entry or null. */
export const upsertCloudPattern = async ({ id, name, pattern }) => {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const session = await readSession(supabase);
  if (!session) return null;
  const query = id
    ? supabase.from(TABLE).update({ name, data: pattern }).eq('id', id)
    : supabase.from(TABLE).insert({ user_id: session.user.id, name, data: pattern });
  const { data, error } = await query.select(COLUMNS).single();
  if (error || !data) return null;
  return toEntry(data);
};

/** True when the row was deleted. */
export const deleteCloudPattern = async (id) => {
  const supabase = await getSupabase();
  if (!supabase || !id) return false;
  const session = await readSession(supabase);
  if (!session) return false;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return !error;
};
