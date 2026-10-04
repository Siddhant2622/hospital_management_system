import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeartPulse, FlaskConical, ScanLine, Pill, CalendarPlus, FileText, Save } from 'lucide-react';
import { get, post, put, todayISO, fmtDate, fmtTime } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Field, SectionHead, Avatar, Empty } from '../components/ui';

const TESTS = ['Complete Blood Count (CBC)', 'Blood Sugar (Fasting)', 'HbA1c', 'Lipid Profile', 'Liver Function Test', 'Kidney Function Test', 'Thyroid Profile (T3/T4/TSH)', 'Urine Routine', 'ECG', 'CRP'];
const SCANS = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography', 'DEXA'];

export default function Consult() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [patients, setPatients] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [pid, setPid] = useState(params.get('patient') || '');
  const [detail, setDetail] = useState<any>(null);
  const [history, setHistory] = useState<any>({ appts: [], rx: [], labs: [] });
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ medicine: '', dose: '', frequency: '1-0-1', duration: '5 days', instructions: '' }]);
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [testSel, setTestSel] = useState(TESTS[0]);
  const [scanSel, setScanSel] = useState(SCANS[0]);

  useEffect(() => {
    (async () => {
      const [p, m] = await Promise.all([get('/api/patients'), get('/api/medicines')]);
      setPatients(Array.isArray(p) ? p : []);
      setMeds(Array.isArray(m) ? m : []);
    })();
  }, []);

  useEffect(() => {
    if (!pid) { setDetail(null); return; }
    (async () => {
      const [plist, a, r, l, v] = await Promise.all([
        get('/api/patients'),
        get(`/api/appointments?patient_id=${pid}`),
        get(`/api/prescriptions?patient_id=${pid}`),
        get(`/api/lab?patient_id=${pid}`),
        get(`/api/vitals?patient_id=${pid}`),
      ]);
      setDetail((Array.isArray(plist) ? plist : []).find((x: any) => String(x.id) === String(pid)));
      setHistory({ appts: a || [], rx: r || [], labs: l || [], vitals: v || [] });
    })();
  }, [pid]);

  const canConsult = ['Admin', 'Doctor'].includes(user?.role || '');
  if (!canConsult) return <div className="card"><Empty title="Consultation is available to doctors" desc="Switch to the Doctor workspace to run consultations." /></div>;

  const setItem = (i: number, patch: any) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const validRx = items.every((it) => it.medicine.trim() && it.dose.trim());

  const orderTest = async () => {
    if (!pid) return toast({ kind: 'error', title: 'Select a patient first' });
    await post('/api/lab', { patient_id: Number(pid), test_name: testSel, priority: 'Routine', status: 'Ordered', ordered_date: todayISO(), ordered_by: user!.name });
    toast({ kind: 'success', title: 'Lab test ordered', desc: `${testSel} → lab queue` });
  };

  const orderScan = async () => {
    if (!pid) return toast({ kind: 'error', title: 'Select a patient first' });
    await post('/api/radiology', { patient_id: Number(pid), modality: scanSel, status: 'Requested', requested_date: todayISO(), requested_by: user!.name });
    toast({ kind: 'success', title: 'Imaging requested', desc: `${scanSel} → radiology` });
  };

  const complete = async () => {
    if (!pid) return toast({ kind: 'error', title: 'Select a patient first' });
    if (!diagnosis.trim()) return toast({ kind: 'error', title: 'Diagnosis is required' });
    if (!validRx && items.some((it) => it.medicine.trim())) return toast({ kind: 'error', title: 'Each medicine needs a dose' });
    setSaving(true);
    try {
      const hasRx = items.some((it) => it.medicine.trim());
      if (hasRx) {
        await post('/api/prescriptions', {
          patient_id: Number(pid), doctor_name: user!.name, diagnosis: diagnosis.trim(),
          items: items.filter((it) => it.medicine.trim()),
          instructions: notes.trim() || null, status: 'Pending',
        });
        await post('/api/notifications', { type: 'Prescription', title: 'New prescription', message: `${detail?.name} — prescribed by ${user!.name}`, target_role: 'Pharmacist' });
      }
      if (followUp) {
        await post('/api/appointments', {
          patient_id: Number(pid), doctor_id: user?.link?.doctorId || null,
          department: 'Follow-up', date: followUp, time: '10:00',
          appointment_type: 'Follow-up', status: 'Scheduled', reason: `Follow-up: ${diagnosis.trim()}`, created_by: user!.name,
        });
      }
      // mark today's appointment completed if exists
      const todays = (history.appts || []).find((a: any) => a.date === todayISO() && !['Completed', 'Cancelled'].includes(a.status));
      if (todays) {
        await put('/api/appointments', { id: todays.id, status: 'Completed' });
      }
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Completed consultation for ${detail?.name}: ${diagnosis.trim()}`, module: 'Consultation' });
      toast({ kind: 'success', title: 'Consultation completed', desc: `${hasRx ? 'Prescription sent to pharmacy. ' : ''}${followUp ? 'Follow-up scheduled.' : ''}` });
      setDiagnosis('');
      setNotes('');
      setItems([{ medicine: '', dose: '', frequency: '1-0-1', duration: '5 days', instructions: '' }]);
      setFollowUp('');
    } catch (e: any) { toast({ kind: 'error', title: 'Failed to complete', desc: e.message }); }
    setSaving(false);
  };

  return (
    <div>
      <SectionHead title="Consultation" desc="Patient context on the left, clinical capture on the right." />

      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <Field label="Patient under consultation">
          <select className="input sm:w-96" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Select patient…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.patient_id} · {p.age}y {p.gender}</option>)}
          </select>
        </Field>
        {detail && (
          <div className="flex items-center gap-3 sm:ml-auto">
            <Avatar name={detail.name} size={40} />
            <div className="text-sm">
              <div className="font-bold">{detail.name} <span className="opacity-50 font-semibold">· {detail.blood_group || 'Blood group unknown'}</span></div>
              <div className="opacity-60 text-[13px]">Allergies: {detail.allergies || 'none'} · {detail.conditions || 'no chronic conditions'}</div>
            </div>
          </div>
        )}
      </div>

      {!detail ? (
        <div className="card"><Empty title="No patient selected" desc="Choose a patient above — or start from today's queue on your dashboard." /></div>
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
          {/* LEFT: context rail */}
          <div className="space-y-4 lg:sticky lg:top-20">
            <div className="card p-5">
              <div className="font-bold mb-3 flex items-center gap-2"><HeartPulse size={16} className="text-red-500" /> Latest vitals</div>
              {(history.vitals || [])[0] ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2.5"><div className="text-[11px] opacity-55 font-bold">BP</div><div className="font-bold">{history.vitals[0].bp}</div></div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2.5"><div className="text-[11px] opacity-55 font-bold">Pulse</div><div className="font-bold">{history.vitals[0].pulse || '—'}</div></div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2.5"><div className="text-[11px] opacity-55 font-bold">Temp</div><div className="font-bold">{history.vitals[0].temp || '—'}</div></div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2.5"><div className="text-[11px] opacity-55 font-bold">SpO2</div><div className="font-bold">{history.vitals[0].spo2 || '—'}%</div></div>
                </div>
              ) : <div className="text-sm opacity-55">No vitals on file — nursing can record them from the ward board.</div>}
            </div>
            <div className="card p-5">
              <div className="font-bold mb-3">Recent history</div>
              <div className="space-y-3 text-sm max-h-72 overflow-y-auto scroll-thin">
                {(history.rx || []).slice(0, 3).map((r: any) => (
                  <div key={'r' + r.id}><span className="badge b-purple">Rx</span> <span className="font-semibold">{r.diagnosis || 'Prescription'}</span> <span className="opacity-55">· {(r.items || []).map((i: any) => i.medicine).join(', ')}</span></div>
                ))}
                {(history.labs || []).slice(0, 3).map((l: any) => (
                  <div key={'l' + l.id}><span className="badge b-teal">Lab</span> <span className="font-semibold">{l.test_name}</span> <span className="opacity-55">· {l.result || l.status}</span></div>
                ))}
                {(history.appts || []).slice(0, 3).map((a: any) => (
                  <div key={'a' + a.id}><span className="badge b-blue">Visit</span> <span className="font-semibold">{fmtDate(a.date)} {fmtTime(a.time)}</span> <span className="opacity-55">· {a.status}</span></div>
                ))}
                {!history.rx?.length && !history.labs?.length && !history.appts?.length && <div className="opacity-55">First recorded visit.</div>}
              </div>
            </div>
            <div className="card p-5 space-y-3">
              <div className="font-bold">Order diagnostics</div>
              <div className="flex gap-2">
                <select className="input" value={testSel} onChange={(e) => setTestSel(e.target.value)}>{TESTS.map((t) => <option key={t}>{t}</option>)}</select>
                <button className="btn btn-ghost btn-sm shrink-0" onClick={orderTest}><FlaskConical size={14} /> Order</button>
              </div>
              <div className="flex gap-2">
                <select className="input" value={scanSel} onChange={(e) => setScanSel(e.target.value)}>{SCANS.map((t) => <option key={t}>{t}</option>)}</select>
                <button className="btn btn-ghost btn-sm shrink-0" onClick={orderScan}><ScanLine size={14} /> Request</button>
              </div>
            </div>
          </div>

          {/* RIGHT: capture */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="font-bold mb-3 flex items-center gap-2"><FileText size={16} className="opacity-60" /> Diagnosis & clinical notes</div>
              <div className="space-y-3">
                <Field label="Diagnosis" required>
                  <input className="input" placeholder="e.g. Acute viral pharyngitis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                </Field>
                <Field label="Clinical notes" hint="Symptoms, examination findings, advice given.">
                  <textarea className="input" rows={4} placeholder="Throat congested, no exudates. Afebrile. Advised rest, fluids…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold flex items-center gap-2"><Pill size={16} className="opacity-60" /> Prescription</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setItems([...items, { medicine: '', dose: '', frequency: '1-0-1', duration: '5 days', instructions: '' }])}>+ Add medicine</button>
              </div>
              <div className="space-y-2.5">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-2 lg:grid-cols-[1fr_110px_110px_110px_32px] gap-2">
                    <input className="input col-span-2 lg:col-span-1" list="med-list" placeholder="Medicine" value={it.medicine} onChange={(e) => setItem(i, { medicine: e.target.value })} />
                    <input className="input" placeholder="Dose (500mg)" value={it.dose} onChange={(e) => setItem(i, { dose: e.target.value })} />
                    <select className="input" value={it.frequency} onChange={(e) => setItem(i, { frequency: e.target.value })}>
                      <option>1-0-1</option><option>1-1-1</option><option>1-0-0</option><option>0-0-1</option><option>0-1-0</option><option>SOS</option>
                    </select>
                    <select className="input" value={it.duration} onChange={(e) => setItem(i, { duration: e.target.value })}>
                      <option>3 days</option><option>5 days</option><option>7 days</option><option>10 days</option><option>14 days</option><option>30 days</option>
                    </select>
                    <button className="btn btn-ghost btn-sm !px-2 hidden lg:flex" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label="Remove">×</button>
                  </div>
                ))}
                <datalist id="med-list">{meds.map((m: any) => <option key={m.id} value={m.name}>{m.strength}</option>)}</datalist>
              </div>
              <div className="text-xs opacity-55 mt-2">On completion, this prescription appears instantly in the pharmacy queue and the patient's portal.</div>
            </div>

            <div className="card p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Field label="Schedule follow-up (optional)">
                  <input type="date" className="input" value={followUp} min={todayISO()} onChange={(e) => setFollowUp(e.target.value)} />
                </Field>
              </div>
              <button className="btn btn-primary !px-7 !py-3" onClick={complete} disabled={saving}>
                {saving ? 'Saving…' : <><Save size={16} /> Complete consultation</>}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[13px] opacity-60">
              <CalendarPlus size={14} /> Completing also closes today's appointment for {detail.name} and files everything to the medical timeline.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
