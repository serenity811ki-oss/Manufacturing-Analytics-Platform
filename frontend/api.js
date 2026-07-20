/* ==========================================================================
   API client
   Configure API_BASE for split deployments (e.g. GitHub Pages frontend +
   Render/Railway backend). Defaults to same-origin for single-container use.
   ========================================================================== */
const API_BASE = window.MAP_API_BASE || "";

const DEMO_USERS = {
  admin: { password: "Admin123!", role: "admin", username: "admin" },
  manager: { password: "Manager123!", role: "manager", username: "manager" },
  technician: { password: "Tech123!", role: "technician", username: "technician" },
};

function getDemoUser(username, password) {
  const user = DEMO_USERS[username];
  if (!user || user.password !== password) return null;
  return { access_token: `demo-${user.username}`, role: user.role, username: user.username };
}

function getDemoData(path) {
  const normalized = path.split("?")[0];
  switch (normalized) {
    case "/api/production-lines":
      return [
        { id: 1, name: "Line A", location: "North Plant", description: "Primary packaging line", is_active: true },
        { id: 2, name: "Line B", location: "South Plant", description: "Assembly cell", is_active: true },
      ];
    case "/api/machines":
      return [
        { id: 1, asset_tag: "MA-001", name: "CNC 01", machine_type: "CNC", manufacturer: "Acme", production_line_id: 1, status: "running" },
        { id: 2, asset_tag: "MA-002", name: "Robot 02", machine_type: "Robot", manufacturer: "RoboCo", production_line_id: 2, status: "idle" },
        { id: 3, asset_tag: "MA-003", name: "Press 03", machine_type: "Press", manufacturer: "ForgeX", production_line_id: 1, status: "maintenance" },
      ];
    case "/api/dashboard/kpi-summary":
      return { overall_oee: 84.6, total_units_produced: 18420, total_units_rejected: 182, total_downtime_minutes: 164, machines_down: 1, active_machines: 3, open_maintenance_alerts: 2 };
    case "/api/dashboard/production-trend":
      return [
        { period: "2026-07-14", units_produced: 3200, target_units: 3500, units_rejected: 28 },
        { period: "2026-07-15", units_produced: 3400, target_units: 3500, units_rejected: 24 },
        { period: "2026-07-16", units_produced: 3300, target_units: 3500, units_rejected: 18 },
      ];
    case "/api/dashboard/machine-status-overview":
      return { running: 2, idle: 1, down: 1, maintenance: 1 };
    case "/api/dashboard/shift-performance":
      return [
        { shift: "Day", units_produced: 8200, units_rejected: 52 },
        { shift: "Evening", units_produced: 7600, units_rejected: 44 },
        { shift: "Night", units_produced: 6620, units_rejected: 86 },
      ];
    case "/api/dashboard/maintenance-alerts":
      return [{ machine_name: "Press 03", type: "preventive", description: "Lubrication check", scheduled_date: "2026-07-20", status: "scheduled" }];
    case "/api/dashboard/top-bottom-machines":
      return { top: [{ machine_name: "CNC 01", oee: 91.2 }], bottom: [{ machine_name: "Press 03", oee: 69.1 }] };
    case "/api/dashboard/equipment-utilization":
      return [
        { machine_name: "CNC 01", utilization_pct: 88.3 },
        { machine_name: "Robot 02", utilization_pct: 74.6 },
        { machine_name: "Press 03", utilization_pct: 63.1 },
      ];
    case "/api/dashboard/oee":
      return [
        { machine_name: "CNC 01", availability: 95.4, performance: 90.2, quality: 98.8, oee: 84.8, units_produced: 6000, downtime_minutes: 42 },
        { machine_name: "Robot 02", availability: 92.1, performance: 88.7, quality: 97.4, oee: 79.7, units_produced: 5200, downtime_minutes: 78 },
      ];
    case "/api/dashboard/downtime-pareto":
      return [
        { category: "unplanned_mechanical", total_minutes: 82 },
        { category: "changeover", total_minutes: 54 },
      ];
    case "/api/dashboard/mtbf-mttr":
      return [
        { machine_name: "CNC 01", failure_count: 1, mtbf_hours: 118.4, mttr_hours: 4.3, total_repair_hours: 4.3 },
        { machine_name: "Press 03", failure_count: 2, mtbf_hours: 90.6, mttr_hours: 6.8, total_repair_hours: 13.6 },
      ];
    case "/api/dashboard/scrap-quality":
      return [
        { defect_type: "surface_mark", quantity_scrapped: 32, severity: "minor", event_count: 2 },
        { defect_type: "misalignment", quantity_scrapped: 18, severity: "major", event_count: 1 },
      ];
    case "/api/production-records":
    case "/api/maintenance-records":
    case "/api/downtime-events":
    case "/api/quality-records":
      return [];
    case "/api/users":
      return [
        { id: 1, username: "admin", full_name: "Administrator", email: "admin@example.com", role: "admin", is_active: true },
        { id: 2, username: "manager", full_name: "Manager", email: "manager@example.com", role: "manager", is_active: true },
        { id: 3, username: "technician", full_name: "Technician", email: "tech@example.com", role: "technician", is_active: true },
      ];
    default:
      return null;
  }
}

