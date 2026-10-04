import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { get, post, put, fmtTime, fmtDate, todayISO } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SkeletonRows, SectionHead, Avatar } from '../components/ui';

const STATUSES = ['Scheduled', 'Confirmed', 'Checked-in', 'In consultation', 'Completed', 'Cancelled', 'No-show'];
const TYPES = ['New visit', 'Follow-up', 'Review', 'Emergency', 'Procedure'];

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Appointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [day, setDay] = useState(todayISO());
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patient_id: params.get('patient') || '', doctor_id: '', date: todayISO(), time: '10:00', appointment_type: 'New visit', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canBook = !['Patient', 'Pharmacist', 'Lab Technician', 'Accountant'].includes(user?.role || '');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [a, p, d] = await Promise.all([get('/api/appointments'), get('/api/patients'), get('/api/doctors')]);
      setRows(Array.isArray(a) ? a : []);
      setPatients(Array.isArray(p) ? p : []);
      setDoctors((Array.isArray(d) ? d : []).filter((x: any) => x.status === 'Available'));
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, []);

  const dayRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.date !== day) return false;
      if (statusF && r.status !== statusF) return false;
      if (user?.role === 'Doctor' && user?.link?.doctorId && Number(r.doctor_id) !== Number(user.link.doctorId)) return false;
      if (!needle) return true;
      return [r.patient?.name, r.doctor?.name, r.department].filter(Boolean).join(' ').toLowerCase().includes(needle);
    }).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }, [rows, day, q, statusF, user]);

  const setStatus = async (a: any, status: string) => {
    try {
      await put('/api/appointments', { id: a.id, status });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Set appointment #${a.id} (${a.patient?.name}) to ${status}`, module: 'Appointments' });
      toast({ kind: 'success', title: `Marked ${status.toLowerCase()}`, desc: a.patient?.name });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update appointment', desc: e.message });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.patient_id) e.patient_id = 'Choose a patient.';
    if (!form.doctor_id) e.doctor_id = 'Choose a doctor.';
    if (!form.date) e.date = 'Pick a date.';
    if (!form.time) e.time = 'Pick a time.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const doc = doctors.find((d) => String(d.id) === String(form.doctor_id));
      const sameDay = rows.filter((r) => r.date === form.date).length;
      await post('/api/appointments', {
        patient_id: Number(form.patient_id),
        doctor_id: Number(form.doctor_id),
        department: doc?.department || doc?.specialty || 'General',
        date: form.date,
        time: form.time,
        appointment_type: form.appointment_type,
        reason: form.reason || null,
        status: 'Scheduled',
        token_number: sameDay + 1,
        created_by: user!.name,
      });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Booked appointment for patient #${form.patient_id} on ${form.date}`, module: 'Appointments' });
      await post('/api/notifications', { type: 'Appointment', title: 'New appointment booked', message: `${doc?.name} · ${fmtDate(form.date)} ${fmtTime(form.time)}`, target_role: 'Doctor' });
      toast({ kind: 'success', title: 'Appointment booked', desc: `${fmtDate(form.date)} · ${fmtTime(form.time)}` });
      setShowNew(false);
      setDay(form.date);
      setForm({ patient_id: '', doctor_id: '', date: form.date, time: '10:00', appointment_type: 'New visit', reason: '' });
      load();
    } catch (e: any) { toast({ kind: 'error', title: 'Booking failed', desc: e.message }); }
    setSaving(false);
  };

  const weekDays = useMemo(() => {
    const d = new Date(day + 'T00:00:00');
    const monday = addDays(day, -((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }).map((_, i) => addDays(monday, i));
  }, [day]);

  return (
    <div>
      <SectionHead title="Appointments" desc="Day schedule with live status workflow."
        action={canBook ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> Book appointment</button> : undefined} />

      {/* week strip */}
      <div className="card p-3 mb-4">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm !px-2" onClick={() => setDay(addDays(day, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const count = rows.filter((r) => r.date === d).length;
              const active = d === day;
              const dt = new Date(d + 'T00:00:00');
              return (
                <button key={d} onClick={() => setDay(d)}
                  className={`rounded-xl py-2 px-1 text-center transition-all ${active ? 'bg-ink-900 text-white dark:bg-sky-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} ${d === todayISO() && !active ? 'ring-1 ring-med-500' : ''}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'opacity-70' : 'opacity-50'}`}>{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  <div className="text-[15px] font-bold leading-tight">{dt.getDate()}</div>
                  <div className={`text-[10px] font-semibold ${active ? 'opacity-70' : 'opacity-45'}`}>{count} appt</div>
                </button>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-sm !px-2" onClick={() => setDay(addDays(day, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input className="input !pl-10" placeholder="Search this day's schedule…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {day !== todayISO() && <button className="btn btn-ghost" onClick={() => setDay(todayISO())}>Today</button>}
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={7} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : dayRows.length === 0 ? <div className="card"><Empty title={`No appointments on ${fmtDate(day)}`} desc="Bookings for this day will show up here." action={canBook ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> Book appointment</button> : undefined} /></div>
        : (
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dayRows.map((a) => (
                <div key={a.id} className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-3">
                  <div className="w-16 shrink-0">
                    <div className="text-[15px] font-bold">{fmtTime(a.time)}</div>
                    <div className="text-[11px] opacity-50 font-semibold">Token {a.token_number || a.id}</div>
                  </div>
                  <Avatar name={a.patient?.name} size={38} />
                  <div className="min-w-0 flex-1 basis-40 cursor-pointer" onClick={() => nav(`/app/patients/${a.patient_id}`)}>
                    <div className="font-bold text-sm truncate">{a.patient?.name}</div>
                    <div className="text-xs opacity-55 truncate">{a.doctor?.name || '—'} · {a.department} · {a.appointment_type}</div>
                  </div>
                  <Badge status={a.status} />
                  {canBook && (
                    <select className="input !w-auto !py-1.5 !text-[13px]" value={a.status} onChange={(e) => setStatus(a, e.target.value)} aria-label="Change status">
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {showNew && (
        <Modal title="Book appointment" subtitle="Pick a patient, doctor and slot." onClose={() => setShowNew(false)}>
          <div className="space-y-4">
            <Field label="Patient" required error={errors.patient_id}>
              <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.patient_id}</option>)}
              </select>
            </Field>
            <Field label="Doctor" required error={errors.doctor_id}>
              <select className="input" value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Select doctor…</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.specialty}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" required error={errors.date}>
                <input type="date" className="input" value={form.date} min={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Time" required error={errors.time}>
                <input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </Field>
            </div>
            <Field label="Visit type">
              <select className="input" value={form.appointment_type} onChange={(e) => setForm({ ...form, appointment_type: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Reason for visit">
              <input className="input" placeholder="e.g. Chest pain, routine review…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Booking…' : 'Book appointment'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
