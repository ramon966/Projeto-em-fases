// Light/dark theme toggle. Preference is persisted in localStorage and
// falls back to the OS-level color-scheme on first visit.
(function () {
  const THEME_KEY = "norteagro.theme";
  const themeToggle = document.getElementById("theme-toggle");

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // ignore — theme just won't persist across reloads
    }
    themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"
    );
  }

  let theme = preferredTheme();
  applyTheme(theme);

  themeToggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme(theme);
  });
})();
