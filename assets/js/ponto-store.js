// Data layer for the "Ponto" module (time-clock punches + per-employee work
// schedules). Backed by Supabase (see supabase/schema_ponto.sql) for
// schedules/punches/corrections, and by window.CalendarData
// (assets/js/calendar-data.js — static, not the database) for holidays and
// birthdays. Mirrors the style of users-store.js — this is the only file
// that knows where each piece of ponto data actually comes from.
window.PontoStore = (function () {
  const SCHEDULES_TABLE = "work_schedules";
  const PUNCHES_TABLE = "time_punches";
  const CORRECTIONS_TABLE = "punch_corrections";

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

  /** All punches for a user within [start, end) (end exclusive), oldest
   * first — used by the admin's monthly spreadsheet, which needs a whole
   * range at once instead of day by day. */
  async function getPunchesForRange(userId, start, end) {
    const { data, error } = await db()
      .from(PUNCHES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .gte("punched_at", start.toISOString())
      .lt("punched_at", end.toISOString())
      .order("punched_at", { ascending: true });
    if (error) throw error;
    return data.map(mapPunch);
  }

  function mapCorrection(row) {
    return {
      id: row.id,
      userId: row.user_id,
      punchId: row.punch_id,
      action: row.action,
      punchType: row.punch_type,
      previousTime: row.previous_time,
      newTime: row.new_time,
      justification: row.justification,
      // Fallback pro banco ainda não ter rodado a migração em
      // supabase/schema_ponto_corrections.sql (coluna `status` inexistente
      // ainda vem undefined do Supabase) — trata como 'pendente', o mesmo
      // default que a coluna teria assim que a migração rodar.
      status: row.status || "pendente",
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      createdAt: row.created_at,
    };
  }

  /** Submits a correction *request* from a non-admin employee — nothing in
   * time_punches changes yet. It sits as 'pendente' until an admin approves
   * (applyCorrection actually touches time_punches then) or rejects it (see
   * below). Admin corrections (via the monthly spreadsheet) don't go
   * through here — they don't require approval. */
  async function addCorrection({ userId, punchId, action, punchType, previousTime, newTime, justification }) {
    const { error } = await db().from(CORRECTIONS_TABLE).insert({
      user_id: userId,
      punch_id: punchId || null,
      action,
      punch_type: punchType,
      previous_time: previousTime,
      new_time: newTime,
      justification,
    });
    if (error) throw error;
  }

  /** Correction requests, most recent first. Feeds the admin's
   * "Solicitações de correção" panel when called with no userId (every
   * request, any status), and the collaborator's own "minhas
   * solicitações" list when called with one (just their own). */
  async function getCorrections(userId) {
    let query = db().from(CORRECTIONS_TABLE).select("*").order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return data.map(mapCorrection);
  }

  async function markCorrectionReviewed(id, status, adminId) {
    const { error } = await db()
      .from(CORRECTIONS_TABLE)
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq("id", id);
    if (error) throw error;
  }

  /** Approves a pending request: actually applies it to time_punches (the
   * one moment a collaborator's correction takes effect), then marks the
   * request 'aprovada'. If the time_punches write fails, the request stays
   * 'pendente' — nothing is marked reviewed on a failed apply. */
  async function approveCorrection(correction, adminId) {
    if (correction.action === "adicionada") {
      await registerPunch(correction.userId, correction.punchType, correction.newTime);
    } else if (correction.action === "editada") {
      await updatePunch(correction.punchId, { type: correction.punchType, punchedAt: correction.newTime });
    } else if (correction.action === "excluida") {
      await deletePunch(correction.punchId);
    }
    await markCorrectionReviewed(correction.id, "aprovada", adminId);
  }

  /** Rejects a pending request — only marks the status, time_punches is
   * never touched. */
  async function rejectCorrection(id, adminId) {
    await markCorrectionReviewed(id, "rejeitada", adminId);
  }

  function dateOnlyStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Feriados/recesso e aniversários vêm de window.CalendarData
  // (assets/js/calendar-data.js) — dados estáticos fixos no front-end, não
  // numa tabela do Supabase (mudam raramente, não vale a pena depender de
  // rede/banco pra isso). Ainda assim expostos como funções — não como o
  // array direto — pra quem consome (app.js) não precisar saber que a fonte
  // mudou se um dia isso voltar a ser uma tabela.

  /** Holidays/recesso days within [start, end) (end exclusive), oldest
   * first — used to exclude non-working days from expectedMinutes. */
  function getHolidaysInRange(start, end) {
    const startStr = dateOnlyStr(start);
    const endStr = dateOnlyStr(end);
    return window.CalendarData.HOLIDAYS.filter((h) => h.date >= startStr && h.date < endStr).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
  }

  /** All holidays/recesso days in a calendar year — feeds the Calendário
   * page. */
  function getHolidaysForYear(year) {
    const prefix = String(year);
    return window.CalendarData.HOLIDAYS.filter((h) => h.date.startsWith(prefix)).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
  }

  /** Every team birthday (month/day only — no year, they repeat every
   * year). Purely informational for the Calendário page; never touches
   * expectedMinutes (that's holidays only). */
  function getBirthdays() {
    return window.CalendarData.BIRTHDAYS.slice().sort((a, b) => a.month - b.month || a.day - b.day);
  }

  /** What the *next* punch should be, given the last one registered — or
   * null if today's 4-punch cycle (entrada → saída almoço → volta almoço →
   * saída) is already complete, meaning no more punches are allowed until
   * tomorrow (a forgotten/wrong punch goes through a correction request
   * instead, not a 5th punch). Starts a fresh "entrada" if there's no last
   * punch, or if the last one was on a previous day (a day that ended
   * without a "saida" doesn't trap the next one in the old cycle). */
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
    if (idx === PUNCH_CYCLE.length - 1) return null;
    return PUNCH_CYCLE[idx + 1];
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
   * through `until` (both inclusive). `holidayDates` (a Set of
   * "YYYY-MM-DD" strings, optional) excludes feriados/recesso even when
   * they fall on a day the schedule would otherwise expect work. */
  function expectedMinutesInRange(schedule, since, until, holidayDates) {
    const holidays = holidayDates || new Set();
    const day = new Date(since.getFullYear(), since.getMonth(), since.getDate());
    const end = new Date(until.getFullYear(), until.getMonth(), until.getDate());
    let workDays = 0;
    while (day <= end) {
      const iso = day.getDay() === 0 ? 7 : day.getDay(); // JS: 0=domingo..6=sábado → ISO: 1=segunda..7=domingo
      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      if (schedule.weekdays.includes(iso) && !holidays.has(dateKey)) workDays++;
      day.setDate(day.getDate() + 1);
    }
    return Math.round(workDays * schedule.hoursPerDay * 60);
  }

  /** Expected worked minutes for every scheduled weekday from `since`
   * (inclusive) through today (inclusive) — i.e. the target for the month
   * so far, not the whole month ahead. Used for the hour bank (worked vs.
   * expected up to now). */
  function expectedMinutes(schedule, since, holidayDates) {
    return expectedMinutesInRange(schedule, since, new Date(), holidayDates);
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
    getPunchesForRange,
    updatePunch,
    deletePunch,
    addCorrection,
    getCorrections,
    approveCorrection,
    rejectCorrection,
    getHolidaysInRange,
    getHolidaysForYear,
    getBirthdays,
    nextPunchType,
    registerPunch,
    sumWorkedMinutes,
    expectedMinutes,
    expectedMinutesInRange,
    formatMinutes,
  };
})();
