// UI wiring: view switching, the users grid/list, the create/edit modal,
// the login form, and the sidebar. Data access goes through window.UsersStore
// (assets/js/users-store.js) — this file never touches localStorage directly.
(function () {
  const { loadUsers, createUser, updateUser, deleteUser, findUserByEmail, saveSession, loadSession, clearSession } = window.UsersStore;
  const {
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
    getHolidaysInRange,
    getHolidaysForYear,
    getBirthdays,
    nextPunchType,
    registerPunch,
    sumWorkedMinutes,
    expectedMinutes,
    expectedMinutesInRange,
    formatMinutes,
  } = window.PontoStore;

  const PERSON_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  const UNKNOWN_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';

  // Populated asynchronously by init() once the Supabase fetch resolves —
  // everything that reads `users` before then only runs after init() awaits.
  let users = [];
  let currentUser = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /** "João Marcelo Angeli" -> "João M." (first name in full, second initialed, rest dropped). */
  function formatShortName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || "";
    return `${parts[0]} ${parts[1][0]}.`;
  }

  // --- topbar: logged-in user summary ---
  const topbarUser = document.getElementById("topbar-user");
  const topbarUserIcon = document.getElementById("topbar-user-icon");
  const topbarUserName = document.getElementById("topbar-user-name");
  const topbarUserEmail = document.getElementById("topbar-user-email");

  function renderTopbarUser() {
    if (!currentUser) {
      topbarUser.hidden = true;
      return;
    }
    topbarUserIcon.innerHTML = currentUser.photo ? `<img src="${currentUser.photo}" alt="" />` : PERSON_ICON;
    topbarUserName.textContent = formatShortName(currentUser.name);
    topbarUserEmail.textContent = currentUser.email;
    topbarUser.hidden = false;
  }
  topbarUser.addEventListener("click", () => {
    if (currentUser) openModal("edit", currentUser);
  });

  // --- view switching (login <-> users) ---
  const views = {
    login: document.getElementById("view-login"),
    users: document.getElementById("view-users"),
  };
  function showView(name) {
    Object.keys(views).forEach((key) => {
      const el = views[key];
      if (key === name) {
        el.hidden = false;
        el.classList.remove("anim");
        void el.offsetWidth; // restart the CSS animation
        el.classList.add("anim");
      } else {
        el.hidden = true;
      }
    });
  }

  // --- users grid/list ---
  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("search-input");

  function renderGrid() {
    const q = searchInput.value.trim().toLowerCase();
    const list = users.filter(
      (u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );

    grid.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent =
        users.length === 0
          ? "Nenhum usuário cadastrado ainda. Clique em “Adicionar usuário” para começar."
          : "Nenhum usuário encontrado para essa busca.";
      grid.appendChild(empty);
      return;
    }

    list.forEach((u) => {
      const isSelf = !!(currentUser && u.id === currentUser.id);
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("role", "listitem");
      card.innerHTML = `
        <div class="card-top">
          <span class="status-dot ${isSelf ? "ok" : "unknown"}" title="${isSelf ? "Sessão atual" : "Não logado"}">
            ${isSelf ? CHECK_ICON : UNKNOWN_ICON}
          </span>
        </div>
        <span class="avatar">${u.photo ? `<img src="${u.photo}" alt="" />` : PERSON_ICON}</span>
        <span class="card-name">${escapeHtml(u.name)}</span>
        <span class="card-email">${escapeHtml(u.email)}</span>
        <div class="card-meta">
          <div><b>Cargo:</b> ${escapeHtml(u.role || "Não definido")}</div>
          <div><b>Cadastrado em:</b> ${escapeHtml(u.createdAt)}</div>
        </div>
        <div class="card-actions">
          <button type="button" class="icon-btn" data-action="edit" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button type="button" class="icon-btn danger" data-action="delete" title="Excluir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;

      card.querySelector('[data-action="edit"]').addEventListener("click", () => openModal("edit", u));
      card.querySelector('[data-action="delete"]').addEventListener("click", () => openDeleteConfirm(u));
      grid.appendChild(card);
    });
  }

  searchInput.addEventListener("input", renderGrid);

  // --- delete confirmation modal ---
  const confirmOverlay = document.getElementById("confirm-overlay");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmCancel = document.getElementById("confirm-cancel");
  const confirmDeleteBtn = document.getElementById("confirm-delete");
  let pendingDeleteId = null;

  function openDeleteConfirm(u) {
    pendingDeleteId = u.id;
    confirmMessage.innerHTML = `Tem certeza que deseja excluir <b>${escapeHtml(u.name)}</b>? Essa ação não pode ser desfeita.`;
    confirmOverlay.hidden = false;
  }
  function closeDeleteConfirm() {
    confirmOverlay.hidden = true;
    pendingDeleteId = null;
  }
  confirmCancel.addEventListener("click", closeDeleteConfirm);
  confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) closeDeleteConfirm();
  });
  confirmDeleteBtn.addEventListener("click", async () => {
    const id = pendingDeleteId;
    confirmDeleteBtn.disabled = true;
    try {
      await deleteUser(id);
      users = users.filter((x) => x.id !== id);
      closeDeleteConfirm();
      renderGrid();
    } catch (err) {
      console.error("Falha ao excluir usuário:", err);
      alert("Não foi possível excluir o usuário. Tente novamente.");
    } finally {
      confirmDeleteBtn.disabled = false;
    }
  });

  // --- grid / list view toggle ---
  const VIEW_KEY = "norteagro.usersView";
  const viewToggle = document.getElementById("view-toggle");

  function setViewMode(mode) {
    grid.classList.toggle("is-list", mode === "list");
    viewToggle.setAttribute("data-mode", mode);
    const label = mode === "list" ? "Visualizar em grade" : "Visualizar em lista";
    viewToggle.setAttribute("title", label);
    viewToggle.setAttribute("aria-label", label);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch (e) {
      // ignore — view mode just won't persist across reloads
    }
  }
  setViewMode(localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid");
  viewToggle.addEventListener("click", () => {
    setViewMode(viewToggle.getAttribute("data-mode") === "list" ? "grid" : "list");
  });

  // --- create / edit modal ---
  const overlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const mName = document.getElementById("m-name");
  const mEmail = document.getElementById("m-email");
  const mRole = document.getElementById("m-role");
  const mPass = document.getElementById("m-pass");
  const mPassField = document.getElementById("m-pass-field");
  const mError = document.getElementById("m-error");
  const mSave = document.getElementById("m-save");
  const mPhotoInput = document.getElementById("m-photo");
  const mPhotoPreview = document.getElementById("m-photo-preview");
  const mPhotoUploadBadge = document.getElementById("m-photo-upload-badge");
  const mPhotoRemove = document.getElementById("m-photo-remove");

  let editingId = null;
  let chosenPhoto = null;
  const DEFAULT_PHOTO_PREVIEW = mPhotoPreview.innerHTML;

  function setPhotoPreview(dataUrl) {
    chosenPhoto = dataUrl;
    mPhotoPreview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="" />` : DEFAULT_PHOTO_PREVIEW;
    mPhotoUploadBadge.hidden = !!dataUrl;
    mPhotoRemove.hidden = !dataUrl;
  }

  mPhotoInput.addEventListener("change", () => {
    const file = mPhotoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  });
  mPhotoRemove.addEventListener("click", () => {
    mPhotoInput.value = "";
    setPhotoPreview(null);
  });
  mPhotoUploadBadge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      mPhotoInput.click();
    }
  });

  function openModal(mode, user) {
    editingId = mode === "edit" ? user.id : null;
    modalTitle.textContent = mode === "edit" ? "Editar usuário" : "Novo usuário";
    mPassField.style.display = mode === "edit" ? "none" : "";
    mSave.textContent = mode === "edit" ? "Salvar alterações" : "Cadastrar";
    mError.textContent = "";
    mName.value = mode === "edit" ? user.name : "";
    mEmail.value = mode === "edit" ? user.email : "";
    mRole.value = mode === "edit" ? user.role || "Usuário" : "Usuário";
    mPass.value = "";
    mPhotoInput.value = "";
    setPhotoPreview(mode === "edit" ? user.photo || null : null);
    overlay.hidden = false;
    mName.focus();
  }
  function closeModal() {
    overlay.hidden = true;
  }

  document.getElementById("open-create").addEventListener("click", () => openModal("create"));
  document.getElementById("m-cancel").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!overlay.hidden) closeModal();
    if (!confirmOverlay.hidden) closeDeleteConfirm();
    if (!scheduleOverlay.hidden) closeScheduleModal();
    if (!punchEditOverlay.hidden) closePunchEditModal();
    if (!punchSheetOverlay.hidden) closePunchSheetModal();
    if (!usersHistoryOverlay.hidden) closeUsersHistoryModal();
  });

  mSave.addEventListener("click", async () => {
    const name = mName.value.trim();
    const email = mEmail.value.trim();
    const role = mRole.value.trim();

    if (!name) {
      mError.textContent = "Informe o nome do usuário.";
      mName.focus();
      return;
    }
    if (!email) {
      mError.textContent = "Informe o e-mail do usuário.";
      mEmail.focus();
      return;
    }
    if (editingId === null && mPass.value.length < 4) {
      mError.textContent = "A senha deve ter ao menos 4 caracteres.";
      mPass.focus();
      return;
    }

    mError.textContent = "";
    mSave.disabled = true;
    try {
      if (editingId === null) {
        const created = await createUser({ name, email, role, photo: chosenPhoto });
        users.push(created);
      } else {
        const updated = await updateUser(editingId, { name, email, role, photo: chosenPhoto });
        const idx = users.findIndex((x) => x.id === editingId);
        if (idx !== -1) users[idx] = updated;
        if (currentUser && currentUser.id === editingId) currentUser = updated;
      }
      closeModal();
      renderGrid();
      applyPermissions();
    } catch (err) {
      console.error("Falha ao salvar usuário:", err);
      mError.textContent = "Não foi possível salvar. Verifique a conexão ou se o e-mail já está cadastrado.";
    } finally {
      mSave.disabled = false;
    }
  });

  // --- login form ---
  const loginUser = document.getElementById("login-user");
  const loginPass = document.getElementById("login-pass");
  const loginError = document.getElementById("login-error");
  const loginSubmit = document.getElementById("login-submit");
  const openCreateBtn = document.getElementById("open-create");

  function applyPermissions() {
    openCreateBtn.hidden = !(currentUser && currentUser.isAdmin);
    const isAdmin = !!(currentUser && currentUser.isAdmin);
    // Defensive default: the Ponto page itself repopulates these panels with
    // renderScheduleList()/renderCorrectionsList() when visited, but this
    // keeps the wrong card from flashing after logout/login as a different
    // user. Admin doesn't punch a clock — só gerencia — so the personal
    // card and the admin stack are always mutually exclusive.
    document.getElementById("ponto-personal-card").hidden = isAdmin;
    document.getElementById("ponto-admin-stack").hidden = !isAdmin;
    renderTopbarUser();
  }

  function doLogin() {
    if (!loginUser.value.trim()) {
      loginError.textContent = "Informe o usuário.";
      loginUser.focus();
      return;
    }
    if (!loginPass.value) {
      loginError.textContent = "Informe a senha.";
      loginPass.focus();
      return;
    }
    loginError.textContent = "";
    const original = loginSubmit.innerHTML;
    loginSubmit.disabled = true;
    loginSubmit.innerHTML =
      '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Entrando…';

    // No real backend yet — any non-empty credentials are accepted. The email
    // is matched against the seeded/registered users purely to resolve which
    // account is "logged in" (and therefore whether it's an admin).
    setTimeout(() => {
      loginSubmit.disabled = false;
      loginSubmit.innerHTML = original;
      currentUser = findUserByEmail(users, loginUser.value);
      if (currentUser) saveSession(currentUser.id);
      applyPermissions();
      renderGrid();
      showView("users");
    }, 550);
  }
  loginSubmit.addEventListener("click", doLogin);
  loginPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
  loginUser.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginPass.focus();
  });

  function resetToLogin() {
    currentUser = null;
    clearSession();
    applyPermissions();
    loginUser.value = "";
    loginPass.value = "";
    loginError.textContent = "";
    showView("login");
    loginUser.focus();
  }
  document.getElementById("logout-link").addEventListener("click", resetToLogin);

  // --- sidebar collapse ---
  const SIDEBAR_KEY = "norteagro.sidebar.collapsed";
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarLogoToggle = document.getElementById("sidebar-logo-toggle");

  function setSidebarCollapsed(collapsed) {
    sidebar.classList.toggle("collapsed", collapsed);
    const label = collapsed ? "Expandir menu" : "Recolher menu";
    sidebarToggle.setAttribute("aria-label", label);
    sidebarToggle.setAttribute("title", label);
    sidebarToggle.querySelector(".action-label").textContent = label;
    sidebarLogoToggle.setAttribute("aria-label", label);
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch (e) {
      // ignore — collapsed state just won't persist across reloads
    }
  }
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  function toggleSidebar() {
    setSidebarCollapsed(!sidebar.classList.contains("collapsed"));
  }
  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarLogoToggle.addEventListener("click", toggleSidebar);

  // --- sidebar nav selection: switches which page is shown ---
  const sidebarNavItems = document.querySelectorAll(".sidebar-nav-item");
  const pages = {
    usuarios: document.getElementById("page-usuarios"),
    dashboard: document.getElementById("page-dashboard"),
    ponto: document.getElementById("page-ponto"),
    calendario: document.getElementById("page-calendario"),
  };
  function showPage(name) {
    Object.keys(pages).forEach((key) => {
      pages[key].hidden = key !== name;
    });
  }
  sidebarNavItems.forEach((item) => {
    item.addEventListener("click", () => {
      sidebarNavItems.forEach((other) => {
        other.classList.toggle("active", other === item);
        if (other === item) other.setAttribute("aria-current", "page");
        else other.removeAttribute("aria-current");
      });
      showPage(item.dataset.nav);
      if (item.dataset.nav === "ponto") {
        if (currentUser && currentUser.isAdmin) {
          renderScheduleList();
          renderCorrectionsList();
        } else {
          refreshPontoSummary();
        }
      }
      if (item.dataset.nav === "calendario") {
        renderCalendarPage();
      }
    });
  });

  // --- ponto (time clock) ---
  const pontoPunchBtn = document.getElementById("ponto-punch-btn");
  const pontoPunchLabel = document.getElementById("ponto-punch-label");
  const pontoPunchError = document.getElementById("ponto-punch-error");
  const pontoLastPunchEl = document.getElementById("ponto-last-punch");
  const pontoWorkedHoursEl = document.getElementById("ponto-worked-hours");
  const pontoHourBankEl = document.getElementById("ponto-hour-bank");
  const pontoScheduleList = document.getElementById("ponto-schedule-list");
  const pontoCorrectionsList = document.getElementById("ponto-corrections-list");

  const PUNCH_TYPES = ["entrada", "saida_almoco", "volta_almoco", "saida"];
  const PUNCH_LABELS = {
    entrada: "Bater entrada",
    saida_almoco: "Bater saída (almoço)",
    volta_almoco: "Bater volta (almoço)",
    saida: "Bater saída",
  };
  const PUNCH_PAST_LABELS = {
    entrada: "Entrada",
    saida_almoco: "Saída (almoço)",
    volta_almoco: "Volta (almoço)",
    saida: "Saída",
  };
  const WEEKDAY_LABELS = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom" };

  function formatDateTime(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  let pontoLastPunchData = null;

  /** Refreshes the current user's punch button label, last punch and
   * month-to-date hour totals. Called on entering the Ponto page and after
   * every punch/schedule change that affects this user. */
  async function refreshPontoSummary() {
    if (!currentUser) return;
    pontoPunchError.textContent = "";
    try {
      pontoLastPunchData = await getLastPunch(currentUser.id);
      const next = nextPunchType(pontoLastPunchData);
      pontoPunchLabel.textContent = PUNCH_LABELS[next];
      pontoLastPunchEl.textContent = pontoLastPunchData
        ? `${PUNCH_PAST_LABELS[pontoLastPunchData.type]} às ${formatDateTime(pontoLastPunchData.punchedAt)}`
        : "Nenhuma batida ainda";

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const [schedule, punches, holidays] = await Promise.all([
        getSchedule(currentUser.id),
        getPunchesSince(currentUser.id, monthStart),
        getHolidaysInRange(monthStart, tomorrow),
      ]);
      const holidayDates = new Set(holidays.map((h) => h.date));
      const workedMinutes = sumWorkedMinutes(punches);
      const expected = expectedMinutes(schedule, monthStart, holidayDates);
      const balance = workedMinutes - expected;

      pontoWorkedHoursEl.textContent = `${formatMinutes(workedMinutes)} de ${formatMinutes(expected)}`;
      pontoHourBankEl.textContent = (balance >= 0 ? "+" : "") + formatMinutes(balance);
      pontoHourBankEl.classList.toggle("positive", balance >= 0);
      pontoHourBankEl.classList.toggle("negative", balance < 0);
    } catch (err) {
      console.error("Falha ao carregar dados de ponto:", err);
      pontoPunchError.textContent = "Não foi possível carregar os dados de ponto.";
    }
  }

  pontoPunchBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    pontoPunchBtn.disabled = true;
    pontoPunchError.textContent = "";
    try {
      const type = nextPunchType(pontoLastPunchData);
      await registerPunch(currentUser.id, type);
      await refreshPontoSummary();
    } catch (err) {
      console.error("Falha ao bater o ponto:", err);
      pontoPunchError.textContent = "Não foi possível registrar o ponto. Tente novamente.";
    } finally {
      pontoPunchBtn.disabled = false;
    }
  });

  // --- ponto: painel do admin para configurar o horário de cada colaborador ---
  const scheduleOverlay = document.getElementById("schedule-overlay");
  const scheduleModalTitle = document.getElementById("schedule-modal-title");
  const scheduleWeekdaysEl = document.getElementById("schedule-weekdays");
  const scheduleHoursInput = document.getElementById("schedule-hours");
  const scheduleError = document.getElementById("schedule-error");
  const scheduleSaveBtn = document.getElementById("schedule-save");
  const scheduleCancelBtn = document.getElementById("schedule-cancel");
  const weekdayChips = scheduleWeekdaysEl.querySelectorAll(".weekday-chip");

  let scheduleEditingUser = null;
  let scheduleSelectedDays = [];

  /** Renders the admin-only list of employees + their configured schedule.
   * A no-op for non-admins — applyPermissions() already keeps the whole
   * admin stack hidden for them. */
  async function renderScheduleList() {
    if (!currentUser || !currentUser.isAdmin) return;
    pontoScheduleList.innerHTML = '<p class="empty">Carregando…</p>';
    try {
      const schedules = await getAllSchedules();
      if (users.length === 0) {
        pontoScheduleList.innerHTML = '<p class="empty">Nenhum colaborador cadastrado.</p>';
        return;
      }
      // Tabela de verdade — nome, dias e horas em colunas separadas, em vez
      // de tudo resumido numa frase só (era difícil de escanear com vários
      // colaboradores).
      pontoScheduleList.innerHTML = `
        <div class="schedule-table-scroll">
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Dias da semana</th>
                <th>Horas/dia</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="ponto-schedule-tbody"></tbody>
          </table>
        </div>`;
      const tbody = document.getElementById("ponto-schedule-tbody");
      users.forEach((u) => {
        const schedule = schedules[u.id] || window.PontoStore.DEFAULT_SCHEDULE;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="schedule-table-name">${escapeHtml(u.name)}</td>
          <td>${escapeHtml(schedule.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", "))}</td>
          <td>${schedule.hoursPerDay}h</td>
          <td>
            <div class="schedule-table-actions">
              <button type="button" class="icon-btn" data-action="edit-punch" title="Corrigir ponto" aria-label="Corrigir ponto de ${escapeHtml(u.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>
              <button type="button" class="icon-btn" data-action="edit-schedule" title="Configurar horário" aria-label="Configurar horário de ${escapeHtml(u.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
              </button>
            </div>
          </td>`;
        row.querySelector('[data-action="edit-schedule"]').addEventListener("click", () => openScheduleModal(u, schedule));
        row.querySelector('[data-action="edit-punch"]').addEventListener("click", () => openPunchSheetModal(u));
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error("Falha ao carregar horários:", err);
      pontoScheduleList.innerHTML = '<p class="empty">Não foi possível carregar os horários.</p>';
    }
  }

  function openScheduleModal(user, schedule) {
    scheduleEditingUser = user;
    scheduleSelectedDays = schedule.weekdays.slice();
    scheduleModalTitle.textContent = `Horário de ${user.name}`;
    scheduleHoursInput.value = schedule.hoursPerDay;
    scheduleError.textContent = "";
    weekdayChips.forEach((chip) => {
      chip.classList.toggle("active", scheduleSelectedDays.includes(Number(chip.dataset.day)));
    });
    scheduleOverlay.hidden = false;
  }
  function closeScheduleModal() {
    scheduleOverlay.hidden = true;
    scheduleEditingUser = null;
  }

  weekdayChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const day = Number(chip.dataset.day);
      scheduleSelectedDays = scheduleSelectedDays.includes(day)
        ? scheduleSelectedDays.filter((d) => d !== day)
        : [...scheduleSelectedDays, day];
      chip.classList.toggle("active", scheduleSelectedDays.includes(day));
    });
  });
  scheduleCancelBtn.addEventListener("click", closeScheduleModal);
  scheduleOverlay.addEventListener("click", (e) => {
    if (e.target === scheduleOverlay) closeScheduleModal();
  });

  scheduleSaveBtn.addEventListener("click", async () => {
    if (scheduleSelectedDays.length === 0) {
      scheduleError.textContent = "Selecione ao menos um dia da semana.";
      return;
    }
    const hours = Number(scheduleHoursInput.value);
    if (!hours || hours <= 0 || hours > 24) {
      scheduleError.textContent = "Informe uma quantidade de horas válida.";
      return;
    }
    scheduleError.textContent = "";
    scheduleSaveBtn.disabled = true;
    try {
      const weekdays = scheduleSelectedDays.slice().sort((a, b) => a - b);
      await saveSchedule(scheduleEditingUser.id, { weekdays, hoursPerDay: hours });
      const editedUserId = scheduleEditingUser.id;
      closeScheduleModal();
      await renderScheduleList();
      if (currentUser && currentUser.id === editedUserId) await refreshPontoSummary();
    } catch (err) {
      console.error("Falha ao salvar horário:", err);
      scheduleError.textContent = "Não foi possível salvar. Tente novamente.";
    } finally {
      scheduleSaveBtn.disabled = false;
    }
  });

  // --- ponto: correção manual do PRÓPRIO ponto (colaborador comum). Exige
  // justificativa — o admin corrige qualquer um sem justificativa, pela
  // planilha mensal (seção seguinte), então esse modal só existe pra quem
  // não é admin corrigir a si mesmo. ---
  const pontoCorrectBtn = document.getElementById("ponto-correct-btn");
  const punchEditOverlay = document.getElementById("punch-edit-overlay");
  const punchEditDateInput = document.getElementById("punch-edit-date");
  const punchEditList = document.getElementById("punch-edit-list");
  const punchAddType = document.getElementById("punch-add-type");
  const punchAddTime = document.getElementById("punch-add-time");
  const punchAddBtn = document.getElementById("punch-add-btn");
  const punchEditJustification = document.getElementById("punch-edit-justification");
  const punchEditError = document.getElementById("punch-edit-error");
  const punchEditCloseBtn = document.getElementById("punch-edit-close");

  function todayInputValue() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function toTimeInputValue(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  /** Builds an ISO timestamp from a date (YYYY-MM-DD) and a time (HH:MM)
   * read as local time — matches how punches are displayed everywhere
   * else in the UI. */
  function combineDateAndTime(dateStr, timeStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  }

  /** Reads and validates the shared justification field. Returns the
   * trimmed text, or null (with an error message shown) if it's empty. */
  function requireJustification() {
    const text = punchEditJustification.value.trim();
    if (!text) {
      punchEditError.textContent = "Escreva uma justificativa antes de salvar.";
      return null;
    }
    return text;
  }

  function openPunchEditModal() {
    if (!currentUser) return;
    punchEditError.textContent = "";
    punchEditJustification.value = "";
    punchEditDateInput.value = todayInputValue();
    punchAddType.value = "entrada";
    punchAddTime.value = "";
    punchEditOverlay.hidden = false;
    renderPunchEditList();
  }
  function closePunchEditModal() {
    punchEditOverlay.hidden = true;
  }

  /** Loads and renders the current user's punches for the selected date. */
  async function renderPunchEditList() {
    punchEditList.innerHTML = '<p class="empty">Carregando…</p>';
    try {
      const [y, m, d] = punchEditDateInput.value.split("-").map(Number);
      const punches = await getPunchesForDay(currentUser.id, new Date(y, m - 1, d));
      if (punches.length === 0) {
        punchEditList.innerHTML = '<p class="empty">Nenhuma batida nesse dia.</p>';
        return;
      }
      punchEditList.innerHTML = "";
      punches.forEach((p) => {
        const row = document.createElement("div");
        row.className = "punch-edit-row";
        row.dataset.id = p.id;
        row.innerHTML = `
          <select class="punch-row-type">
            <option value="entrada">Entrada</option>
            <option value="saida_almoco">Saída (almoço)</option>
            <option value="volta_almoco">Volta (almoço)</option>
            <option value="saida">Saída</option>
          </select>
          <input type="time" class="punch-row-time" value="${toTimeInputValue(p.punchedAt)}" />
          <button type="button" class="icon-btn" data-action="save" title="Salvar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
          <button type="button" class="icon-btn danger" data-action="delete" title="Excluir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>`;
        row.querySelector(".punch-row-type").value = p.type;
        row.querySelector('[data-action="save"]').addEventListener("click", () => savePunchRow(row, p));
        row.querySelector('[data-action="delete"]').addEventListener("click", () => deletePunchRow(row, p));
        punchEditList.appendChild(row);
      });
    } catch (err) {
      console.error("Falha ao carregar batidas do dia:", err);
      punchEditList.innerHTML = '<p class="empty">Não foi possível carregar as batidas.</p>';
    }
  }

  /** Reloads the day's list and refreshes the punch button/hour bank. */
  async function afterPunchEditChange() {
    await renderPunchEditList();
    await refreshPontoSummary();
  }

  async function savePunchRow(row, punch) {
    const type = row.querySelector(".punch-row-type").value;
    const time = row.querySelector(".punch-row-time").value;
    if (!time) {
      punchEditError.textContent = "Informe um horário válido.";
      return;
    }
    const justification = requireJustification();
    if (!justification) return;
    punchEditError.textContent = "";
    try {
      const punchedAt = combineDateAndTime(punchEditDateInput.value, time);
      await updatePunch(punch.id, { type, punchedAt });
      await addCorrection({
        userId: currentUser.id,
        action: "editada",
        punchType: type,
        previousTime: punch.punchedAt,
        newTime: punchedAt,
        justification,
      });
      await afterPunchEditChange();
    } catch (err) {
      console.error("Falha ao salvar batida:", err);
      punchEditError.textContent = "Não foi possível salvar essa batida.";
    }
  }

  async function deletePunchRow(row, punch) {
    const justification = requireJustification();
    if (!justification) return;
    // Um confirm() nativo é suficiente aqui — é uma correção pontual dentro
    // de um modal que já exige justificativa escrita; não parece justificar
    // mais um modal de confirmação aninhado igual ao de exclusão de usuário.
    if (!confirm("Excluir essa batida? Essa ação não pode ser desfeita.")) return;
    punchEditError.textContent = "";
    try {
      await deletePunch(punch.id);
      await addCorrection({
        userId: currentUser.id,
        action: "excluida",
        punchType: punch.type,
        previousTime: punch.punchedAt,
        newTime: null,
        justification,
      });
      await afterPunchEditChange();
    } catch (err) {
      console.error("Falha ao excluir batida:", err);
      punchEditError.textContent = "Não foi possível excluir essa batida.";
    }
  }

  pontoCorrectBtn.addEventListener("click", openPunchEditModal);
  punchEditDateInput.addEventListener("change", renderPunchEditList);
  punchAddBtn.addEventListener("click", async () => {
    const time = punchAddTime.value;
    if (!time) {
      punchEditError.textContent = "Informe um horário para a nova batida.";
      return;
    }
    const justification = requireJustification();
    if (!justification) return;
    punchEditError.textContent = "";
    punchAddBtn.disabled = true;
    try {
      const punchedAt = combineDateAndTime(punchEditDateInput.value, time);
      await registerPunch(currentUser.id, punchAddType.value, punchedAt);
      await addCorrection({
        userId: currentUser.id,
        action: "adicionada",
        punchType: punchAddType.value,
        previousTime: null,
        newTime: punchedAt,
        justification,
      });
      punchAddTime.value = "";
      await afterPunchEditChange();
    } catch (err) {
      console.error("Falha ao adicionar batida:", err);
      punchEditError.textContent = "Não foi possível adicionar essa batida.";
    } finally {
      punchAddBtn.disabled = false;
    }
  });
  punchEditCloseBtn.addEventListener("click", closePunchEditModal);
  punchEditOverlay.addEventListener("click", (e) => {
    if (e.target === punchEditOverlay) closePunchEditModal();
  });

  // --- ponto: justificativas recebidas (admin) — lista tudo que os
  // colaboradores registraram ao corrigir o próprio ponto. ---
  const ACTION_LABELS = { adicionada: "Adicionou", editada: "Editou", excluida: "Excluiu" };

  function formatCorrectionChange(c) {
    const typeLabel = PUNCH_PAST_LABELS[c.punchType];
    if (c.action === "adicionada") return `${typeLabel} às ${formatDateTime(c.newTime)}`;
    if (c.action === "excluida") return `${typeLabel} que estava às ${formatDateTime(c.previousTime)}`;
    return `${typeLabel}: ${formatDateTime(c.previousTime)} → ${formatDateTime(c.newTime)}`;
  }

  /** Renders every self-correction justification, most recent first. A
   * no-op for non-admins — applyPermissions() keeps the panel hidden. */
  async function renderCorrectionsList() {
    if (!currentUser || !currentUser.isAdmin) return;
    pontoCorrectionsList.innerHTML = '<p class="empty">Carregando…</p>';
    try {
      const corrections = await getCorrections();
      if (corrections.length === 0) {
        pontoCorrectionsList.innerHTML = '<p class="empty">Nenhuma justificativa enviada ainda.</p>';
        return;
      }
      pontoCorrectionsList.innerHTML = "";
      corrections.forEach((c) => {
        const user = users.find((u) => u.id === c.userId);
        const row = document.createElement("div");
        row.className = "ponto-correction-row";
        row.innerHTML = `
          <div class="ponto-correction-head">
            <span class="ponto-correction-user">${escapeHtml(user ? user.name : "Ex-colaborador")}</span>
            <span class="ponto-correction-when">${formatDateTime(c.createdAt)}</span>
          </div>
          <div class="ponto-correction-change">${escapeHtml(`${ACTION_LABELS[c.action]} ${formatCorrectionChange(c)}`)}</div>
          <div class="ponto-correction-text">"${escapeHtml(c.justification)}"</div>`;
        pontoCorrectionsList.appendChild(row);
      });
    } catch (err) {
      console.error("Falha ao carregar justificativas:", err);
      pontoCorrectionsList.innerHTML = '<p class="empty">Não foi possível carregar as justificativas.</p>';
    }
  }

  // --- ponto: planilha mensal (admin) — corrige qualquer colaborador sem
  // justificativa, um mês inteiro de cada vez, seguindo o calendário
  // corrente de verdade (28-31 dias conforme o mês/ano). ---
  const punchSheetOverlay = document.getElementById("punch-sheet-overlay");
  const punchSheetTitle = document.getElementById("punch-sheet-title");
  const punchSheetBody = document.getElementById("punch-sheet-body");
  const punchSheetError = document.getElementById("punch-sheet-error");
  const punchSheetPrevBtn = document.getElementById("punch-sheet-prev");
  const punchSheetNextBtn = document.getElementById("punch-sheet-next");
  const punchSheetCloseBtn = document.getElementById("punch-sheet-close");

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  // Domingo primeiro, igual ao calendário usado no Brasil; casa com
  // Date#getDay() (0 = domingo ... 6 = sábado).
  const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  let sheetTargetUser = null;
  let sheetYear = null;
  let sheetMonth = null; // 0-based, convenção do JS Date

  function openPunchSheetModal(user) {
    sheetTargetUser = user;
    const now = new Date();
    sheetYear = now.getFullYear();
    sheetMonth = now.getMonth();
    punchSheetError.textContent = "";
    punchSheetOverlay.hidden = false;
    renderPunchSheet();
  }
  function closePunchSheetModal() {
    punchSheetOverlay.hidden = true;
    sheetTargetUser = null;
  }
  function changeSheetMonth(delta) {
    const d = new Date(sheetYear, sheetMonth + delta, 1);
    sheetYear = d.getFullYear();
    sheetMonth = d.getMonth();
    renderPunchSheet();
  }

  /** Renders one row per day of the selected month, using the real number
   * of days for that month/year (28-31) — the same Gregorian calendar used
   * in Brazil, not a fixed 30-day approximation. */
  async function renderPunchSheet() {
    punchSheetTitle.textContent = `${sheetTargetUser.name} — ${MONTH_NAMES[sheetMonth]} de ${sheetYear}`;
    punchSheetError.textContent = "";
    punchSheetBody.innerHTML = '<tr><td colspan="8" class="empty">Carregando…</td></tr>';
    try {
      const monthStart = new Date(sheetYear, sheetMonth, 1);
      const monthEnd = new Date(sheetYear, sheetMonth + 1, 1); // exclusivo
      const totalDays = new Date(sheetYear, sheetMonth + 1, 0).getDate();

      const [schedule, punches, holidays] = await Promise.all([
        getSchedule(sheetTargetUser.id),
        getPunchesForRange(sheetTargetUser.id, monthStart, monthEnd),
        getHolidaysInRange(monthStart, monthEnd),
      ]);
      const holidayByDate = {};
      holidays.forEach((h) => {
        holidayByDate[h.date] = h;
      });

      // Agrupa as batidas por dia e por tipo. Assume no máximo uma batida
      // de cada tipo por dia — se sobrar uma duplicata de dados antigos,
      // esta grade só edita a primeira encontrada e ignora o resto (não é
      // o uso normal, é só pra não travar a UI numa inconsistência rara).
      const byDay = {};
      punches.forEach((p) => {
        const d = new Date(p.punchedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!byDay[key]) byDay[key] = {};
        if (!byDay[key][p.type]) byDay[key][p.type] = p;
      });

      punchSheetBody.innerHTML = "";
      const today = new Date();
      for (let day = 1; day <= totalDays; day++) {
        const date = new Date(sheetYear, sheetMonth, day);
        const key = `${sheetYear}-${String(sheetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayPunches = byDay[key] || {};
        const holiday = holidayByDate[key];
        const iso = date.getDay() === 0 ? 7 : date.getDay();
        const isWorkingDay = schedule.weekdays.includes(iso) && !holiday;
        const worked = sumWorkedMinutes(
          Object.values(dayPunches).sort((a, b) => new Date(a.punchedAt) - new Date(b.punchedAt))
        );
        const expected = isWorkingDay ? Math.round(schedule.hoursPerDay * 60) : 0;
        const diff = worked - expected;
        const isToday = date.toDateString() === today.toDateString();

        const row = document.createElement("tr");
        row.className =
          "punch-sheet-row" + (isWorkingDay ? "" : " off-day") + (isToday ? " today" : "") + (holiday ? " holiday" : "");
        row.innerHTML = `
          <td class="punch-sheet-day"${holiday ? ` title="${escapeHtml(holiday.name)}"` : ""}>${WEEKDAY_SHORT[date.getDay()]} ${String(day).padStart(2, "0")}${holiday ? " 🔸" : ""}</td>
          ${PUNCH_TYPES.map(
            (type) =>
              `<td><input type="time" class="punch-sheet-time" data-type="${type}" value="${dayPunches[type] ? toTimeInputValue(dayPunches[type].punchedAt) : ""}" /></td>`
          ).join("")}
          <td class="punch-sheet-total">${formatMinutes(worked)}</td>
          <td class="punch-sheet-expected">${isWorkingDay ? formatMinutes(expected) : "—"}</td>
          <td class="punch-sheet-diff ${diff >= 0 ? "positive" : "negative"}">${isWorkingDay ? (diff >= 0 ? "+" : "") + formatMinutes(diff) : "—"}</td>
        `;
        row.querySelectorAll(".punch-sheet-time").forEach((input) => {
          input.addEventListener("change", () => handleSheetCellChange(date, input, dayPunches));
        });
        punchSheetBody.appendChild(row);
      }
    } catch (err) {
      console.error("Falha ao carregar planilha de ponto:", err);
      punchSheetBody.innerHTML = '<tr><td colspan="8" class="empty">Não foi possível carregar a planilha.</td></tr>';
    }
  }

  /** Applies one cell edit (create/update/delete depending on the previous
   * and new values) then reloads the whole sheet to keep totals correct. */
  async function handleSheetCellChange(date, input, dayPunchesBeforeEdit) {
    const type = input.dataset.type;
    const time = input.value;
    const existing = dayPunchesBeforeEdit[type];
    input.disabled = true;
    punchSheetError.textContent = "";
    try {
      if (!time) {
        if (existing) await deletePunch(existing.id);
      } else {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const punchedAt = combineDateAndTime(dateStr, time);
        if (existing) {
          await updatePunch(existing.id, { type, punchedAt });
        } else {
          await registerPunch(sheetTargetUser.id, type, punchedAt);
        }
      }
      await renderPunchSheet();
      if (currentUser && sheetTargetUser.id === currentUser.id) await refreshPontoSummary();
    } catch (err) {
      console.error("Falha ao salvar célula da planilha:", err);
      punchSheetError.textContent = "Não foi possível salvar essa alteração.";
      await renderPunchSheet(); // desfaz visualmente, recarregando os dados reais
    }
  }

  punchSheetPrevBtn.addEventListener("click", () => changeSheetMonth(-1));
  punchSheetNextBtn.addEventListener("click", () => changeSheetMonth(1));
  punchSheetCloseBtn.addEventListener("click", closePunchSheetModal);
  punchSheetOverlay.addEventListener("click", (e) => {
    if (e.target === punchSheetOverlay) closePunchSheetModal();
  });

  // --- ponto: histórico de TODOS os colaboradores no mês corrente, lado a
  // lado (admin) — tabela horizontal estilo Excel, aberta pelo botão "Ver
  // pontos". Sempre o mês atual (sem navegação), como pedido: "esse mês de
  // agosto deve ir do dia 1 até o último dia do mês". ---
  const usersHistoryBtn = document.getElementById("ponto-view-history-btn");
  const usersHistoryOverlay = document.getElementById("users-history-overlay");
  const usersHistoryTitle = document.getElementById("users-history-title");
  const usersHistoryThead = document.getElementById("users-history-thead");
  const usersHistoryTbody = document.getElementById("users-history-tbody");
  const usersHistoryError = document.getElementById("users-history-error");
  const usersHistoryCloseBtn = document.getElementById("users-history-close");

  function openUsersHistoryModal() {
    usersHistoryOverlay.hidden = false;
    renderUsersHistory();
  }
  function closeUsersHistoryModal() {
    usersHistoryOverlay.hidden = true;
  }

  async function renderUsersHistory() {
    usersHistoryError.textContent = "";
    usersHistoryThead.innerHTML = "";
    usersHistoryTbody.innerHTML = '<tr><td class="empty">Carregando…</td></tr>';
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-based
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 1); // exclusivo
      const lastDay = new Date(year, month + 1, 0);
      const totalDays = lastDay.getDate();
      usersHistoryTitle.textContent = `Ponto dos colaboradores — ${MONTH_NAMES[month]} de ${year}`;

      const holidays = await getHolidaysInRange(monthStart, monthEnd);
      const holidayByDate = {};
      holidays.forEach((h) => {
        holidayByDate[h.date] = h;
      });
      const holidayDates = new Set(holidays.map((h) => h.date));

      const dayKey = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Cabeçalho: nome + um dia por coluna + as duas colunas de resumo.
      const headCells = ["<th>Nome</th>"];
      for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const holiday = holidayByDate[dayKey(day)];
        const cls = holiday ? "holiday" : isWeekend ? "weekend" : "";
        headCells.push(
          `<th class="${cls}"${holiday ? ` title="${escapeHtml(holiday.name)}"` : ""}>${String(day).padStart(2, "0")}</th>`
        );
      }
      headCells.push("<th>Restante no mês</th>", "<th>Banco de horas</th>");
      usersHistoryThead.innerHTML = `<tr>${headCells.join("")}</tr>`;

      if (users.length === 0) {
        usersHistoryTbody.innerHTML = '<tr><td class="empty">Nenhum colaborador cadastrado.</td></tr>';
        return;
      }

      // Uma consulta de escala + batidas por colaborador, em paralelo.
      const rows = await Promise.all(
        users.map(async (u) => {
          const [schedule, punches] = await Promise.all([getSchedule(u.id), getPunchesForRange(u.id, monthStart, monthEnd)]);
          const byDay = {};
          punches.forEach((p) => {
            const d = new Date(p.punchedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            (byDay[key] || (byDay[key] = [])).push(p);
          });
          const workedMinutes = sumWorkedMinutes(punches);
          const expectedSoFar = expectedMinutes(schedule, monthStart, holidayDates);
          const expectedFullMonth = expectedMinutesInRange(schedule, monthStart, lastDay, holidayDates);
          const bank = workedMinutes - expectedSoFar;
          const remaining = Math.max(0, expectedFullMonth - workedMinutes);
          return { user: u, byDay, bank, remaining };
        })
      );

      usersHistoryTbody.innerHTML = "";
      rows.forEach(({ user: u, byDay, bank, remaining }) => {
        const cells = [`<td>${escapeHtml(u.name)}</td>`];
        for (let day = 1; day <= totalDays; day++) {
          const key = dayKey(day);
          const dayPunches = (byDay[key] || []).slice().sort((a, b) => new Date(a.punchedAt) - new Date(b.punchedAt));
          const date = new Date(year, month, day);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const cls = holidayByDate[key] ? "holiday" : isWeekend ? "weekend" : "";
          const content = dayPunches.length
            ? `<div class="users-history-punches">${dayPunches.map((p) => escapeHtml(toTimeInputValue(p.punchedAt))).join("<br>")}</div>`
            : "—";
          cells.push(`<td class="${cls}">${content}</td>`);
        }
        cells.push(
          `<td class="users-history-summary">${formatMinutes(remaining)}</td>`,
          `<td class="users-history-summary ${bank >= 0 ? "positive" : "negative"}">${(bank >= 0 ? "+" : "") + formatMinutes(bank)}</td>`
        );
        const row = document.createElement("tr");
        row.innerHTML = cells.join("");
        usersHistoryTbody.appendChild(row);
      });
    } catch (err) {
      console.error("Falha ao carregar histórico de ponto:", err);
      usersHistoryError.textContent = "Não foi possível carregar o histórico.";
      usersHistoryTbody.innerHTML = '<tr><td class="empty">Não foi possível carregar.</td></tr>';
    }
  }

  usersHistoryBtn.addEventListener("click", openUsersHistoryModal);
  usersHistoryCloseBtn.addEventListener("click", closeUsersHistoryModal);
  usersHistoryOverlay.addEventListener("click", (e) => {
    if (e.target === usersHistoryOverlay) closeUsersHistoryModal();
  });

  // --- calendário: feriados e recesso de 2026/2027 (assets/js/ponto-store.js
  // é quem sabe da tabela; aqui só listamos e agrupamos dias seguidos). ---
  const calendarList2026 = document.getElementById("calendar-list-2026");
  const calendarList2027 = document.getElementById("calendar-list-2027");
  const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function parseDateOnly(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  /** Merges consecutive calendar dates with the same name/type into one
   * range (e.g. 6 separate "Recesso" rows becomes one "19–24 dez" row) —
   * purely a display grouping, the underlying rows stay one-per-day. */
  function groupConsecutiveHolidays(holidays) {
    const groups = [];
    holidays.forEach((h) => {
      const date = parseDateOnly(h.date);
      const last = groups[groups.length - 1];
      if (last && last.name === h.name && last.type === h.type) {
        const nextDay = new Date(last.end);
        nextDay.setDate(nextDay.getDate() + 1);
        if (nextDay.getTime() === date.getTime()) {
          last.end = date;
          return;
        }
      }
      groups.push({ start: date, end: date, name: h.name, type: h.type });
    });
    return groups;
  }

  function formatCalendarDate(group) {
    const p = (n) => String(n).padStart(2, "0");
    const label = (d) => `${p(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
    if (group.start.getTime() === group.end.getTime()) return label(group.start);
    return `${label(group.start)} – ${label(group.end)}`;
  }

  const CALENDAR_BADGE_LABELS = { feriado: "Feriado", recesso: "Recesso", aniversario: "🎂 Aniversário" };

  /** Projects each team birthday (month/day only, no year) onto a specific
   * calendar year, so it can be merged and sorted alongside that year's
   * holidays. Purely a display concern — birthdays never touch hour calcs. */
  function birthdaysForYear(birthdays, year) {
    return birthdays.map((b) => ({
      date: `${year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
      name: `Aniversário de ${b.name}`,
      type: "aniversario",
    }));
  }

  function renderCalendarList(container, entries) {
    if (entries.length === 0) {
      container.innerHTML = '<p class="empty">Nenhum evento cadastrado.</p>';
      return;
    }
    const sorted = entries.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    container.innerHTML = groupConsecutiveHolidays(sorted)
      .map(
        (g) => `
        <div class="calendar-row">
          <span class="calendar-date">${escapeHtml(formatCalendarDate(g))}</span>
          <span class="calendar-name">${escapeHtml(g.name)}</span>
          <span class="calendar-badge ${g.type}">${CALENDAR_BADGE_LABELS[g.type]}</span>
        </div>`
      )
      .join("");
  }

  async function renderCalendarPage() {
    calendarList2026.innerHTML = '<p class="empty">Carregando…</p>';
    calendarList2027.innerHTML = '<p class="empty">Carregando…</p>';
    try {
      const [h2026, h2027, birthdays] = await Promise.all([
        getHolidaysForYear(2026),
        getHolidaysForYear(2027),
        getBirthdays(),
      ]);
      renderCalendarList(calendarList2026, [...h2026, ...birthdaysForYear(birthdays, 2026)]);
      renderCalendarList(calendarList2027, [...h2027, ...birthdaysForYear(birthdays, 2027)]);
    } catch (err) {
      console.error("Falha ao carregar calendário:", err);
      calendarList2026.innerHTML = '<p class="empty">Não foi possível carregar o calendário.</p>';
      calendarList2027.innerHTML = '<p class="empty">Não foi possível carregar o calendário.</p>';
    }
  }

  // --- initial load: fetch users from Supabase, then restore session (if
  // any) so refreshing the page doesn't log you out ---
  async function init() {
    try {
      users = await loadUsers();
    } catch (err) {
      console.error("Falha ao carregar usuários do Supabase:", err);
      loginError.textContent =
        "Não foi possível conectar ao banco de dados. Confira o console (F12) para detalhes.";
      showView("login");
      return;
    }

    const sessionId = loadSession();
    const restoredUser = sessionId !== null ? users.find((u) => u.id === sessionId) : null;
    if (restoredUser) {
      currentUser = restoredUser;
      applyPermissions();
      renderGrid();
      showView("users");
    } else {
      clearSession();
      showView("login");
    }
  }
  init();
})();
