/* ==========================================================================
   App bootstrap, routing, filters, and per-view data binding.
   ========================================================================== */
const App = {
  currentView: "production-dashboard",
  lines: [],
  machines: [],
  shifts: [],

  async init() {
    if (Api.token()) {
      this.showApp();
      await this.bootstrapData();
      this.navigate(this.currentView);
    } else {
      this.showLogin();
    }
    this.wireGlobalEvents();
  },

  showLogin() {
    const loginScreen = document.getElementById("login-screen") || document.getElementById("loginScreen");
    const appShell = document.getElementById("app-shell") || document.getElementById("dashboard");
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (appShell) appShell.classList.add("hidden");
  },

  showApp() {
    const loginScreen = document.getElementById("login-screen") || document.getElementById("loginScreen");
    const appShell = document.getElementById("app-shell") || document.getElementById("dashboard");
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appShell) appShell.classList.remove("hidden");

    const userNameEl = document.getElementById("user-name") || document.getElementById("userLabel");
    const userRoleEl = document.getElementById("user-role");
    const userAvatarEl = document.getElementById("user-avatar");
    const adminNavEl = document.getElementById("nav-users-admin");

    if (userNameEl) userNameEl.textContent = Api.username();
    if (userRoleEl) userRoleEl.textContent = Api.role();
    if (userAvatarEl) userAvatarEl.textContent = (Api.username() || "?")[0].toUpperCase();
    if (adminNavEl && Api.role() !== "admin") {
      adminNavEl.classList.add("hidden");
    }
  },

  async bootstrapData() {
    try {
      const [lines, machines, shifts] = await Promise.all([
        Api.get("/api/production-lines"),
        Api.get("/api/machines"),
        Api.get("/api/dashboard/machine-status-overview").catch(() => ({})),
      ]);
      this.lines = lines;
      this.machines = machines;
      this.populateFilterSelects();
    } catch (e) { toast(e.message, "error"); }
  },

  populateFilterSelects() {
    const lineSel = document.getElementById("filter-line");
    lineSel.innerHTML = `<option value="">All Lines</option>` +
      this.lines.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
    const machSel = document.getElementById("filter-machine");
    machSel.innerHTML = `<option value="">All Machines</option>` +
      this.machines.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
  },

  wireGlobalEvents() {
    const loginForm = document.getElementById("login-form") || document.getElementById("loginForm");
    const usernameInput = document.getElementById("login-username") || document.getElementById("username");
    const passwordInput = document.getElementById("login-password") || document.getElementById("password");
    const errEl = document.getElementById("login-error") || document.getElementById("loginError");

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = (usernameInput?.value || "").trim();
        const password = passwordInput?.value || "";
        if (errEl) errEl.textContent = "";
        try {
          const data = await Api.login(username, password);
          Api.setSession(data.access_token, data.role, data.username);
          this.showApp();
          await this.bootstrapData();
          this.navigate("production-dashboard");
        } catch (err) {
          if (errEl) errEl.textContent = err.message || "Sign-in failed — check the username/password, or use demo data below.";
        }
      });
    }

    const logoutBtn = document.getElementById("logout-btn") || document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        Api.clearSession();
        window.location.reload();
      });
    }

    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => this.navigate(link.dataset.view));
    });

    document.getElementById("sidebar-toggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });

    ["filter-range", "filter-line", "filter-machine"].forEach(id => {
      document.getElementById(id).addEventListener("change", () => this.navigate(this.currentView));
    });
    let searchTimeout;
    document.getElementById("filter-search").addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this.navigate(this.currentView), 350);
    });
  },

  getDateRange() {
    const days = parseInt(document.getElementById("filter-range").value, 10);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { start_date: start.toISOString(), end_date: end.toISOString() };
  },

  getFilters() {
    return {
      ...this.getDateRange(),
      production_line_id: document.getElementById("filter-line").value || undefined,
      machine_id: document.getElementById("filter-machine").value || undefined,
      search: document.getElementById("filter-search").value || undefined,
    };
  },

  navigate(viewName) {
    this.currentView = viewName;
    document.querySelectorAll(".nav-link").forEach(l => l.classList.toggle("active", l.dataset.view === viewName));
    document.getElementById("view-title").textContent = ViewTitles[viewName] || viewName;
    document.getElementById("sidebar").classList.remove("open");

    const container = document.getElementById("view-container");
    container.innerHTML = Views[viewName] || `<div class="empty-state">View not found.</div>`;

    const renderer = ViewRenderers[viewName];
    if (renderer) renderer().catch(e => toast(e.message, "error"));
  },
};

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add("hidden"), 3000);
  el.classList.remove("hidden");
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function badge(value) {
  const cls = (value || "").toString().toLowerCase();
  return `<span class="badge badge-${cls}">${(value || "").toString().replace(/_/g, " ")}</span>`;
}

document.addEventListener("DOMContentLoaded", () => App.init());
