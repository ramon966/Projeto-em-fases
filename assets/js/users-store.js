// Data layer for users. Backed by localStorage for now — this is the module
// to replace with real HTTP calls to a backend API when one exists. Nothing
// outside this file should touch localStorage or know the storage key.
//
// Exposed as window.UsersStore (classic script, not an ES module) so the
// page works whether it's opened through a local server or double-clicked
// directly from the file system.
window.UsersStore = (function () {
  // v3: role is now one of "Usuário" / "Admin" / "Estagiário" (a fixed set,
  // picked from a <select>) instead of free text, and isAdmin is derived
  // from role. Bumping the key so anyone with old v2 data gets a clean
  // reseed instead of records that don't match the new role options.
  const STORAGE_KEY = "norteagro.users.v3";
  const SESSION_KEY = "norteagro.session";

  const DEFAULT_USERS = [
    { name: "Administrador", email: "admin@norteagro.com.br", role: "Admin" },
    { name: "Equipe Técnica", email: "tecnica@norteagro.com.br", role: "Usuário" },
    { name: "Atendimento", email: "atendimento@norteagro.com.br", role: "Usuário" },
  ];

  let nextId = 1;

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function persist(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // localStorage unavailable (private mode, quota, etc.) — fail silently,
      // the in-memory list still works for the current session.
    }
  }

  /** Loads users from storage, seeding the default set on first run. */
  function loadUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        nextId = parsed.reduce((max, u) => Math.max(max, u.id), 0) + 1;
        return parsed;
      }
    } catch (e) {
      // corrupted or inaccessible storage — fall through to reseeding
    }
    const seeded = DEFAULT_USERS.map((u) => ({
      id: nextId++,
      name: u.name,
      email: u.email,
      role: u.role,
      isAdmin: u.role === "Admin",
      photo: null,
      createdAt: todayStr(),
    }));
    persist(seeded);
    return seeded;
  }

  /** Persists the full user list. */
  function saveUsers(list) {
    persist(list);
  }

  /**
   * Builds a new user record with a generated id and creation date.
   * isAdmin is derived from role ("Admin") rather than set independently,
   * so the two can never disagree.
   */
  function createUser({ name, email, role, photo }) {
    return {
      id: nextId++,
      name,
      email,
      role,
      isAdmin: role === "Admin",
      photo: photo || null,
      createdAt: todayStr(),
    };
  }

  /** Case-insensitive lookup by email, used to resolve the logged-in user. */
  function findUserByEmail(users, email) {
    const target = email.trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === target) || null;
  }

  /** Remembers who's logged in so a page refresh doesn't force a new login. */
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

  return { loadUsers, saveUsers, createUser, findUserByEmail, saveSession, loadSession, clearSession };
})();
