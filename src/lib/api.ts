import { SUPABASE_URL } from './supabase';
import { INITIAL_INVENTORY_CATEGORIES } from './inventoryCategories';
import { ALL_HOSPITAL_DEPARTMENTS } from './departments';

export async function api<T = any>(path: string, options?: RequestInit & { json?: any }): Promise<T> {
  const { json, ...rest } = options || {};
  try {
    if (SUPABASE_URL.includes('abcdefghijklmnopqr') && path.startsWith('/api/')) throw new Error('Dummy mode active');
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...rest,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (null as T);
  } catch (err: any) {
    console.warn(`API Error on ${path} - using fallback dummy data:`, err.message);
    
    const isGet = !options || !options.method || options.method === 'GET';
    if (isGet) {
      const td = todayISO();
      if (path.includes('/dashboard')) return {
        kpis: {
          totalPatients: 142, todayAppointments: 34, activeAdmissions: 45,
          occupancyRate: 78, totalBeds: 100, availableBeds: 22,
          emergencyActive: 4, todayRevenue: 45000, pendingBills: 12,
          pendingAmount: 12000, pendingLabs: 15, pendingPrescriptions: 5, pendingRadiology: 10
        },
        alerts: [{ level: 'warning', text: 'Low stock on some medicines.' }],
        todayOps: { admissions: 5, discharges: 2, emergency: 4 },
        apptStatus: { "Scheduled": 15, "In Progress": 5, "Completed": 10, "Cancelled": 4 },
        weeklyTrend: [
          { date: '2026-09-16', label: 'Mon', appointments: 40 },
          { date: '2026-09-17', label: 'Tue', appointments: 35 },
          { date: '2026-09-18', label: 'Wed', appointments: 42 },
          { date: '2026-09-19', label: 'Thu', appointments: 38 },
          { date: '2026-09-20', label: 'Fri', appointments: 45 },
          { date: '2026-09-21', label: 'Sat', appointments: 20 },
          { date: td, label: 'Today', appointments: 34 }
        ],
        bedByCategory: { 'General': { total: 50, occupied: 40 } },
        deptLoad: { 'Cardiology': 12 }
      } as any;
      if (path.includes('/patients')) return [] as any;
      if (path.includes('/doctors')) return [] as any;
      if (path.includes('/appointments')) return [] as any;
      if (path.includes('/staff')) return [] as any;
      if (path.includes('/approvals')) return [] as any;
      if (path.includes('/inventory-categories')) return INITIAL_INVENTORY_CATEGORIES as any;
      if (path.includes('/medicines') || path.includes('/inventory')) return [] as any;
      if (path.includes('/invoices')) return [] as any;
      if (path.includes('/departments')) return ALL_HOSPITAL_DEPARTMENTS.map((name, i) => ({ id: i + 1, name, status: 'Available' })) as any;
      if (path.includes('/beds')) return [] as any;
      if (path.includes('/vitals')) return [] as any;
      if (path.includes('/documents')) return [] as any;
      return [] as any;
    }
    
    // For non-GET calls (POST, PUT, DELETE), throw the error so forms and operations do not pretend to succeed
    throw err;
  }
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, json: any) => api<T>(path, { method: 'POST', json });
export const put = <T = any>(path: string, json: any) => api<T>(path, { method: 'PUT', json });
export const del = <T = any>(path: string, json?: any) => api<T>(path, { method: 'DELETE', json });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const inr = (n: number | string | null | undefined) => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtTime = (t?: string | null) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m ?? 0).padStart(2, '0')} ${ap}`;
};

export const initials = (name?: string | null) => {
  if (!name) return '–';
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

export const AVATAR_BG = ['#0e5aa7', '#0d9488', '#6a3fd4', '#9a6b0a', '#b4232a', '#475569', '#0e7490', '#7c2d12'];
export const avatarColor = (name?: string | null) => {
  if (!name) return AVATAR_BG[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_BG[h % AVATAR_BG.length];
};

export async function logAudit(entry: { user_name: string; user_role: string; action: string; module: string; result?: string }) {
  try {
    await post('/api/audit', { ...entry, result: entry.result || 'Success' });
  } catch { /* audit must never break UX */ }
}