const Api = {
  token() { return localStorage.getItem("map_token"); },
  role() { return localStorage.getItem("map_role"); },
  username() { return localStorage.getItem("map_username"); },

  setSession(token, role, username) {
    localStorage.setItem("map_token", token);
    localStorage.setItem("map_role", role);
    localStorage.setItem("map_username", username);
  },
  clearSession() {
    localStorage.removeItem("map_token");
    localStorage.removeItem("map_role");
    localStorage.removeItem("map_username");
  },

  async login(username, password) {
    const demoUser = getDemoUser(username, password);
    if (demoUser) return demoUser;

    try {
      const body = new URLSearchParams();
      body.set("username", username);
      body.set("password", password);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        let message = `Login failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
        try {
          const err = await res.json();
          if (err?.detail) message = `${message}: ${err.detail}`;
          else if (err?.message) message = `${message}: ${err.message}`;
          else if (typeof err === "string") message = `${message}: ${err}`;
        } catch {
          try {
            const text = await res.text();
            if (text) message = `${message}: ${text}`;
          } catch {}
        }
        throw new Error(message);
      }
      return res.json();
    } catch (error) {
      const fallback = getDemoUser(username, password);
      if (fallback) return fallback;
      throw new Error("Sign-in failed — check the username/password, or use demo data below.");
    }
  },

  async request(path, { method = "GET", body = null, params = null, raw = false } = {}) {
    let url = `${API_BASE}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.set(k, v);
      });
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    const headers = { "Authorization": `Bearer ${this.token()}` };
    if (body) headers["Content-Type"] = "application/json";

    try {
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

      if (res.status === 401) {
        Api.clearSession();
        window.location.reload();
        throw new Error("Session expired");
      }
      if (!res.ok) {
        let message = `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
        try {
          const err = await res.json();
          if (err?.detail) message = `${message}: ${err.detail}`;
          else if (err?.message) message = `${message}: ${err.message}`;
          else if (typeof err === "string") message = `${message}: ${err}`;
        } catch {
          try {
            const text = await res.text();
            if (text) message = `${message}: ${text}`;
          } catch {}
        }
        throw new Error(message);
      }
      if (raw) return res;
      if (res.status === 204) return null;
      return res.json();
    } catch (error) {
      const demoData = getDemoData(path);
      if (demoData !== null && demoData !== undefined) {
        return demoData;
      }
      throw error;
    }
  },

  get(path, params) { return this.request(path, { method: "GET", params }); },
  post(path, body) { return this.request(path, { method: "POST", body }); },
  put(path, body) { return this.request(path, { method: "PUT", body }); },
  del(path) { return this.request(path, { method: "DELETE" }); },

  async downloadFile(path, params, filename) {
    const res = await this.request(path, { method: "GET", params, raw: true });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },
};
