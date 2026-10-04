import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, CalendarPlus, FlaskConical, Pill, Receipt, Phone, MapPin, Droplet, ShieldCheck, HeartPulse } from 'lucide-react';
import { get, put, fmtDate, fmtTime, inr, logAudit } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Badge, Modal, Field, Empty, LoadError, Avatar } from '../components/ui';

type Tab = 'overview' | 'visits' | 'prescriptions' | 'lab' | 'billing';

export default function PatientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [p, setP] = useState<any>(null);
  const [appts, setAppts] = useState<any[]>([]);
  const [rx, setRx] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const canEdit = user && !['Patient', 'Accountant'].includes(user.role);
  const isOwn = user?.role === 'Patient' && String(user?.link?.patientId) === String(id);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [plist, a, r, l, b, v] = await Promise.all([
        get('/api/patients'),
        get(`/api/appointments?patient_id=${id}`),
        get(`/api/prescriptions?patient_id=${id}`),
        get(`/api/lab?patient_id=${id}`),
        get(`/api/invoices?patient_id=${id}`),
        get(`/api/vitals?patient_id=${id}`),
      ]);
      const found = (Array.isArray(plist) ? plist : []).find((x: any) => String(x.id) === String(id));
      if (!found) throw new Error('Patient record not found.');
      setP(found);
      setForm(found);
      setAppts(Array.isArray(a) ? a : []);
      setRx(Array.isArray(r) ? r : []);
      setLabs(Array.isArray(l) ? l : []);
      setBills(Array.isArray(b) ? b : []);
      setVitals(Array.isArray(v) ? v : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    if (!form.name?.trim()) return toast({ kind: 'error', title: 'Name is required' });
    setSaving(true);
    try {
      await put('/api/patients', { ...form, id: p.id });
      await logAudit({ user_name: user!.name, user_role: user!.role, action: `Updated patient record: ${form.name}`, module: 'Patients' });
      toast({ kind: 'success', title: 'Patient record updated' });
      setEditOpen(false);
      load();
    } catch (e: any) { toast({ kind: 'error', title: 'Update failed', desc: e.message }); }
    setSaving(false);
  };

  if (loading) return <div className="space-y-4"><div className="card p-6 flex gap-4"><div className="skeleton w-16 h-16 !rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-6 w-1/3" /><div className="skeleton h-4 w-1/2" /></div></div><div className="card p-5"><div className="skeleton h-48" /></div></div>;
  if (err || !p) return <div className="card"><LoadError message={err || 'Not found'} onRetry={load} /></div>;

  const due = bills.filter((b) => b.status !== 'Paid').reduce((s, b) => s + Number(b.balance || 0), 0);
  const lastVitals = vitals[0];

  // chronological timeline
  const timeline: any[] = [
    ...appts.map((a) => ({ date: a.date, kind: 'Visit', title: `${a.appointment_type || 'Appointment'} — ${a.doctor?.name || a.department}`, sub: `${fmtTime(a.time)} · ${a.status}`, color: '#1470cc' })),
    ...labs.map((l) => ({ date: l.ordered_date, kind: 'Lab', title: l.test_name, sub: `${l.status}${l.result ? ` · ${l.result}` : ''}`, color: '#0d9488' })),
    ...rx.map((r) => ({ date: (r.created_at || '').slice(0, 10), kind: 'Prescription', title: (r.items || []).map((i: any) => i.medicine).join(', ') || r.diagnosis || 'Prescription', sub: `${r.doctor_name} · ${r.status}`, color: '#6a3fd4' })),
    ...bills.map((b) => ({ date: (b.created_at || '').slice(0, 10), kind: 'Bill', title: `${b.invoice_number} — ${inr(b.total)}`, sub: b.status, color: '#9a6b0a' })),
  ].filter((t) => t.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'visits', label: `Appointments (${appts.length})` },
    { key: 'prescriptions', label: `Prescriptions (${rx.length})` },
    { key: 'lab', label: `Lab reports (${labs.length})` },
    { key: 'billing', label: `Billing (${bills.length})` },
  ];

  return (
    <div>
      <button onClick={() => nav(-1)} className="btn btn-ghost btn-sm mb-4"><ArrowLeft size={15} /> Back</button>

      {/* header card */}
      <div className="card p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={p.name} size={60} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{p.name}</h1>
              <Badge status={p.status} />
              {p.blood_group && <span className="badge b-red"><Droplet size={11} /> {p.blood_group}</span>}
            </div>
            <div className="text-sm opacity-60 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-mono">{p.patient_id}</span>
              <span>{p.age}y · {p.gender}</span>
              <span className="flex items-center gap-1"><Phone size={12} /> {p.phone}</span>
              {p.address && <span className="flex items-center gap-1"><MapPin size={12} /> {p.address}</span>}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm(p); setEditOpen(true); }}><Pencil size={14} /> Edit</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">Emergency contact</div>
            <div className="text-sm font-semibold mt-1">{p.emergency_contact || '—'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">Insurance</div>
            <div className="text-sm font-semibold mt-1 flex items-center gap-1.5">{p.insurance_provider ? <><ShieldCheck size={14} className="text-teal-600" /> {p.insurance_provider}</> : 'Self-pay'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">Last vitals</div>
            <div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><HeartPulse size={14} className="text-red-500" /> {lastVitals ? `${lastVitals.bp} · ${lastVitals.pulse || '—'} bpm` : 'Not recorded'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">Outstanding balance</div>
            <div className={`text-sm font-bold mt-1 ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{inr(due)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">Registered</div>
            <div className="text-sm font-semibold mt-1">{fmtDate(p.registration_date)}</div>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t hairline">
            <button className="btn btn-primary btn-sm" onClick={() => nav(`/app/appointments?new=1&patient=${p.id}`)}><CalendarPlus size={14} /> Book appointment</button>
            {(user?.role === 'Doctor' || user?.role === 'Admin') && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/consult?patient=${p.id}`)}><Pill size={14} /> Consult & prescribe</button>}
            {(user?.role === 'Doctor' || user?.role === 'Admin' || user?.role === 'Lab Technician') && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/lab?new=1&patient=${p.id}`)}><FlaskConical size={14} /> Order test</button>}
            {(user?.role === 'Receptionist' || user?.role === 'Admin') && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/admissions?new=1&patient=${p.id}`)}>Admit patient</button>}
            {(user?.role === 'Accountant' || user?.role === 'Admin' || user?.role === 'Receptionist') && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/billing?new=1&patient=${p.id}`)}><Receipt size={14} /> New bill</button>}
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="font-bold mb-1">Medical timeline</div>
            <div className="text-xs opacity-55 mb-4">Every visit, test, prescription and bill — newest first.</div>
            {timeline.length === 0 ? <Empty title="No history yet" desc="Visits, tests and prescriptions will build this timeline automatically." /> : (
              <div className="space-y-0 max-h-[480px] overflow-y-auto scroll-thin pr-1">
                {timeline.map((t, i) => (
                  <div key={i} className="flex gap-3.5 pb-5 relative">
                    {i < timeline.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />}
                    <span className="w-[11px] h-[11px] rounded-full mt-1 shrink-0 ring-4 ring-slate-100 dark:ring-slate-800" style={{ background: t.color }} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">{t.kind} · {fmtDate(t.date)}</div>
                      <div className="text-sm font-semibold mt-0.5">{t.title}</div>
                      <div className="text-[13px] opacity-60">{t.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <div className="font-bold mb-3">Vitals history</div>
              {vitals.length === 0 ? <div className="text-sm opacity-55">No vitals recorded yet.</div> : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto scroll-thin">
                  {vitals.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-sm gap-2">
                      <span className="font-semibold">BP {v.bp} · Pulse {v.pulse || '—'} · SpO2 {v.spo2 || '—'}%</span>
                      <span className="text-xs opacity-50 shrink-0">{v.created_at ? new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <div className="font-bold mb-3">Allergies & conditions</div>
              <div className="text-sm space-y-2">
                <div><span className="opacity-55">Allergies: </span><span className="font-semibold">{p.allergies || 'None recorded'}</span></div>
                <div><span className="opacity-55">Conditions: </span><span className="font-semibold">{p.conditions || 'None recorded'}</span></div>
                <div><span className="opacity-55">Family History: </span><span className="font-semibold">{p.family_history || 'None recorded'}</span></div>
              </div>
              {canEdit && <button className="btn btn-ghost btn-sm mt-3" onClick={() => { setForm(p); setEditOpen(true); }}>Update medical notes</button>}
            </div>
          </div>
        </div>
      )}

      {tab === 'visits' && (
        <div className="card p-0 overflow-hidden">
          {appts.length === 0 ? <Empty title="No appointments" desc="Book the first visit for this patient." /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {appts.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-14 text-center shrink-0"><div className="text-sm font-bold">{fmtTime(a.time)}</div><div className="text-[11px] opacity-50">{fmtDate(a.date)}</div></div>
                  <div className="flex-1 min-w-0"><div className="font-bold text-sm">{a.doctor?.name || a.department}</div><div className="text-xs opacity-55">{a.appointment_type} · Token {a.token_number || a.id}</div></div>
                  <Badge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'prescriptions' && (
        <div className="space-y-3">
          {rx.length === 0 && <div className="card"><Empty title="No prescriptions" /></div>}
          {rx.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="font-bold">{r.doctor_name} <span className="opacity-50 font-semibold text-sm">· {fmtDate((r.created_at || '').slice(0, 10))}</span></div>
                <Badge status={r.status} />
              </div>
              {r.diagnosis && <div className="text-sm mb-2"><span className="opacity-55">Diagnosis: </span><span className="font-semibold">{r.diagnosis}</span></div>}
              <div className="table-wrap !border-0">
                <table className="grid-table">
                  <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
                  <tbody>{(r.items || []).map((it: any, i: number) => (
                    <tr key={i}><td className="font-semibold">{it.medicine}</td><td>{it.dose}</td><td>{it.frequency}</td><td>{it.duration}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              {r.instructions && <div className="text-[13px] opacity-65 mt-2">Instructions: {r.instructions}</div>}
              {isOwn || canEdit ? <button className="btn btn-ghost btn-sm mt-3" onClick={() => nav(`/app/prescription/${r.id}`)}>View printable prescription</button> : null}
            </div>
          ))}
        </div>
      )}

      {tab === 'lab' && (
        <div className="card p-0 overflow-hidden">
          {labs.length === 0 ? <Empty title="No lab tests" /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {labs.map((l) => (
                <div key={l.id} className="px-5 py-3.5 flex items-center gap-3">
                  <FlaskConical size={17} className="opacity-50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{l.test_name}</div>
                    <div className="text-xs opacity-55">Ordered {fmtDate(l.ordered_date)} by {l.ordered_by || '—'}{l.result ? ` · Result: ${l.result}` : ''}</div>
                  </div>
                  <Badge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'billing' && (
        <div className="card p-0 overflow-hidden">
          {bills.length === 0 ? <Empty title="No bills" /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {bills.map((b) => (
                <div key={b.id} className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => nav(`/app/invoice/${b.id}`)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{b.invoice_number}</div>
                    <div className="text-xs opacity-55">{inr(b.total)} · paid {inr(b.paid)} · balance {inr(b.balance)}</div>
                  </div>
                  <Badge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editOpen && (
        <Modal title="Edit patient" subtitle={p.patient_id} onClose={() => setEditOpen(false)} wide>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" required><input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Age"><input type="number" className="input" value={form.age || ''} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} /></Field>
              <Field label="Gender"><select className="input" value={form.gender || 'Male'} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option>Male</option><option>Female</option><option>Other</option></select></Field>
            </div>
            <Field label="Phone"><input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Blood group"><input className="input" value={form.blood_group || ''} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} /></Field>
            <Field label="Emergency contact"><input className="input" value={form.emergency_contact || ''} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Address"><input className="input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></div>
            <Field label="Allergies"><input className="input" placeholder="e.g. Penicillin" value={form.allergies || ''} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></Field>
            <Field label="Conditions"><input className="input" placeholder="e.g. Hypertension, Type-2 diabetes" value={form.conditions || ''} onChange={(e) => setForm({ ...form, conditions: e.target.value })} /></Field>
            <Field label="Family History"><input className="input" placeholder="e.g. Heart disease" value={form.family_history || ''} onChange={(e) => setForm({ ...form, family_history: e.target.value })} /></Field>
            <Field label="Insurance provider"><input className="input" value={form.insurance_provider || ''} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} /></Field>
            <Field label="Policy number"><input className="input" value={form.insurance_policy || ''} onChange={(e) => setForm({ ...form, insurance_policy: e.target.value })} /></Field>
            <Field label="Status"><select className="input" value={form.status || 'Active'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Active</option><option>Admitted</option><option>Discharged</option><option>Inactive</option></select></Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
