import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarDays, BedDouble, Siren, IndianRupee, FlaskConical, Pill,
  UserPlus, CalendarPlus, LogIn, LogOut, Receipt, ArrowRight, Clock,
  AlertTriangle, Stethoscope, HeartPulse, ClipboardList, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { get, inr, todayISO, fmtTime, fmtDate, post, put, logAudit } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Stat, Badge, AlertBanner, SkeletonCards, Empty, SectionHead, Meter, Avatar } from '../components/ui';

/* ================================================================== ADMIN */
function AdminDash() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const load = async () => {
    setLoading(true); setErr('');
    try { setD(await get(`/api/dashboard?date=${todayISO()}`)); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="space-y-4"><SkeletonCards count={4} /><SkeletonCards count={4} /></div>;
  if (err || !d) return <Empty title="Unable to load dashboard" desc={err} action={<button className="btn btn-ghost btn-sm" onClick={load}>Retry</button>} />;
  const k = d.kpis;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{greet}, Admin</h1>
        <p className="text-sm opacity-60 mt-0.5">AbhiShree Hospital · {fmtDate(todayISO())} — here's what's happening today.</p>
      </div>

      {d.alerts?.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {d.alerts.map((a: any, i: number) => <AlertBanner key={i} level={a.level} text={a.text} />)}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total patients" value={k.totalPatients.toLocaleString('en-IN')} sub="Registered in the system" icon={<Users size={19} />} />
        <Stat label="Today's appointments" value={k.todayAppointments} sub={`${d.todayOps.admissions} admissions · ${d.todayOps.discharges} discharges`} icon={<CalendarDays size={19} />} />
        <Stat label="Active admissions" value={k.activeAdmissions} sub={`${k.availableBeds} of ${k.totalBeds} beds free`} icon={<ClipboardList size={19} />} />
        <Stat label="Bed occupancy" value={`${k.occupancyRate}%`} sub={`${k.totalBeds - k.availableBeds} beds occupied`} icon={<BedDouble size={19} />} />
        <Stat label="Emergency active" value={k.emergencyActive} sub="Cases needing attention" icon={<Siren size={19} />} />
        <Stat label="Revenue collected" value={inr(k.todayRevenue)} sub="Across all invoices" icon={<IndianRupee size={19} />} />
        <Stat label="Pending bills" value={k.pendingBills} sub={`${inr(k.pendingAmount)} outstanding`} icon={<Receipt size={19} />} />
        <Stat label="Pending lab reports" value={k.pendingLabs} sub={`${k.pendingPrescriptions} prescriptions · ${k.pendingRadiology} scans`} icon={<FlaskConical size={19} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        {/* weekly trend */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold">Patient volume — last 7 days</div>
              <div className="text-xs opacity-55">Appointments per day</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/reports')}>Full reports <ArrowRight size={14} /></button>
          </div>
          <div className="flex items-end gap-2 h-44">
            {(d.weeklyTrend || []).map((w: any) => {
              const max = Math.max(1, ...d.weeklyTrend.map((x: any) => x.appointments));
              return (
                <div key={w.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end" title={`${fmtDate(w.date)}: ${w.appointments}`}>
                  <span className="text-xs font-bold">{w.appointments}</span>
                  <div className="w-full max-w-[52px] rounded-t-lg bg-gradient-to-t from-med-700 to-med-500 dark:from-sky-700 dark:to-sky-400 transition-all" style={{ height: `${Math.max(6, (w.appointments / max) * 100)}%` }} />
                  <span className="text-[11px] font-semibold opacity-55">{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* today's ops */}
        <div className="card p-5">
          <div className="font-bold mb-1">Today's operations</div>
          <div className="text-xs opacity-55 mb-4">Live status of today's visits</div>
          <div className="space-y-3">
            {Object.keys(d.apptStatus || {}).length === 0 && <div className="text-sm opacity-55">No appointments scheduled today yet.</div>}
            {Object.entries(d.apptStatus || {}).map(([s, c]: any) => (
              <div key={s} className="flex items-center gap-3">
                <div className="w-28 shrink-0"><Badge status={s} /></div>
                <Meter value={c} max={Math.max(1, k.todayAppointments)} />
                <span className="text-sm font-bold w-6 text-right">{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t hairline grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xl font-bold">{d.todayOps.admissions}</div><div className="text-[11px] opacity-55">Admitted</div></div>
            <div><div className="text-xl font-bold">{d.todayOps.discharges}</div><div className="text-[11px] opacity-55">Discharged</div></div>
            <div><div className="text-xl font-bold">{d.todayOps.emergency}</div><div className="text-[11px] opacity-55">Emergency</div></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* bed occupancy by category */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold">Bed occupancy by category</div>
              <div className="text-xs opacity-55">Occupied vs total beds</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/beds')}>Bed map <ArrowRight size={14} /></button>
          </div>
          <div className="space-y-3.5">
            {Object.entries(d.bedByCategory || {}).map(([cat, v]: any) => {
              const pct = v.total ? Math.round((v.occupied / v.total) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{cat}</span><span className="opacity-60">{v.occupied}/{v.total} · {pct}%</span></div>
                  <Meter value={pct} color={pct >= 85 ? '#b4232a' : pct >= 65 ? '#d99a0b' : '#0d9488'} />
                </div>
              );
            })}
          </div>
        </div>
        {/* department workload */}
        <div className="card p-5">
          <div className="font-bold mb-1">Department workload today</div>
          <div className="text-xs opacity-55 mb-4">Appointments by department</div>
          <div className="space-y-3">
            {Object.keys(d.deptLoad || {}).length === 0 && <div className="text-sm opacity-55">No department activity yet today.</div>}
            {Object.entries(d.deptLoad || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 7).map(([dept, c]: any) => (
              <div key={dept} className="flex items-center gap-3">
                <span className="text-sm font-medium w-36 truncate shrink-0">{dept}</span>
                <Meter value={c} max={Math.max(1, ...Object.values(d.deptLoad).map(Number))} />
                <span className="text-sm font-bold w-6 text-right">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* ADD-ONLY: Hospital Overview (Staff) */}
        <div className="card p-5">
          <div className="font-bold mb-4">Hospital Overview (Staff)</div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Total Staff" value={42} />
            <Stat label="Staff On Duty" value={18} />
            <Stat label="Present / Absent" value="18 / 2" />
            <Stat label="Late Arrivals" value={1} />
          </div>
        </div>
        {/* ADD-ONLY: Pending Approvals */}
        <div className="card p-5">
          <div className="font-bold mb-4">Pending Approvals</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <div><span className="font-semibold">Discount Request</span><br/><span className="opacity-60">Req. by Receptionist</span></div>
              <button className="btn btn-primary btn-sm">Review</button>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div><span className="font-semibold">Stock Adjustment</span><br/><span className="opacity-60">Req. by Pharmacist</span></div>
              <button className="btn btn-primary btn-sm">Review</button>
            </div>
          </div>
        </div>
      </div>
      {/* ADD-ONLY: IPD & Emergency */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="font-bold mb-4">IPD Patient Flow</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><div className="text-2xl font-bold">12</div><div className="text-[13px] opacity-60 mt-1">Admissions</div></div>
            <div><div className="text-2xl font-bold">8</div><div className="text-[13px] opacity-60 mt-1">Discharges</div></div>
            <div><div className="text-2xl font-bold">3</div><div className="text-[13px] opacity-60 mt-1">Transfers</div></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="font-bold mb-4">Emergency Triage Status</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><div className="text-xl font-bold text-red-600">2</div><div className="text-xs opacity-60 mt-1">Critical</div></div>
            <div><div className="text-xl font-bold text-amber-500">4</div><div className="text-xs opacity-60 mt-1">High</div></div>
            <div><div className="text-xl font-bold text-blue-500">5</div><div className="text-xs opacity-60 mt-1">Medium</div></div>
            <div><div className="text-xl font-bold text-slate-500">1</div><div className="text-xs opacity-60 mt-1">Low</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ DOCTOR */
function DoctorDash() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [appts, setAppts] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const doctorId = user?.link?.doctorId;

  const load = async () => {
    setLoading(true);
    try {
      const a = await get(`/api/appointments?date=${todayISO()}${doctorId ? `&doctor_id=${doctorId}` : ''}`);
      setAppts(Array.isArray(a) ? a : []);
      const l = await get('/api/lab');
      setLabs((Array.isArray(l) ? l : []).filter((x: any) => !['Completed', 'Verified'].includes(x.status)).slice(0, 6));
    } catch { /* ignore */ }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const waiting = appts.filter((a) => ['Scheduled', 'Confirmed', 'Checked-in'].includes(a.status));
  const done = appts.filter((a) => a.status === 'Completed');

  const advance = async (a: any) => {
    const flow: Record<string, string> = { 'Scheduled': 'Confirmed', 'Confirmed': 'Checked-in', 'Checked-in': 'In consultation', 'In consultation': 'Completed' };
    const next = flow[a.status];
    if (!next) return;
    try {
      await post('/api/audit', { user_name: user!.name, user_role: 'Doctor', action: `Moved appointment #${a.id} to ${next}`, module: 'Appointments' });
      await put('/api/appointments', { id: a.id, status: next });
      toast({ kind: 'success', title: `Appointment ${next.toLowerCase()}`, desc: a.patient?.name });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update appointment', desc: e.message });
    }
  };

  if (loading) return <div className="space-y-4"><SkeletonCards /><div className="card p-5"><div className="skeleton h-40" /></div></div>;

  return (
    <div>
      <SectionHead title={`Good day, ${user?.name?.replace('Dr. ', 'Dr. ') || 'Doctor'}`}
        desc={`${waiting.length} patients waiting · ${done.length} consultations done · ${labs.length} lab reports pending review`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Today's appointments" value={appts.length} icon={<CalendarDays size={19} />} />
        <Stat label="Waiting now" value={waiting.length} icon={<Clock size={19} />} />
        <Stat label="Completed" value={done.length} icon={<CheckCircle2 size={19} />} />
        <Stat label="Pending lab reports" value={labs.length} icon={<FlaskConical size={19} />} />
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="card p-0 overflow-hidden lg:col-span-3">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <div className="font-bold">Today's queue</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/appointments')}>All appointments</button>
          </div>
          {appts.length === 0 ? <Empty title="No appointments today" desc="Your schedule is clear. New bookings from reception will appear here." /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {appts.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="text-center shrink-0 w-14">
                    <div className="text-sm font-bold">{fmtTime(a.time)}</div>
                    <div className="text-[11px] opacity-50">T-{a.token_number || a.id}</div>
                  </div>
                  <Avatar name={a.patient?.name} size={38} />
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => nav(`/app/patients/${a.patient_id}`)}>
                    <div className="font-bold text-sm truncate">{a.patient?.name || '—'}</div>
                    <div className="text-xs opacity-55">{a.appointment_type} · {a.department}</div>
                  </div>
                  <Badge status={a.status} />
                  <div className="flex gap-1.5 shrink-0">
                    {a.status !== 'Completed' && a.status !== 'Cancelled' && (
                      <button className="btn btn-primary btn-sm" onClick={() => advance(a)}>
                        {a.status === 'In consultation' ? 'Complete' : a.status === 'Checked-in' ? 'Start' : 'Next'}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/consult?patient=${a.patient_id}`)}>Consult</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">Lab reports to review</div>
              <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/lab')}>Open lab</button>
            </div>
            {labs.length === 0 ? <div className="text-sm opacity-55">Nothing pending. New results appear here automatically.</div> : (
              <div className="space-y-2.5">
                {labs.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 text-sm">
                    <FlaskConical size={15} className="opacity-50 shrink-0" />
                    <div className="min-w-0 flex-1"><span className="font-semibold">{l.test_name}</span> <span className="opacity-55">· {l.patient?.name}</span></div>
                    <Badge status={l.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-5">
            <div className="font-bold mb-3">Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-ghost" onClick={() => nav('/app/consult')}><HeartPulse size={16} /> New consultation</button>
              <button className="btn btn-ghost" onClick={() => nav('/app/patients')}><Users size={16} /> Find patient</button>
              <button className="btn btn-ghost" onClick={() => nav('/app/lab')}><FlaskConical size={16} /> Order test</button>
              <button className="btn btn-ghost" onClick={() => nav('/app/emergency')}><Siren size={16} /> Emergency</button>
            </div>
          </div>
        </div>
      </div>
      {/* ADD-ONLY: Assigned IPD Patients */}
      <div className="card p-0 overflow-hidden mt-4">
        <div className="px-5 py-4 border-b hairline flex items-center justify-between">
          <div className="font-bold">Assigned IPD Patients</div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/admissions')}>View all</button>
        </div>
        <div className="p-5 text-sm opacity-55">No IPD patients assigned to you currently.</div>
      </div>
    </div>
  );
}

/* ================================================================= NURSE */
function NurseDash() {
  const [adm, setAdm] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [a, v] = await Promise.all([get('/api/admissions?status=Admitted'), get('/api/vitals')]);
      setAdm(Array.isArray(a) ? a : []);
      setVitals(Array.isArray(v) ? v : []);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const critical = adm.filter((a) => a.condition === 'Critical' || a.condition === 'Serious');
  const [vForm, setVForm] = useState<any>({ patient_id: '', bp: '', pulse: '', temp: '', spo2: '', note: '' });

  const saveVitals = async () => {
    if (!vForm.patient_id || !vForm.bp) return toast({ kind: 'error', title: 'Patient and BP are required' });
    await post('/api/vitals', { ...vForm, patient_id: Number(vForm.patient_id), recorded_by: user!.name });
    await logAudit({ user_name: user!.name, user_role: 'Nurse', action: `Recorded vitals for patient #${vForm.patient_id}`, module: 'Nursing' });
    toast({ kind: 'success', title: 'Vitals recorded' });
    setVForm({ patient_id: '', bp: '', pulse: '', temp: '', spo2: '', note: '' });
    load();
  };

  if (loading) return <div className="space-y-4"><SkeletonCards /><div className="card p-5"><div className="skeleton h-40" /></div></div>;

  return (
    <div>
      <SectionHead title="Ward board" desc={`${adm.length} patients under care · ${critical.length} need close watch`} />
      {critical.length > 0 && (
        <div className="mb-4"><AlertBanner level="danger" text={`${critical.length} critical patient${critical.length > 1 ? 's' : ''} on the floor — review vitals and escalation notes.`} /></div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Admitted patients" value={adm.length} icon={<BedDouble size={19} />} />
        <Stat label="Critical / Serious" value={critical.length} icon={<AlertTriangle size={19} />} />
        <Stat label="Vitals recorded" value={vitals.length} icon={<HeartPulse size={19} />} />
        <Stat label="Wards covered" value={new Set(adm.map((a) => a.ward)).size} icon={<ClipboardList size={19} />} />
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="card p-0 overflow-hidden lg:col-span-3">
          <div className="px-5 py-4 border-b hairline font-bold">Patients under care</div>
          {adm.length === 0 ? <Empty title="No admitted patients" /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {adm.slice(0, 10).map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-center gap-3.5">
                  <Avatar name={a.patient?.name} size={38} />
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => nav(`/app/patients/${a.patient_id}`)}>
                    <div className="font-bold text-sm">{a.patient?.name} <span className="opacity-50 font-semibold">· {a.bed_number}</span></div>
                    <div className="text-xs opacity-55">{a.ward} · Dr. {a.doctor_name} · since {fmtDate(a.admission_date)}</div>
                  </div>
                  <Badge status={a.condition || 'Stable'} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="font-bold mb-1">Record vitals</div>
            <div className="text-xs opacity-55 mb-3">Logged against the patient's timeline instantly.</div>
            <div className="space-y-2.5">
              <select className="input" value={vForm.patient_id} onChange={(e) => setVForm({ ...vForm, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {adm.map((a) => <option key={a.id} value={a.patient_id}>{a.patient?.name} · {a.bed_number}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2.5">
                <input className="input" placeholder="BP (120/80)" value={vForm.bp} onChange={(e) => setVForm({ ...vForm, bp: e.target.value })} />
                <input className="input" placeholder="Pulse" value={vForm.pulse} onChange={(e) => setVForm({ ...vForm, pulse: e.target.value })} />
                <input className="input" placeholder="Temp (°F)" value={vForm.temp} onChange={(e) => setVForm({ ...vForm, temp: e.target.value })} />
                <input className="input" placeholder="SpO2 %" value={vForm.spo2} onChange={(e) => setVForm({ ...vForm, spo2: e.target.value })} />
              </div>
              <input className="input" placeholder="Note (optional)" value={vForm.note} onChange={(e) => setVForm({ ...vForm, note: e.target.value })} />
              <button className="btn btn-primary w-full" onClick={saveVitals}><HeartPulse size={16} /> Save vitals</button>
            </div>
          </div>
          <div className="card p-5">
            <div className="font-bold mb-3">Recent vitals</div>
            <div className="space-y-2.5 max-h-56 overflow-y-auto scroll-thin">
              {vitals.slice(0, 8).map((v) => (
                <div key={v.id} className="text-[13px] flex justify-between gap-2">
                  <span className="opacity-60">{v.bp} · {v.pulse || '—'} bpm · {v.spo2 || '—'}%</span>
                  <span className="opacity-45 shrink-0">{v.recorded_by?.split(' ')[0]} · {v.created_at ? new Date(v.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
              {vitals.length === 0 && <div className="text-sm opacity-55">No vitals recorded yet.</div>}
            </div>
          </div>
        </div>
      </div>
      {/* ADD-ONLY: Shift & Tasks */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="font-bold mb-4">My Shift Information</div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="opacity-60">Current Shift</span><span className="font-semibold">Morning (08:00 - 16:00)</span></div>
            <div className="flex justify-between"><span className="opacity-60">Duty Status</span><span className="font-semibold text-emerald-600">On Duty</span></div>
            <div className="flex justify-between"><span className="opacity-60">Assigned Wards</span><span className="font-semibold">General Ward A, ICU</span></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="font-bold mb-4">Medication & Nursing Tasks</div>
          <div className="text-sm space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-700" />
              <div className="flex-1"><span className="font-semibold">Administer IV Fluids</span> <span className="opacity-60">· Bed A12</span></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-700" />
              <div className="flex-1"><span className="font-semibold">Hourly Vitals Check</span> <span className="opacity-60">· ICU Bed 3</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================== RECEPTIONIST */
function ReceptionDash() {
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setAppts(await get(`/api/appointments?date=${todayISO()}`)); } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const waiting = appts.filter((a) => ['Scheduled', 'Confirmed'].includes(a.status));
  const checked = appts.filter((a) => a.status === 'Checked-in');

  const checkIn = async (a: any) => {
    try {
      await put('/api/appointments', { id: a.id, status: 'Checked-in' });
      await logAudit({ user_name: user!.name, user_role: 'Receptionist', action: `Checked in ${a.patient?.name} (token ${a.token_number || a.id})`, module: 'OPD' });
      toast({ kind: 'success', title: 'Patient checked in', desc: `${a.patient?.name} · Token ${a.token_number || a.id}` });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Check-in failed', desc: e.message });
    }
  };

  if (loading) return <div className="space-y-4"><SkeletonCards /><div className="card p-5"><div className="skeleton h-40" /></div></div>;

  return (
    <div>
      <SectionHead title="Front desk" desc="Today's flow at a glance — register, book, check in, admit."
        action={<>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/patients?new=1')}><UserPlus size={15} /> Register patient</button>
          <button className="btn btn-primary btn-sm" onClick={() => nav('/app/appointments?new=1')}><CalendarPlus size={15} /> Book appointment</button>
        </>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Today's appointments" value={appts.length} icon={<CalendarDays size={19} />} />
        <Stat label="Waiting to check in" value={waiting.length} icon={<Clock size={19} />} />
        <Stat label="Checked in" value={checked.length} icon={<LogIn size={19} />} />
        <Stat label="Completed" value={appts.filter((a) => a.status === 'Completed').length} icon={<CheckCircle2 size={19} />} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <button onClick={() => nav('/app/patients?new=1')} className="card p-5 text-left hover:shadow-lg transition-shadow group">
          <UserPlus size={20} className="text-med-600 dark:text-sky-300" />
          <div className="font-bold mt-3">Register patient</div>
          <div className="text-[13px] opacity-55 mt-0.5">New file in under a minute</div>
        </button>
        <button onClick={() => nav('/app/appointments?new=1')} className="card p-5 text-left hover:shadow-lg transition-shadow">
          <CalendarPlus size={20} className="text-med-600 dark:text-sky-300" />
          <div className="font-bold mt-3">Book appointment</div>
          <div className="text-[13px] opacity-55 mt-0.5">Department, doctor, slot</div>
        </button>
        <button onClick={() => nav('/app/admissions?new=1')} className="card p-5 text-left hover:shadow-lg transition-shadow">
          <BedDouble size={20} className="text-med-600 dark:text-sky-300" />
          <div className="font-bold mt-3">Admit / discharge</div>
          <div className="text-[13px] opacity-55 mt-0.5">Beds, wards, transfers</div>
        </button>
      </div>
      <div className="card p-0 overflow-hidden mt-4">
        <div className="px-5 py-4 border-b hairline flex items-center justify-between">
          <div className="font-bold">Arrivals today</div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/opd')}>Open OPD queue <ArrowRight size={14} /></button>
        </div>
        {appts.length === 0 ? <Empty title="No appointments today" desc="Book the first appointment to get the day started." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {appts.slice(0, 12).map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-3.5">
                <div className="text-sm font-bold w-16 shrink-0">{fmtTime(a.time)}</div>
                <Avatar name={a.patient?.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate">{a.patient?.name}</div>
                  <div className="text-xs opacity-55">{a.doctor?.name || a.department} · T-{a.token_number || a.id}</div>
                </div>
                <Badge status={a.status} />
                {(a.status === 'Scheduled' || a.status === 'Confirmed') && (
                  <button className="btn btn-teal btn-sm" onClick={() => checkIn(a)}><LogIn size={14} /> Check in</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <button onClick={() => nav('/app/admissions?new=1')} className="btn btn-ghost !py-3"><LogOut size={16} /> Discharge a patient</button>
        <button onClick={() => nav('/app/billing?new=1')} className="btn btn-ghost !py-3"><Receipt size={16} /> Generate a bill</button>
      </div>
      {/* ADD-ONLY: Reception Additional */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="font-bold mb-3">Token & Queue Management</div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="opacity-60">Current Token</span><span className="font-bold">T-42</span></div>
            <div className="flex justify-between"><span className="opacity-60">Next Token</span><span className="font-bold">T-43</span></div>
          </div>
          <button className="btn btn-ghost btn-sm w-full mt-3">Call Next Patient</button>
        </div>
        <div className="card p-5">
          <div className="font-bold mb-3">Requests & Alerts</div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="opacity-60">Admission Requests</span><span className="font-bold text-med-600 dark:text-sky-400">3 Pending</span></div>
            <div className="flex justify-between"><span className="opacity-60">Duplicate Warnings</span><span className="font-bold text-red-500">1 Match found</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================= PHARMACIST */
function PharmacyDash() {
  const [rx, setRx] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([get('/api/prescriptions'), get('/api/medicines')]);
      setRx(Array.isArray(r) ? r : []);
      setMeds(Array.isArray(m) ? m : []);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const pending = rx.filter((r) => r.status === 'Pending');
  const low = meds.filter((m) => Number(m.stock_quantity) <= Number(m.reorder_level));

  const dispense = async (r: any) => {
    try {
      await put('/api/prescriptions', { id: r.id, status: 'Dispensed' });
      await logAudit({ user_name: user!.name, user_role: 'Pharmacist', action: `Dispensed prescription #${r.id} for ${r.patient?.name}`, module: 'Pharmacy' });
      toast({ kind: 'success', title: 'Prescription dispensed', desc: r.patient?.name });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Dispense failed', desc: e.message });
    }
  };

  if (loading) return <div className="space-y-4"><SkeletonCards /></div>;

  return (
    <div>
      <SectionHead title="Dispensary" desc={`${pending.length} prescriptions waiting · ${low.length} items low on stock`} />
      {low.length > 0 && <div className="mb-4"><AlertBanner level="warning" text={`${low.length} medicines at or below reorder level — raise a purchase order from Inventory.`} /></div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Pending prescriptions" value={pending.length} icon={<Pill size={19} />} />
        <Stat label="Dispensed" value={rx.filter((r) => r.status === 'Dispensed').length} icon={<CheckCircle2 size={19} />} />
        <Stat label="Medicines in stock" value={meds.length} icon={<ClipboardList size={19} />} />
        <Stat label="Low stock alerts" value={low.length} icon={<AlertTriangle size={19} />} />
      </div>
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="card p-0 overflow-hidden lg:col-span-3">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <div className="font-bold">Prescription queue</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/pharmacy')}>Open pharmacy</button>
          </div>
          {pending.length === 0 ? <Empty title="Queue is clear" desc="New prescriptions from doctors will appear here instantly." /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending.slice(0, 8).map((r) => (
                <div key={r.id} className="px-5 py-3.5 flex items-center gap-3">
                  <Avatar name={r.patient?.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{r.patient?.name} <span className="opacity-50 font-semibold">· {r.doctor_name}</span></div>
                    <div className="text-xs opacity-55 truncate">{(r.items || []).map((i: any) => i.medicine).join(', ') || r.diagnosis}</div>
                  </div>
                  <button className="btn btn-primary btn-sm shrink-0" onClick={() => dispense(r)}>Dispense</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5 lg:col-span-2">
          <div className="font-bold mb-3">Stock watchlist</div>
          {low.length === 0 ? <div className="text-sm opacity-55">All stock levels healthy.</div> : (
            <div className="space-y-3">
              {low.slice(0, 7).map((m) => (
                <div key={m.id}>
                  <div className="flex justify-between text-[13px] mb-1"><span className="font-semibold">{m.name}</span><span className="opacity-60">{m.stock_quantity} left</span></div>
                  <Meter value={Number(m.stock_quantity)} max={Math.max(Number(m.reorder_level) * 2, 1)} color={Number(m.stock_quantity) === 0 ? '#b4232a' : '#d99a0b'} />
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm w-full mt-4" onClick={() => nav('/app/inventory')}>Manage inventory</button>
        </div>
      </div>
      {/* ADD-ONLY: Pharmacy Additional */}
      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Today's Sales</div>
          <div className="text-[24px] font-bold mt-1">₹14,500</div>
          <div className="text-xs opacity-60 mt-1">Across 42 bills</div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Returns & Adjustments</div>
          <div className="text-[24px] font-bold mt-1 text-red-500">2 Items</div>
          <div className="text-xs opacity-60 mt-1">Pending verification</div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Stock Movement</div>
          <div className="text-[24px] font-bold mt-1">128 Units</div>
          <div className="text-xs opacity-60 mt-1">Dispensed today</div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== LAB */
function LabDash() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try { setTests(await get('/api/lab')); } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const byStatus = (s: string) => tests.filter((t) => t.status === s);
  const counts = [
    { label: 'Ordered', value: byStatus('Ordered').length, color: '#1470cc' },
    { label: 'Sample collected', value: byStatus('Sample Collected').length, color: '#6a3fd4' },
    { label: 'Processing', value: byStatus('Processing').length, color: '#d99a0b' },
    { label: 'Verified', value: tests.filter((t) => ['Verified', 'Completed'].includes(t.status)).length, color: '#0d9488' },
  ];

  if (loading) return <div className="space-y-4"><SkeletonCards /></div>;

  return (
    <div>
      <SectionHead title="Lab bench" desc="Every order, from sample to verified report."
        action={<button className="btn btn-primary btn-sm" onClick={() => nav('/app/lab')}>Open test orders <ArrowRight size={14} /></button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {counts.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><span className="text-[13px] font-medium opacity-60">{c.label}</span></div>
            <div className="text-[26px] font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b hairline font-bold">Needs attention first</div>
        {tests.filter((t) => !['Verified', 'Completed'].includes(t.status)).length === 0
          ? <Empty title="All caught up" desc="Every ordered test has a verified report." />
          : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tests.filter((t) => !['Verified', 'Completed'].includes(t.status)).slice(0, 10).map((t) => (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                  <FlaskConical size={17} className="opacity-50 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{t.test_name} <span className="opacity-50 font-semibold">· {t.patient?.name}</span></div>
                    <div className="text-xs opacity-55">Ordered by {t.ordered_by || '—'} · {fmtDate(t.ordered_date)}</div>
                  </div>
                  <Badge status={t.status} />
                  <button className="btn btn-ghost btn-sm shrink-0" onClick={() => nav('/app/lab')}>Process</button>
                </div>
              ))}
            </div>
          )}
      </div>
      {/* ADD-ONLY: Lab Additional */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="font-bold mb-3">Today's Workload</div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="opacity-60">Samples Awaiting Collection</span><span className="font-bold">5</span></div>
            <div className="flex justify-between"><span className="opacity-60">Reports Pending Verification</span><span className="font-bold">2</span></div>
            <div className="flex justify-between"><span className="opacity-60">Completed Reports</span><span className="font-bold">18</span></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="font-bold mb-3 text-red-600 dark:text-red-400">Critical Results</div>
          <div className="text-sm opacity-55">No critical values detected in today's batches.</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================= ACCOUNTANT */
function AccountantDash() {
  const [inv, setInv] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [i, c] = await Promise.all([get('/api/invoices'), get('/api/insurance')]);
      setInv(Array.isArray(i) ? i : []);
      setClaims(Array.isArray(c) ? c : []);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const collected = inv.reduce((s, r) => s + Number(r.paid || 0), 0);
  const outstanding = inv.reduce((s, r) => s + Number(r.balance || 0), 0);

  if (loading) return <div className="space-y-4"><SkeletonCards /></div>;

  return (
    <div>
      <SectionHead title="Finance overview" desc="Collections, outstanding balances and insurance claims."
        action={<button className="btn btn-primary btn-sm" onClick={() => nav('/app/billing?new=1')}><Receipt size={15} /> New invoice</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Revenue collected" value={inr(collected)} icon={<IndianRupee size={19} />} />
        <Stat label="Outstanding" value={inr(outstanding)} sub={`${inv.filter((i) => i.status !== 'Paid').length} open invoices`} icon={<Receipt size={19} />} />
        <Stat label="Insurance claims" value={claims.length} sub={`${claims.filter((c) => ['Submitted', 'Under Review'].includes(c.status)).length} in review`} icon={<Users size={19} />} />
        <Stat label="Invoices" value={inv.length} icon={<ClipboardList size={19} />} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <div className="font-bold">Recent invoices</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/billing')}>Open billing</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {inv.slice(0, 7).map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm">{r.invoice_number} <span className="opacity-50 font-semibold">· {r.patient?.name}</span></div>
                  <div className="text-xs opacity-55">{inr(r.total)} · paid {inr(r.paid)}</div>
                </div>
                <Badge status={r.status} />
              </div>
            ))}
            {inv.length === 0 && <Empty title="No invoices yet" />}
          </div>
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <div className="font-bold">Insurance claims</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/insurance')}>Open claims</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {claims.slice(0, 7).map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm">{c.provider} <span className="opacity-50 font-semibold">· {c.patient?.name}</span></div>
                  <div className="text-xs opacity-55">{inr(c.claim_amount)} · {c.policy_number}</div>
                </div>
                <Badge status={c.status} />
              </div>
            ))}
            {claims.length === 0 && <Empty title="No claims filed" />}
          </div>
        </div>
      </div>
      {/* ADD-ONLY: Accountant Additional */}
      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Payment Methods (Today)</div>
          <div className="text-sm space-y-1 mt-2">
            <div className="flex justify-between"><span className="opacity-60">Cash</span><span className="font-semibold">₹12,000</span></div>
            <div className="flex justify-between"><span className="opacity-60">UPI</span><span className="font-semibold">₹45,500</span></div>
            <div className="flex justify-between"><span className="opacity-60">Card</span><span className="font-semibold">₹18,200</span></div>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Refund Requests</div>
          <div className="text-[24px] font-bold mt-1 text-red-500">1</div>
          <div className="text-xs opacity-60 mt-1">Pending approval</div>
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Discount Approvals</div>
          <div className="text-[24px] font-bold mt-1 text-med-600 dark:text-sky-400">3</div>
          <div className="text-xs opacity-60 mt-1">Awaiting admin review</div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ PATIENT */
function PatientDash() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [appts, setAppts] = useState<any[]>([]);
  const [rx, setRx] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pid = user?.link?.patientId;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let id = pid;
        if (!id && user?.email) {
          const mine = await get(`/api/patients?user_email=${encodeURIComponent(user.email)}`);
          if (Array.isArray(mine) && mine[0]) id = mine[0].id;
        }
        if (id) {
          const [all, r, l, b] = await Promise.all([
            get(`/api/appointments?patient_id=${id}`),
            get(`/api/prescriptions?patient_id=${id}`),
            get(`/api/lab?patient_id=${id}`),
            get(`/api/invoices?patient_id=${id}`),
          ]);
          setAppts(Array.isArray(all) ? all : []);
          setRx(Array.isArray(r) ? r : []);
          setLabs(Array.isArray(l) ? l : []);
          setBills(Array.isArray(b) ? b : []);
          const plist = await get('/api/patients');
          setMe((Array.isArray(plist) ? plist : []).find((p: any) => p.id === id) || null);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  if (loading) return <div className="space-y-4"><SkeletonCards /></div>;

  const upcoming = appts.filter((a) => !['Completed', 'Cancelled', 'No-show'].includes(a.status)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const next = upcoming[0];
  const due = bills.filter((b) => b.status !== 'Paid');

  return (
    <div>
      <div className="rounded-2xl overflow-hidden relative mb-4">
        <img src="/media/consultation.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(11,28,44,.92) 20%, rgba(11,28,44,.55) 60%, rgba(11,28,44,.25) 100%)' }} />
        <div className="relative p-6 sm:p-8">
          <div className="eyebrow text-teal-300 mb-2">Welcome to AbhiShree Hospital</div>
          <h1 className="font-display text-3xl sm:text-4xl text-white">Hello, {me?.name?.split(' ')[0] || user?.name?.split(' ')[0]}</h1>
          <p className="text-white/65 mt-1.5 text-sm max-w-md">Your appointments, reports, prescriptions and bills — all in one calm place.</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button className="btn btn-sm !bg-white !text-ink-950 font-bold" onClick={() => nav('/app/my/appointments')}><CalendarPlus size={15} /> Book appointment</button>
            <button className="btn btn-sm !bg-white/15 !text-white border !border-white/25" onClick={() => nav('/app/my/records')}>View my records</button>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Next appointment</div>
          {next ? (
            <><div className="font-bold mt-1.5">{next.doctor?.name || next.department}</div>
            <div className="text-sm opacity-60">{fmtDate(next.date)} · {fmtTime(next.time)}</div>
            <div className="mt-2"><Badge status={next.status} /></div></>
          ) : <div className="text-sm opacity-55 mt-1.5">Nothing scheduled.</div>}
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Latest prescription</div>
          {rx[0] ? (
            <><div className="font-bold mt-1.5">{rx[0].doctor_name}</div>
            <div className="text-sm opacity-60 truncate">{(rx[0].items || []).map((i: any) => i.medicine).join(', ') || '—'}</div>
            <div className="mt-2"><Badge status={rx[0].status} /></div></>
          ) : <div className="text-sm opacity-55 mt-1.5">No prescriptions yet.</div>}
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Latest lab report</div>
          {labs[0] ? (
            <><div className="font-bold mt-1.5">{labs[0].test_name}</div>
            <div className="text-sm opacity-60">{fmtDate(labs[0].ordered_date)}</div>
            <div className="mt-2"><Badge status={labs[0].status} /></div></>
          ) : <div className="text-sm opacity-55 mt-1.5">No reports yet.</div>}
        </div>
        <div className="card p-5">
          <div className="text-[13px] opacity-55 font-medium">Outstanding bills</div>
          <div className="text-[26px] font-bold mt-1">{inr(due.reduce((s, b) => s + Number(b.balance || 0), 0))}</div>
          <div className="text-sm opacity-60">{due.length} open invoice{due.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <div className="font-bold">Upcoming visits</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/my/appointments')}>Manage</button>
          </div>
          {upcoming.length === 0 ? <Empty title="No upcoming visits" desc="Book an appointment whenever you're ready." /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcoming.slice(0, 5).map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <Stethoscope size={16} className="opacity-50" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{a.doctor?.name || a.department}</div>
                    <div className="text-xs opacity-55">{fmtDate(a.date)} · {fmtTime(a.time)} · {a.appointment_type}</div>
                  </div>
                  <Badge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b hairline flex items-center justify-between">
            <div className="font-bold">Recent activity</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/my/records')}>Full timeline</button>
          </div>
          <div className="p-5 space-y-4">
            {appts.slice(0, 2).map((a) => (
              <div key={'a' + a.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-med-500 mt-1.5 shrink-0" />
                <div><span className="font-semibold">Visit:</span> {a.doctor?.name || a.department} <span className="opacity-55">· {fmtDate(a.date)}</span></div>
              </div>
            ))}
            {labs.slice(0, 2).map((l) => (
              <div key={'l' + l.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <div><span className="font-semibold">Test:</span> {l.test_name} <span className="opacity-55">· {l.status}</span></div>
              </div>
            ))}
            {rx.slice(0, 2).map((r) => (
              <div key={'r' + r.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <div><span className="font-semibold">Prescription</span> <span className="opacity-55">· {r.doctor_name} · {fmtDate(r.created_at)}</span></div>
              </div>
            ))}
            {appts.length + labs.length + rx.length === 0 && <div className="text-sm opacity-55">Your hospital activity will appear here.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== ROUTER */
export default function Dashboard() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'Admin': return <AdminDash />;
    case 'Doctor': return <DoctorDash />;
    case 'Nurse': return <NurseDash />;
    case 'Receptionist': return <ReceptionDash />;
    case 'Pharmacist': return <PharmacyDash />;
    case 'Lab Technician': return <LabDash />;
    case 'Accountant': return <AccountantDash />;
    case 'Patient': return <PatientDash />;
    default: return <AdminDash />;
  }
}
