/**
 * The owner's account: password sign-in, saved projects (rows in the
 * `patterns` table) and each project's MIDI file (the private `midi` bucket,
 * one folder per account). Every call resolves quietly when the cloud is
 * unconfigured or nobody is signed in; a failed request logs an error.
 */
import { getSupabase, isCloudConfigured } from './supabaseClient.js';

export { isCloudConfigured };

const TABLE = 'patterns';
const COLUMNS = 'id, name, data, created_at, updated_at';
const MIDI_BUCKET = 'midi';

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

// Resolves { supabase, session } only when signed in.
const signedIn = async () => {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const session = await readSession(supabase);
  return session ? { supabase, session } : null;
};

const midiPath = (session, id) => `${session.user.id}/${id}.mid`;

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

/** Sign in to the app's one account. Resolves { error } — never throws. */
export const signInWithPassword = async (email, password) => {
  const supabase = await getSupabase();
  if (!supabase) return { error: new Error('The account service is not configured.') };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ?? null };
};

export const signOut = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
};

/** Saved projects, newest first. Empty when unconfigured, signed out or failing. */
export const listCloudPatterns = async () => {
  const account = await signedIn();
  if (!account) return [];
  const { data, error } = await account.supabase
    .from(TABLE)
    .select(COLUMNS)
    .order('updated_at', { ascending: false });
  if (error || !Array.isArray(data)) {
    if (error) console.error('[vangelis] could not list saved projects', error);
    return [];
  }
  return data.map(toEntry);
};

/**
 * Insert without an id, update with one. A row that has gone (deleted on
 * another device) is saved again as a new row, so an edit is never lost.
 * Resolves the saved entry, or null when it could not be saved.
 */
export const upsertCloudPattern = async ({ id, name, pattern }) => {
  const account = await signedIn();
  if (!account) return null;
  const { supabase, session } = account;
  if (id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ name, data: pattern })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('[vangelis] could not save the project', error);
      return null;
    }
    if (data) return toEntry(data);
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: session.user.id, name, data: pattern })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    console.error('[vangelis] could not save the project', error);
    return null;
  }
  return toEntry(data);
};

/** Keep the project's .mid beside its row. True when stored. */
export const uploadPatternMidi = async (id, bytes) => {
  const account = await signedIn();
  if (!account || !id) return false;
  const { error } = await account.supabase.storage
    .from(MIDI_BUCKET)
    .upload(midiPath(account.session, id), new Blob([bytes], { type: 'audio/midi' }), {
      upsert: true,
      contentType: 'audio/midi'
    });
  if (error) {
    console.error('[vangelis] could not store the MIDI file', error);
    return false;
  }
  return true;
};

/** True when the row was deleted; its MIDI file goes with it. */
export const deleteCloudPattern = async (id) => {
  const account = await signedIn();
  if (!account || !id) return false;
  const { supabase, session } = account;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error('[vangelis] could not delete the project', error);
    return false;
  }
  const { error: fileError } = await supabase.storage.from(MIDI_BUCKET).remove([midiPath(session, id)]);
  if (fileError) console.error('[vangelis] could not delete the MIDI file', fileError);
  return true;
};
