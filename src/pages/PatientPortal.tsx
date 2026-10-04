import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Pill, FlaskConical, Receipt, FileText, Stethoscope } from 'lucide-react';
import { get, post, put, fmtDate, fmtTime, inr, todayISO } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, SkeletonRows, SectionHead } from '../components/ui';

function useMyPatient() {
  const { user } = useAuth();
  const [pid, setPid] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      setReady(false);
      try {
        if (user?.link?.patientId) { setPid(Number(user.link.patientId)); setReady(true); return; }
        const plist = await get('/api/patients');
        const match = (Array.isArray(plist) ? plist : []).find((p: any) => p.email && user?.email && p.email.toLowerCase() === user.email.toLowerCase());
        if (match) setPid(match.id);
      } catch { /* ignore */ }
      setReady(true);
    })();
  }, [user]);
  return { pid, ready };
}

export function MyAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { pid, ready } = useMyPatient();
  const [rows, setRows] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ doctor_id: '', date: todayISO(), time: '10:00', reason: '' });

  const load = async () => {
    if (!pid) { setLoading(false); return; }
    setLoading(true);
    try {
      const [a, d] = await Promise.all([get(`/api/appointments?patient_id=${pid}`), get('/api/doctors')]);
      setRows(Array.isArray(a) ? a : []);
      setDoctors(Array.isArray(d) ? d : []);
    } catch { /* ignore */ }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) load(); }, [pid, ready]);

  const book = async () => {
    if (!pid) return toast({ kind: 'error', title: 'Patient record not linked' });
    if (!form.doctor_id) return toast({ kind: 'error', title: 'Choose a doctor' });
    const doc = doctors.find((d) => String(d.id) === String(form.doctor_id));
    try {
      await post('/api/appointments', { patient_id: pid, doctor_id: Number(form.doctor_id), department: doc?.department || doc?.specialty, date: form.date, time: form.time, appointment_type: 'New visit', reason: form.reason || null, status: 'Scheduled', created_by: user!.name });
      toast({ kind: 'success', title: 'Appointment requested', desc: `${doc?.name} · ${fmtDate(form.date)}` });
      setShowNew(false);
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to book appointment', desc: e.message });
    }
  };

  const cancel = async (a: any) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await put('/api/appointments', { id: a.id, status: 'Cancelled' });
      toast({ kind: 'success', title: 'Appointment cancelled' });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to cancel appointment', desc: e.message });
    }
  };

  return (
    <div>
      <SectionHead title="My appointments" desc="Book, view and cancel your visits."
        action={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><CalendarPlus size={15} /> Book visit</button>} />
      {!ready || loading ? <div className="card p-4"><SkeletonRows rows={5} /></div>
        : rows.length === 0 ? <div className="card"><Empty title="No appointments yet" desc="Book your first visit with one of our specialists." action={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>Book visit</button>} /></div>
        : (
          <div className="grid gap-3">
            {rows.sort((a, b) => String(b.date).localeCompare(String(a.date))).map((a) => (
              <div key={a.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-med-50 dark:bg-sky-950 flex items-center justify-center text-med-600 shrink-0"><Stethoscope size={19} /></div>
                <div className="flex-1 min-w-0 basis-52">
                  <div className="font-bold">{a.doctor?.name || a.department}</div>
                  <div className="text-[13px] opacity-60">{fmtDate(a.date)} · {fmtTime(a.time)} · {a.appointment_type}{a.reason ? ` · ${a.reason}` : ''}</div>
                </div>
                <Badge status={a.status} />
                {!['Completed', 'Cancelled', 'No-show'].includes(a.status) && <button className="btn btn-ghost btn-sm" onClick={() => cancel(a)}>Cancel</button>}
              </div>
            ))}
          </div>
        )}
      {showNew && (
        <Modal title="Book an appointment" onClose={() => setShowNew(false)}>
          <div className="space-y-4">
            <Field label="Doctor" required>
              <select className="input" value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Select doctor…</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.specialty} · ₹{d.consultation_fee}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date"><input type="date" className="input" value={form.date} min={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Time"><input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
            </div>
            <Field label="Reason"><input className="input" placeholder="What brings you in?" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={book}>Request appointment</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function MyRecords() {
  const { pid, ready } = useMyPatient();
  const [data, setData] = useState<any>({ appts: [], rx: [], labs: [], scans: [], vitals: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !pid) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [a, r, l, s, v] = await Promise.all([
          get(`/api/appointments?patient_id=${pid}`), get(`/api/prescriptions?patient_id=${pid}`),
          get(`/api/lab?patient_id=${pid}`), get(`/api/radiology?patient_id=${pid}`), get(`/api/vitals?patient_id=${pid}`),
        ]);
        setData({ appts: a || [], rx: r || [], labs: l || [], scans: s || [], vitals: v || [] });
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [ready, pid]);

  if (!ready || loading) return <div><SectionHead title="Medical records" desc="Your complete health timeline." /><div className="card p-4"><SkeletonRows rows={6} /></div></div>;

  const timeline: any[] = [
    ...data.appts.map((a: any) => ({ date: a.date, kind: 'Visit', title: `${a.appointment_type} — ${a.doctor?.name || a.department}`, sub: `${fmtTime(a.time)} · ${a.status}`, color: '#1470cc' })),
    ...data.labs.map((l: any) => ({ date: l.ordered_date, kind: 'Lab', title: l.test_name, sub: l.result || l.status, color: '#0d9488' })),
    ...data.scans.map((s: any) => ({ date: s.requested_date, kind: 'Imaging', title: s.modality, sub: s.report || s.status, color: '#6a3fd4' })),
    ...data.rx.map((r: any) => ({ date: (r.created_at || '').slice(0, 10), kind: 'Prescription', title: (r.items || []).map((i: any) => i.medicine).join(', '), sub: r.doctor_name, color: '#9a6b0a' })),
  ].filter((t) => t.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div>
      <SectionHead title="Medical records" desc="Every visit, test and prescription — newest first." />
      {timeline.length === 0 ? <div className="card"><Empty title="No records yet" desc="Your hospital activity will build this timeline." icon={<FileText size={22} />} /></div> : (
        <div className="card p-5 sm:p-6">
          {timeline.map((t, i) => (
            <div key={i} className="flex gap-3.5 pb-5 relative last:pb-0">
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
      {(data.vitals || []).length > 0 && (
        <div className="card p-5 mt-4">
          <div className="font-bold mb-3">Vitals history</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.vitals.map((v: any) => (
              <div key={v.id} className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-sm">
                <div className="font-bold">BP {v.bp} · {v.pulse || '—'} bpm · SpO2 {v.spo2 || '—'}%</div>
                <div className="text-xs opacity-55 mt-0.5">{v.created_at ? new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MyPrescriptions() {
  const { pid, ready } = useMyPatient();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready || !pid) { setLoading(false); return; }
    (async () => { setLoading(true); try { setRows(await get(`/api/prescriptions?patient_id=${pid}`)); } catch { /* ignore */ } setLoading(false); })();
  }, [ready, pid]);

  return (
    <div>
      <SectionHead title="My prescriptions" desc="What your doctors prescribed, with instructions." />
      {!ready || loading ? <div className="card p-4"><SkeletonRows rows={4} /></div>
        : rows.length === 0 ? <div className="card"><Empty title="No prescriptions" icon={<Pill size={22} />} /></div>
        : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-bold flex items-center gap-2"><Pill size={16} className="opacity-60" /> {r.doctor_name} <span className="opacity-50 font-semibold text-sm">· {fmtDate((r.created_at || '').slice(0, 10))}</span></div>
                  <Badge status={r.status} />
                </div>
                {r.diagnosis && <div className="text-sm mb-2"><span className="opacity-55">For: </span><span className="font-semibold">{r.diagnosis}</span></div>}
                <div className="space-y-1.5 mt-2">
                  {(r.items || []).map((it: any, i: number) => (
                    <div key={i} className="flex flex-wrap gap-x-3 text-sm rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
                      <span className="font-bold">{it.medicine}</span><span>{it.dose}</span><span className="opacity-60">{it.frequency} · {it.duration}</span>
                    </div>
                  ))}
                </div>
                {r.instructions && <div className="text-[13px] opacity-65 mt-2">Instructions: {r.instructions}</div>}
                <button className="btn btn-ghost btn-sm mt-3" onClick={() => nav(`/app/prescription/${r.id}`)}>View printable prescription</button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

export function MyLab() {
  const { pid, ready } = useMyPatient();
  const nav = useNavigate();
  const [labs, setLabs] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready || !pid) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [l, s] = await Promise.all([get(`/api/lab?patient_id=${pid}`), get(`/api/radiology?patient_id=${pid}`)]);
        setLabs(Array.isArray(l) ? l : []);
        setScans(Array.isArray(s) ? s : []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [ready, pid]);

  return (
    <div>
      <SectionHead title="My lab reports" desc="Test results and imaging reports." />
      {!ready || loading ? <div className="card p-4"><SkeletonRows rows={4} /></div>
        : labs.length + scans.length === 0 ? <div className="card"><Empty title="No reports yet" icon={<FlaskConical size={22} />} /></div>
        : (
          <div className="grid gap-3">
            {labs.map((l) => (
              <div key={'l' + l.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-600 shrink-0"><FlaskConical size={18} /></div>
                <div className="flex-1 min-w-0 basis-52">
                  <div className="font-bold">{l.test_name}</div>
                  <div className="text-[13px] opacity-60">Ordered {fmtDate(l.ordered_date)}{l.result ? ` · ${l.result}` : ` · ${l.status}`}</div>
                </div>
                <Badge status={l.status} />
                {['Verified', 'Completed'].includes(l.status) && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/lab-report/${l.id}`)}>View report</button>}
              </div>
            ))}
            {scans.map((s) => (
              <div key={'s' + s.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 shrink-0"><FileText size={18} /></div>
                <div className="flex-1 min-w-0 basis-52">
                  <div className="font-bold">{s.modality}{s.body_part ? ` — ${s.body_part}` : ''}</div>
                  <div className="text-[13px] opacity-60">Requested {fmtDate(s.requested_date)}{s.report ? ` · ${s.report.slice(0, 80)}` : ` · ${s.status}`}</div>
                </div>
                <Badge status={s.status === 'Reported' ? 'Completed' : 'Processing'}>{s.status}</Badge>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

export function MyBills() {
  const { pid, ready } = useMyPatient();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready || !pid) { setLoading(false); return; }
    (async () => { setLoading(true); try { setRows(await get(`/api/invoices?patient_id=${pid}`)); } catch { /* ignore */ } setLoading(false); })();
  }, [ready, pid]);

  const due = rows.filter((r) => r.status !== 'Paid').reduce((s, r) => s + Number(r.balance || 0), 0);

  return (
    <div>
      <SectionHead title="Bills & payments" desc={due > 0 ? `${inr(due)} outstanding — payable at the billing desk.` : 'All clear. No outstanding balance.'} />
      {!ready || loading ? <div className="card p-4"><SkeletonRows rows={4} /></div>
        : rows.length === 0 ? <div className="card"><Empty title="No bills" icon={<Receipt size={22} />} /></div>
        : (
          <div className="grid gap-3">
            {rows.map((b) => (
              <div key={b.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav(`/app/invoice/${b.id}`)}>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 shrink-0"><Receipt size={18} /></div>
                <div className="flex-1 min-w-0 basis-52">
                  <div className="font-bold">{b.invoice_number}</div>
                  <div className="text-[13px] opacity-60">{fmtDate(b.invoice_date || (b.created_at || '').slice(0, 10))} · {(b.items || []).length} items · Total {inr(b.total)}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${Number(b.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Number(b.balance) > 0 ? `${inr(b.balance)} due` : 'Paid'}</div>
                  <div className="mt-1"><Badge status={b.status} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
