import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, BedDouble, Pill, FlaskConical, Receipt,
  Siren, ClipboardList, ScanLine, Package, ShieldCheck, BarChart3, Bell, Settings,
  Search, Menu, X, Sun, Moon, LogOut, ChevronDown, HeartPulse, UserRound, Stethoscope,
  FileText, Wallet, Activity, Clock, CheckCircle2, FolderOpen,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ROLE_TAGLINES, type Role } from '../lib/roles';
import { get, put } from '../lib/api';
import { Avatar } from '../components/ui';

interface NavItem { to: string; label: string; icon: React.ReactNode; end?: boolean }

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  Admin: [
    { to: '/app', label: 'Overview', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
    { to: '/app/staff', label: 'Staff Directory', icon: <UserRound size={18} /> },
    { to: '/app/approvals', label: 'Approval Center', icon: <CheckCircle2 size={18} /> },
    { to: '/app/appointments', label: 'Appointments', icon: <CalendarDays size={18} /> },
    { to: '/app/opd', label: 'OPD Queue', icon: <Activity size={18} /> },
    { to: '/app/admissions', label: 'Admissions', icon: <ClipboardList size={18} /> },
    { to: '/app/beds', label: 'Beds & Rooms', icon: <BedDouble size={18} /> },
    { to: '/app/emergency', label: 'Emergency', icon: <Siren size={18} /> },
    { to: '/app/doctors', label: 'Doctors & Staff', icon: <Stethoscope size={18} /> },
    { to: '/app/lab', label: 'Laboratory', icon: <FlaskConical size={18} /> },
    { to: '/app/radiology', label: 'Radiology', icon: <ScanLine size={18} /> },
    { to: '/app/pharmacy', label: 'Pharmacy', icon: <Pill size={18} /> },
    { to: '/app/inventory', label: 'Inventory', icon: <Package size={18} /> },
    { to: '/app/billing', label: 'Billing', icon: <Receipt size={18} /> },
    { to: '/app/insurance', label: 'Insurance', icon: <Wallet size={18} /> },
    { to: '/app/reports', label: 'Reports', icon: <BarChart3 size={18} /> },
    { to: '/app/audit', label: 'Audit Log', icon: <ShieldCheck size={18} /> },
    { to: '/app/reception-documents', label: 'Documents', icon: <FolderOpen size={18} /> },
  ],
  Doctor: [
    { to: '/app', label: 'My Day', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
    { to: '/app/appointments', label: 'Appointments', icon: <CalendarDays size={18} /> },
    { to: '/app/opd', label: 'OPD Queue', icon: <Activity size={18} /> },
    { to: '/app/consult', label: 'Consultation', icon: <HeartPulse size={18} /> },
    { to: '/app/admissions', label: 'Admissions', icon: <ClipboardList size={18} /> },
    { to: '/app/lab', label: 'Lab Results', icon: <FlaskConical size={18} /> },
    { to: '/app/radiology', label: 'Radiology', icon: <ScanLine size={18} /> },
    { to: '/app/emergency', label: 'Emergency', icon: <Siren size={18} /> },
  ],
  Nurse: [
    { to: '/app', label: 'Ward Board', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/admissions', label: 'My Patients', icon: <ClipboardList size={18} /> },
    { to: '/app/beds', label: 'Beds & Rooms', icon: <BedDouble size={18} /> },
    { to: '/app/opd', label: 'OPD Queue', icon: <Activity size={18} /> },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
    { to: '/app/emergency', label: 'Emergency', icon: <Siren size={18} /> },
  ],
  Receptionist: [
    { to: '/app', label: 'Front Desk', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
    { to: '/app/appointments', label: 'Appointments', icon: <CalendarDays size={18} /> },
    { to: '/app/opd', label: 'OPD Queue', icon: <Activity size={18} /> },
    { to: '/app/admissions', label: 'Admit / Discharge', icon: <ClipboardList size={18} /> },
    { to: '/app/beds', label: 'Beds & Rooms', icon: <BedDouble size={18} /> },
    { to: '/app/billing', label: 'Billing', icon: <Receipt size={18} /> },
    { to: '/app/emergency', label: 'Emergency', icon: <Siren size={18} /> },
    { to: '/app/reception-documents', label: 'Documents', icon: <FolderOpen size={18} /> },
  ],
  Pharmacist: [
    { to: '/app', label: 'Dispensary', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/pharmacy', label: 'Prescriptions', icon: <Pill size={18} /> },
    { to: '/app/inventory', label: 'Inventory', icon: <Package size={18} /> },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
  ],
  'Lab Technician': [
    { to: '/app', label: 'Lab Bench', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/lab', label: 'Test Orders', icon: <FlaskConical size={18} /> },
    { to: '/app/radiology', label: 'Radiology', icon: <ScanLine size={18} /> },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
  ],
  Accountant: [
    { to: '/app', label: 'Finance', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/billing', label: 'Billing', icon: <Receipt size={18} /> },
    { to: '/app/insurance', label: 'Insurance', icon: <Wallet size={18} /> },
    { to: '/app/reports', label: 'Reports', icon: <BarChart3 size={18} /> },
    { to: '/app/patients', label: 'Patients', icon: <Users size={18} /> },
  ],
  Patient: [
    { to: '/app', label: 'My Health', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/my/appointments', label: 'My Appointments', icon: <CalendarDays size={18} /> },
    { to: '/app/my/records', label: 'Medical Records', icon: <FileText size={18} /> },
    { to: '/app/my/prescriptions', label: 'Prescriptions', icon: <Pill size={18} /> },
    { to: '/app/my/lab', label: 'Lab Reports', icon: <FlaskConical size={18} /> },
    { to: '/app/my/bills', label: 'Bills & Payments', icon: <Receipt size={18} /> },
  ],
};

export default function AppShell() {
  const { user, signOut } = useAuth();
  const { effective, setTheme } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [sidebar, setSidebar] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [punchLoading, setPunchLoading] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const role = user?.role || 'Patient';
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.Patient;

  const fetchNotifs = async () => {
    try {
      const d = await get(`/api/notifications?role=${encodeURIComponent(role)}`);
      setNotifs(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchNotifs(); const t = setInterval(fetchNotifs, 45000); return () => clearInterval(t); }, [role]);

  useEffect(() => {
    const close = (e: globalThis.MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', close);
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setSidebar(false); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', keys); };
  }, []);

  useEffect(() => { setSidebar(false); }, [loc.pathname]);

  const unread = notifs.filter((n) => !n.is_read).length;
  const markAll = async () => {
    await put('/api/notifications', { mark_all: true, role });
    fetchNotifs();
  };
  const markOne = async (n: any) => {
    await put('/api/notifications', { id: n.id, is_read: true });
    fetchNotifs();
  };

  const togglePunch = async () => {
    setPunchLoading(true);
    // Mocking API call for attendance since backend doesn't exist
    setTimeout(() => {
      setIsPunchedIn(!isPunchedIn);
      setPunchLoading(false);
      toast({ 
        kind: 'success', 
        title: !isPunchedIn ? 'Punched In' : 'Punched Out', 
        desc: `Time recorded at ${new Date().toLocaleTimeString('en-IN')}` 
      });
    }, 600);
  };

  const logout = async () => {
    await signOut();
    nav('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-[#081322] text-slate-800 dark:text-slate-100">
      {/* ============ SIDEBAR (desktop) ============ */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-white dark:bg-[#0c1e32] border-r hairline transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-[248px]'}`}>
        <div className="h-16 flex items-center px-4 border-b hairline shrink-0">
          <Logo compact={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-1">
          {!collapsed && <div className="px-2 pt-1 pb-2 text-[11px] font-bold tracking-[.14em] uppercase opacity-45">{role} workspace</div>}
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} title={collapsed ? it.label : undefined}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? '!justify-center !px-0' : ''}`}>
              {it.icon}
              {!collapsed && <span>{it.label}</span>}
            </NavLink>
          ))}
        </div>
        <div className="p-3 border-t hairline space-y-1">
          <NavLink to="/app/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? '!justify-center !px-0' : ''}`} title="Notifications">
            <Bell size={18} />{!collapsed && <span>Notifications</span>}
            {!collapsed && unread > 0 && <span className="ml-auto text-[11px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-5 text-center">{unread}</span>}
          </NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? '!justify-center !px-0' : ''}`} title="Settings">
            <Settings size={18} />{!collapsed && <span>Settings</span>}
          </NavLink>
          <button onClick={() => setCollapsed(!collapsed)} className="nav-item w-full" title={collapsed ? 'Expand' : 'Collapse'}>
            <Menu size={18} />{!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ============ SIDEBAR (mobile drawer) ============ */}
      {sidebar && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebar(false)} />}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[270px] bg-white dark:bg-[#0c1e32] flex flex-col transition-transform duration-300 ${sidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b hairline shrink-0">
          <Logo />
          <button onClick={() => setSidebar(false)} className="btn btn-ghost btn-sm !px-2" aria-label="Close menu"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-1">
          <div className="px-2 pt-1 pb-2 text-[11px] font-bold tracking-[.14em] uppercase opacity-45">{role} workspace</div>
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {it.icon}<span>{it.label}</span>
            </NavLink>
          ))}
          <NavLink to="/app/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Bell size={18} /><span>Notifications</span>
            {unread > 0 && <span className="ml-auto text-[11px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-5 text-center">{unread}</span>}
          </NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={18} /><span>Settings</span>
          </NavLink>
        </div>
        <div className="p-4 border-t hairline">
          <button onClick={logout} className="btn btn-ghost w-full"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      {/* ============ MAIN COLUMN ============ */}
      <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]'}`}>
        {/* topbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#0c1e32]/90 backdrop-blur border-b hairline flex items-center gap-2 px-3 sm:px-5">
          <button onClick={() => setSidebar(true)} className="btn btn-ghost btn-sm !px-2 lg:hidden" aria-label="Open menu"><Menu size={18} /></button>
          <button onClick={() => setSearchOpen(true)} className="hidden sm:flex items-center gap-2.5 text-sm opacity-70 hover:opacity-100 border hairline rounded-xl px-3.5 py-2 w-64 bg-slate-50 dark:bg-slate-900/60 transition-opacity">
            <Search size={15} /><span>Search patients, doctors…</span>
            <kbd className="ml-auto text-[10px] font-bold border hairline rounded px-1.5 py-0.5 opacity-60">Ctrl K</kbd>
          </button>
          <button onClick={() => setSearchOpen(true)} className="btn btn-ghost btn-sm !px-2 sm:hidden" aria-label="Search"><Search size={17} /></button>

          <div className="ml-auto flex items-center gap-1.5">
            {role !== 'Patient' && role !== 'Admin' && (
              <button 
                onClick={togglePunch} 
                disabled={punchLoading}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${isPunchedIn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                {punchLoading ? <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : isPunchedIn ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                <span>{isPunchedIn ? 'On Duty' : 'Punch In'}</span>
              </button>
            )}
            <button onClick={() => setTheme(effective === 'dark' ? 'light' : 'dark')} className="btn btn-ghost btn-sm !px-2" aria-label="Toggle theme">
              {effective === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {/* notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(!notifOpen)} className="btn btn-ghost btn-sm !px-2 relative" aria-label="Notifications">
                <Bell size={17} />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] card !rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b hairline">
                    <span className="font-bold text-sm">Notifications</span>
                    <button onClick={markAll} className="text-xs font-bold text-med-600 dark:text-sky-300 hover:underline">Mark all read</button>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto scroll-thin">
                    {notifs.length === 0 && <div className="p-6 text-center text-sm opacity-55">No notifications.</div>}
                    {notifs.slice(0, 20).map((n) => (
                      <button key={n.id} onClick={() => markOne(n)} className={`w-full text-left px-4 py-3 border-b hairline hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${n.is_read ? 'opacity-60' : ''}`}>
                        <div className="flex gap-2 items-start">
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-med-500 mt-1.5 shrink-0" />}
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold leading-snug">{n.title}</div>
                            <div className="text-xs opacity-60 mt-0.5 leading-snug">{n.message}</div>
                            <div className="text-[11px] opacity-45 mt-1">{n.type} · {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* profile */}
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Avatar name={user?.name} size={32} />
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-[13px] font-bold">{user?.name}</div>
                  <div className="text-[11px] opacity-55">{role}</div>
                </div>
                <ChevronDown size={14} className="opacity-50 hidden md:block" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 card !rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3.5 border-b hairline">
                    <div className="font-bold text-sm">{user?.name}</div>
                    <div className="text-xs opacity-60">{user?.email}</div>
                    <div className="mt-2"><span className="badge b-blue">{role}</span></div>
                    <div className="text-[11px] opacity-50 mt-1.5">{ROLE_TAGLINES[role]}</div>
                  </div>
                  <div className="p-2">
                    <button onClick={() => { setProfileOpen(false); nav('/app/settings'); }} className="nav-item w-full"><UserRound size={16} /> My settings</button>
                    <button onClick={logout} className="nav-item w-full !text-red-600 dark:!text-red-300"><LogOut size={16} /> Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* page */}
        <main className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-[1440px] mx-auto">
          <Outlet />
        </main>

        {/* mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-[#0c1e32] border-t hairline flex items-center justify-around px-2 pt-2 pb-safe">
          {items.slice(0, 4).map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold ${isActive ? 'text-med-600 dark:text-sky-300' : 'opacity-55'}`}>
              {it.icon}<span>{it.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button onClick={() => setSidebar(true)} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold opacity-55">
            <Menu size={18} /><span>More</span>
          </button>
        </nav>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

/* ================= Global search (Ctrl+K) ================= */
function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ patients: any[]; doctors: any[]; appointments: any[]; invoices: any[]; beds: any[] }>({ patients: [], doctors: [], appointments: [], invoices: [], beds: [] });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults({ patients: [], doctors: [], appointments: [], invoices: [], beds: [] }); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const [p, d, i] = await Promise.all([
          get(`/api/patients?search=${encodeURIComponent(q.trim())}&limit=5`),
          get('/api/doctors'),
          get(`/api/invoices?search=${encodeURIComponent(q.trim())}&limit=3`)
        ]);
        const docs = (Array.isArray(d) ? d : []).filter((x: any) => x.name?.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4);
        setResults({ 
          patients: Array.isArray(p) ? p.slice(0, 5) : [], 
          doctors: docs, 
          appointments: [], 
          invoices: Array.isArray(i) ? i : [], 
          beds: [] 
        });
      } catch { /* ignore */ }
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path: string) => { onClose(); nav(path); };
  const empty = !busy && q.trim().length >= 2 && results.patients.length === 0 && results.doctors.length === 0;

  return (
    <div className="modal-backdrop !items-start !pt-[12vh]" onClick={onClose}>
      <div className="modal-panel max-w-xl !rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b hairline">
          <Search size={18} className="opacity-50 shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients, doctors… (min 2 letters)" className="flex-1 bg-transparent outline-none text-[15px]" />
          <kbd className="text-[10px] font-bold border hairline rounded px-1.5 py-0.5 opacity-50">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto scroll-thin p-2">
          {busy && <div className="p-4 text-sm opacity-60">Searching…</div>}
          {empty && <div className="p-6 text-center text-sm opacity-60">No results for “{q}”.</div>}
          {q.trim().length < 2 && <div className="p-6 text-center text-sm opacity-50">Type at least 2 letters to search the hospital.</div>}
          {results.patients.length > 0 && (
            <div className="mb-1">
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider opacity-45">Patients</div>
              {results.patients.map((p: any) => (
                <button key={p.id} onClick={() => go(`/app/patients/${p.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                  <Avatar name={p.name} size={32} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{p.name} <span className="opacity-50 font-semibold">· {p.patient_id}</span></div>
                    <div className="text-xs opacity-55">{p.age}y · {p.gender} · {p.phone}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {results.doctors.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider opacity-45">Doctors</div>
              {results.doctors.map((d: any) => (
                <button key={d.id} onClick={() => go('/app/doctors')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                  <Avatar name={d.name} size={32} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{d.name}</div>
                    <div className="text-xs opacity-55">{d.specialty} · {d.department}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {results.invoices.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider opacity-45">Invoices</div>
              {results.invoices.map((inv: any) => (
                <button key={inv.id} onClick={() => go('/app/billing')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left">
                  <Receipt size={18} className="opacity-50 shrink-0 mx-1.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{inv.invoice_number} <span className="opacity-50 font-normal">· {inv.patient?.name}</span></div>
                    <div className="text-xs opacity-55">Total: ₹{inv.total} · Paid: ₹{inv.paid}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
