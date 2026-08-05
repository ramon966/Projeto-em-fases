// Data layer for the "Ponto" module (time-clock punches + per-employee work
// schedules). Backed by Supabase (see supabase/schema_ponto.sql). Mirrors
// the style of users-store.js — this is the only file that knows the
// work_schedules/time_punches tables.
window.PontoStore = (function () {
  const SCHEDULES_TABLE = "work_schedules";
  const PUNCHES_TABLE = "time_punches";

  // Ciclo de batidas do dia, nessa ordem fixa. O botão de bater o ponto
  // sempre pede a próxima da lista; depois de "saida" o ciclo só reinicia
  // num novo dia (ver nextPunchType).
  const PUNCH_CYCLE = ["entrada", "saida_almoco", "volta_almoco", "saida"];

  // Escala de fábrica: segunda a sexta (1-5 em ISO-8601: 1=segunda), 8h/dia
  // (5x2). Usada para qualquer colaborador que ainda não tenha uma linha em
  // work_schedules — não precisa de seed no banco, só esse fallback.
  const DEFAULT_SCHEDULE = { weekdays: [1, 2, 3, 4, 5], hoursPerDay: 8 };

  function db() {
    return window.supabaseClient;
  }

  function mapSchedule(row) {
    return { weekdays: row.weekdays.slice().sort((a, b) => a - b), hoursPerDay: Number(row.hours_per_day) };
  }

  function mapPunch(row) {
    return { id: row.id, type: row.type, punchedAt: row.punched_at };
  }

  /** Returns the schedule configured for a user, or the factory default if
   * the admin hasn't set one yet. */
  async function getSchedule(userId) {
    const { data, error } = await db().from(SCHEDULES_TABLE).select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? mapSchedule(data) : { ...DEFAULT_SCHEDULE };
  }

  /** Loads every configured schedule at once (for the admin panel), keyed by
   * user id. Users without a row simply won't be in the returned map —
   * callers should fall back to DEFAULT_SCHEDULE themselves. */
  async function getAllSchedules() {
    const { data, error } = await db().from(SCHEDULES_TABLE).select("*");
    if (error) throw error;
    const byUser = {};
    data.forEach((row) => {
      byUser[row.user_id] = mapSchedule(row);
    });
    return byUser;
  }

  /** Creates/updates the schedule for one user — an admin-only action in
   * the UI, but that's enforced by who gets shown the control, not by RLS
   * (see supabase/schema_ponto.sql for the current, wide-open policy). */
  async function saveSchedule(userId, { weekdays, hoursPerDay }) {
    const { error } = await db()
      .from(SCHEDULES_TABLE)
      .upsert({ user_id: userId, weekdays, hours_per_day: hoursPerDay, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  /** Most recent punch for a user, or null if they've never punched. */
  async function getLastPunch(userId) {
    const { data, error } = await db()
      .from(PUNCHES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("punched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPunch(data) : null;
  }

  /** All punches for a user from `since` (inclusive) onward, oldest first —
   * used to total up worked minutes for the current month. */
  async function getPunchesSince(userId, since) {
    const { data, error } = await db()
      .from(PUNCHES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .gte("punched_at", since.toISOString())
      .order("punched_at", { ascending: true });
    if (error) throw error;
    return data.map(mapPunch);
  }

  /** All punches for a user on one calendar day (local time), oldest
   * first — feeds the manual-correction UI (adding a forgotten punch,
   * fixing a wrong time, deleting a duplicate). */
  async function getPunchesForDay(userId, date) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const { data, error } = await db()
      .from(PUNCHES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .gte("punched_at", dayStart.toISOString())
      .lt("punched_at", dayEnd.toISOString())
      .order("punched_at", { ascending: true });
    if (error) throw error;
    return data.map(mapPunch);
  }

  /** Updates an existing punch's type and/or time — manual correction of a
   * mistaken entry (not exposed on the punch button itself). */
  async function updatePunch(id, { type, punchedAt }) {
    const { data, error } = await db()
      .from(PUNCHES_TABLE)
      .update({ type, punched_at: punchedAt })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapPunch(data);
  }

  /** Deletes a punch — manual correction of a duplicate/wrong entry. */
  async function deletePunch(id) {
    const { error } = await db().from(PUNCHES_TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  /** What the *next* punch should be, given the last one registered. Starts
   * a fresh "entrada" if there's no last punch, or if the last one was on a
   * previous day (a day that ended without a "saida" doesn't trap the next
   * one in the old cycle). */
  function nextPunchType(lastPunch) {
    if (!lastPunch) return PUNCH_CYCLE[0];
    const last = new Date(lastPunch.punchedAt);
    const now = new Date();
    const sameDay =
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate();
    if (!sameDay) return PUNCH_CYCLE[0];
    const idx = PUNCH_CYCLE.indexOf(lastPunch.type);
    return PUNCH_CYCLE[(idx + 1) % PUNCH_CYCLE.length];
  }

  /** Registers a punch of the given type. Defaults to "now" (the punch
   * button flow); the manual-correction UI passes an explicit punchedAt
   * (ISO string) to backfill a forgotten punch at the time it actually
   * happened, not the moment someone got around to typing it in. */
  async function registerPunch(userId, type, punchedAt) {
    const payload = { user_id: userId, type };
    if (punchedAt) payload.punched_at = punchedAt;
    const { data, error } = await db().from(PUNCHES_TABLE).insert(payload).select().single();
    if (error) throw error;
    return mapPunch(data);
  }

  /** Sums worked minutes from a list of punches (oldest first first), pairing
   * entrada→saida_almoco and volta_almoco→saida as worked intervals — the
   * lunch break itself doesn't count. If the day is still open (an odd
   * punch out with no closing match yet), it's counted up to "now" only
   * when that open punch is from today; a stale open punch left over from
   * a past day contributes nothing further (undercounting a forgotten
   * punch is safer than inventing hours for it). */
  function sumWorkedMinutes(punches) {
    let total = 0;
    let openAt = null;
    const now = new Date();

    for (const p of punches) {
      const at = new Date(p.punchedAt);
      if (p.type === "entrada" || p.type === "volta_almoco") {
        openAt = at;
      } else if ((p.type === "saida_almoco" || p.type === "saida") && openAt) {
        total += (at - openAt) / 60000;
        openAt = null;
      }
    }

    if (openAt) {
      const isToday =
        openAt.getFullYear() === now.getFullYear() &&
        openAt.getMonth() === now.getMonth() &&
        openAt.getDate() === now.getDate();
      if (isToday) total += (now - openAt) / 60000;
    }

    return Math.max(0, Math.round(total));
  }

  /** Expected worked minutes for every scheduled weekday from `since`
   * (inclusive) through today (inclusive) — i.e. the target for the month
   * so far, not the whole month ahead. */
  function expectedMinutes(schedule, since) {
    const now = new Date();
    const day = new Date(since.getFullYear(), since.getMonth(), since.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let workDays = 0;
    while (day <= today) {
      const iso = day.getDay() === 0 ? 7 : day.getDay(); // JS: 0=domingo..6=sábado → ISO: 1=segunda..7=domingo
      if (schedule.weekdays.includes(iso)) workDays++;
      day.setDate(day.getDate() + 1);
    }
    return Math.round(workDays * schedule.hoursPerDay * 60);
  }

  /** Formats a minute count (can be negative, for a debt) as "±Xh Ymin". */
  function formatMinutes(totalMinutes) {
    const sign = totalMinutes < 0 ? "-" : "";
    const abs = Math.abs(Math.round(totalMinutes));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${h}h ${String(m).padStart(2, "0")}min`;
  }

  return {
    DEFAULT_SCHEDULE,
    getSchedule,
    getAllSchedules,
    saveSchedule,
    getLastPunch,
    getPunchesSince,
    getPunchesForDay,
    updatePunch,
    deletePunch,
    nextPunchType,
    registerPunch,
    sumWorkedMinutes,
    expectedMinutes,
    formatMinutes,
  };
})();
