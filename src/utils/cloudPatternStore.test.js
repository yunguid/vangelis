import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabase } from './supabaseClient.js';
import {
  deleteCloudPattern,
  getSession,
  listCloudPatterns,
  onAuthChange,
  signInWithEmail,
  signOut,
  upsertCloudPattern
} from './cloudPatternStore.js';

vi.mock('./supabaseClient.js', () => ({
  getSupabase: vi.fn(),
  isCloudConfigured: vi.fn(() => false)
}));

const makeQuery = (result) => {
  const query = {
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    single: vi.fn(() => Promise.resolve(result))
  };
  ['select', 'insert', 'update', 'delete', 'eq', 'order'].forEach((method) => {
    query[method] = vi.fn(() => query);
  });
  return query;
};

const makeSupabase = ({
  session = { user: { id: 'user-1' } },
  result = { data: null, error: null }
} = {}) => {
  const query = makeQuery(result);
  const subscription = { unsubscribe: vi.fn() };
  return {
    query,
    subscription,
    from: vi.fn(() => query),
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription } })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null }))
    }
  };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const pattern = { bpm: 120, notes: [{ pitch: 60, start: 0, length: 1 }] };

describe('cloudPatternStore without cloud config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabase.mockResolvedValue(null);
  });

  it('resolves empty results instead of throwing', async () => {
    await expect(getSession()).resolves.toBeNull();
    await expect(listCloudPatterns()).resolves.toEqual([]);
    await expect(upsertCloudPattern({ name: 'Loop', pattern })).resolves.toBeNull();
    await expect(deleteCloudPattern('p1')).resolves.toBe(false);
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('reports a sign-in error without throwing', async () => {
    const { error } = await signInWithEmail('player@example.com');
    expect(error).toBeInstanceOf(Error);
  });

  it('returns a no-op unsubscribe from onAuthChange', async () => {
    const callback = vi.fn();
    const unsubscribe = onAuthChange(callback);
    await flush();
    expect(() => unsubscribe()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('cloudPatternStore when signed out', () => {
  let supabase;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = makeSupabase({ session: null });
    getSupabase.mockResolvedValue(supabase);
  });

  it('never queries the patterns table', async () => {
    await expect(listCloudPatterns()).resolves.toEqual([]);
    await expect(upsertCloudPattern({ name: 'Loop', pattern })).resolves.toBeNull();
    await expect(deleteCloudPattern('p1')).resolves.toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('cloudPatternStore when signed in', () => {
  const makeSignedIn = (result) => {
    const supabase = makeSupabase({ result });
    getSupabase.mockResolvedValue(supabase);
    return supabase;
  };

  beforeEach(() => vi.clearAllMocks());

  it('maps the data column onto the pattern field', async () => {
    const supabase = makeSignedIn({
      data: [
        { id: 'p1', name: 'Acid', data: pattern, created_at: 't0', updated_at: 't1' },
        { id: 'p2', name: 'Pad', data: pattern, created_at: 't2', updated_at: null }
      ],
      error: null
    });
    expect(await listCloudPatterns()).toEqual([
      { id: 'p1', name: 'Acid', pattern, updatedAt: 't1' },
      { id: 'p2', name: 'Pad', pattern, updatedAt: 't2' }
    ]);
    expect(supabase.from).toHaveBeenCalledWith('patterns');
    expect(supabase.query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('returns an empty list when the query fails', async () => {
    makeSignedIn({ data: null, error: { message: 'nope' } });
    expect(await listCloudPatterns()).toEqual([]);
  });

  it('inserts with the session user id when no id is given', async () => {
    const supabase = makeSignedIn({
      data: { id: 'p1', name: 'Loop', data: pattern, created_at: 't0', updated_at: 't0' },
      error: null
    });
    expect(await upsertCloudPattern({ name: 'Loop', pattern })).toEqual({
      id: 'p1',
      name: 'Loop',
      pattern,
      updatedAt: 't0'
    });
    expect(supabase.query.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'Loop',
      data: pattern
    });
    expect(supabase.query.update).not.toHaveBeenCalled();
  });

  it('updates only name and data when an id is given', async () => {
    const supabase = makeSignedIn({
      data: { id: 'p1', name: 'Loop v2', data: pattern, created_at: 't0', updated_at: 't1' },
      error: null
    });
    const saved = await upsertCloudPattern({ id: 'p1', name: 'Loop v2', pattern });
    expect(saved.updatedAt).toBe('t1');
    expect(supabase.query.update).toHaveBeenCalledWith({ name: 'Loop v2', data: pattern });
    expect(supabase.query.eq).toHaveBeenCalledWith('id', 'p1');
    expect(supabase.query.insert).not.toHaveBeenCalled();
  });

  it('returns null when the write fails', async () => {
    makeSignedIn({ data: null, error: { message: 'denied' } });
    expect(await upsertCloudPattern({ name: 'Loop', pattern })).toBeNull();
  });

  it('deletes by id', async () => {
    const supabase = makeSignedIn({ data: null, error: null });
    expect(await deleteCloudPattern('p1')).toBe(true);
    expect(supabase.query.delete).toHaveBeenCalled();
    expect(supabase.query.eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('reports a failed delete', async () => {
    makeSignedIn({ data: null, error: { message: 'denied' } });
    expect(await deleteCloudPattern('p1')).toBe(false);
  });

  it('reads the active session', async () => {
    makeSignedIn({ data: null, error: null });
    expect(await getSession()).toEqual({ user: { id: 'user-1' } });
  });

  it('sends a magic link back to the app origin', async () => {
    const supabase = makeSignedIn({ data: null, error: null });
    expect(await signInWithEmail('player@example.com')).toEqual({ error: null });
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      options: { emailRedirectTo: window.location.origin }
    });
  });

  it('stops forwarding auth changes after unsubscribe', async () => {
    const supabase = makeSignedIn({ data: null, error: null });
    const callback = vi.fn();
    const unsubscribe = onAuthChange(callback);
    await flush();
    const handler = supabase.auth.onAuthStateChange.mock.calls[0][0];
    handler('SIGNED_IN', { user: { id: 'user-1' } });
    expect(callback).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    unsubscribe();
    handler('SIGNED_OUT', null);
    expect(supabase.subscription.unsubscribe).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
