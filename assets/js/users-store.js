// Data layer for users. Backed by Supabase (see supabase/schema.sql for the
// table + RLS policies, and assets/js/supabase-client.js for the connection).
// Nothing outside this file should talk to the Supabase client directly.
//
// Exposed as window.UsersStore (classic script, not an ES module) so the
// page works whether it's opened through a local server or double-clicked
// directly from the file system.
window.UsersStore = (function () {
  const SESSION_KEY = "norteagro.session";
  const TABLE = "users";

  function db() {
    return window.supabaseClient;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** Maps a DB row (snake_case) to the shape the UI expects (camelCase).
   * isAdmin comes straight from the generated `is_admin` column, so it can
   * never disagree with role the way a separately-set field could. */
  function mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isAdmin: row.is_admin,
      photo: row.photo,
      createdAt: formatDate(row.created_at),
    };
  }

  /** Loads every user from Supabase. Throws on failure — callers decide how
   * to surface the error (there's no local fallback anymore). */
  async function loadUsers() {
    const { data, error } = await db().from(TABLE).select("*").order("id", { ascending: true });
    if (error) throw error;
    return data.map(mapRow);
  }

  /** Inserts a new user and returns the created record, including the id
   * and createdAt assigned by the database. */
  async function createUser({ name, email, role, photo }) {
    const { data, error } = await db()
      .from(TABLE)
      .insert({ name, email, role, photo: photo || null })
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  /** Updates an existing user by id and returns the updated record. */
  async function updateUser(id, { name, email, role, photo }) {
    const { data, error } = await db()
      .from(TABLE)
      .update({ name, email, role, photo: photo || null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  /** Deletes a user by id. */
  async function deleteUser(id) {
    const { error } = await db().from(TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  /** Case-insensitive lookup by email, used to resolve the logged-in user.
   * Runs against an already-loaded list — no extra round trip to the DB. */
  function findUserByEmail(users, email) {
    const target = email.trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === target) || null;
  }

  /** Remembers who's logged in so a page refresh doesn't force a new login.
   * Still just localStorage — there's no real session/token yet (see
   * README, "Sem autenticação real"). */
  function saveSession(userId) {
    try {
      localStorage.setItem(SESSION_KEY, String(userId));
    } catch (e) {
      // localStorage unavailable — session just won't survive a reload
    }
  }

  /** Returns the remembered logged-in user id, or null if none/inaccessible. */
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? Number(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** Forgets the remembered session — used on explicit logout. */
  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // ignore
    }
  }

  return {
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    findUserByEmail,
    saveSession,
    loadSession,
    clearSession,
  };
})();
