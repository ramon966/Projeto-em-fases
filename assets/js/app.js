// UI wiring: view switching, the users grid/list, the create/edit modal,
// the login form, and the sidebar. Data access goes through window.UsersStore
// (assets/js/users-store.js) — this file never touches localStorage directly.
(function () {
  const { loadUsers, createUser, updateUser, deleteUser, findUserByEmail, saveSession, loadSession, clearSession } = window.UsersStore;

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
    });
  });

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
