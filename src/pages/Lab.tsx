import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, FlaskConical } from 'lucide-react';
import { get, post, put, fmtDate, todayISO } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SkeletonRows, SectionHead } from '../components/ui';

const FLOW = ['Ordered', 'Sample Collected', 'Processing', 'Result Entry', 'Verified'];
const TESTS = ['Complete Blood Count (CBC)', 'Blood Sugar (Fasting)', 'HbA1c', 'Lipid Profile', 'Liver Function Test', 'Kidney Function Test', 'Thyroid Profile (T3/T4/TSH)', 'Urine Routine', 'ECG', 'Hb / Hematocrit', 'CRP', 'Dengue NS1', 'Widal', 'COVID RT-PCR'];

export default function Lab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [resultFor, setResultFor] = useState<any>(null);
  const [result, setResult] = useState('');
  const [form, setForm] = useState({ patient_id: params.get('patient') || '', test_name: TESTS[0], priority: 'Routine', notes: '' });
  const [saving, setSaving] = useState(false);

  const canOrder = ['Admin', 'Doctor', 'Nurse'].includes(user?.role || '');
  const canProcess = ['Admin', 'Lab Technician', 'Doctor'].includes(user?.role || '');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [l, p] = await Promise.all([get('/api/lab'), get('/api/patients')]);
      setRows(Array.isArray(l) ? l : []);
      setPatients(Array.isArray(p) ? p : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('new') === '1') setShowNew(true); }, []);

  const shown = useMemo(() => rows.filter((r) => stage === 'All' || r.status === stage || (stage === 'Verified' && r.status === 'Completed')), [rows, stage]);

  const advance = async (t: any) => {
    const i = FLOW.indexOf(t.status);
    if (i < 0 || i >= FLOW.length - 1) return;
    const next = FLOW[i + 1];
    if (next === 'Result Entry') { setResultFor(t); setResult(t.result || ''); return; }
    try {
      await put('/api/lab', { id: t.id, status: next });
      toast({ kind: 'success', title: `${t.test_name} → ${next}` });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update test status', desc: e.message });
    }
  };

  const saveResult = async (verify: boolean) => {
    if (!result.trim()) return toast({ kind: 'error', title: 'Enter the result first' });
    try {
      await put('/api/lab', { id: resultFor.id, result: result.trim(), result_date: todayISO(), status: verify ? 'Verified' : 'Result Entry' });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `${verify ? 'Verified' : 'Entered'} result for ${resultFor.test_name} (${resultFor.patient?.name})`, module: 'Laboratory' });
      if (verify) await post('/api/notifications', { type: 'Lab result', title: 'Lab report ready', message: `${resultFor.test_name} for ${resultFor.patient?.name} is verified.`, target_role: 'Doctor' });
      toast({ kind: 'success', title: verify ? 'Report verified & released' : 'Result saved' });
      setResultFor(null);
      setResult('');
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to save result', desc: e.message });
    }
  };

  const order = async () => {
    if (!form.patient_id) return toast({ kind: 'error', title: 'Choose a patient' });
    setSaving(true);
    try {
      await post('/api/lab', { patient_id: Number(form.patient_id), test_name: form.test_name, priority: form.priority, notes: form.notes || null, status: 'Ordered', ordered_date: todayISO(), ordered_by: user!.name });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Ordered ${form.test_name} for patient #${form.patient_id}`, module: 'Laboratory' });
      toast({ kind: 'success', title: 'Test ordered', desc: `${form.test_name} → lab queue` });
      setShowNew(false);
      setForm({ patient_id: '', test_name: TESTS[0], priority: 'Routine', notes: '' });
      load();
    } catch (e: any) { toast({ kind: 'error', title: 'Order failed', desc: e.message }); }
    setSaving(false);
  };

  return (
    <div>
      <SectionHead title="Laboratory" desc="Ordered → sampled → processed → verified → released."
        action={canOrder ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> Order test</button> : undefined} />

      <div className="card p-3 mb-4 overflow-x-auto scroll-thin">
        <div className="flex items-center gap-1 min-w-[620px]">
          {['All', ...FLOW].map((s, i) => {
            const c = s === 'All' ? rows.length : rows.filter((r) => r.status === s || (s === 'Verified' && r.status === 'Completed')).length;
            return (
              <button key={s} onClick={() => setStage(s)} className={`flex-1 rounded-xl px-2 py-2.5 text-center transition-all ${stage === s ? 'bg-ink-900 text-white dark:bg-sky-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">{i === 0 ? 'All' : `0${i}`}</div>
                <div className="text-[13px] font-bold truncate">{s}</div>
                <div className="text-lg font-bold">{c}</div>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={7} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : shown.length === 0 ? <div className="card"><Empty title="No tests in this stage" /></div>
        : (
          <div className="grid gap-3">
            {shown.map((t) => (
              <div key={t.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-600 shrink-0"><FlaskConical size={18} /></div>
                  <div className="min-w-0 flex-1 basis-52 cursor-pointer" onClick={() => nav(`/app/patients/${t.patient_id}`)}>
                    <div className="font-bold">{t.test_name} <span className="opacity-50 font-semibold text-sm">· {t.patient?.name}</span></div>
                    <div className="text-xs opacity-55 mt-0.5">Ordered {fmtDate(t.ordered_date)} by {t.ordered_by || '—'} · {t.priority} {t.result ? `· Result: ${t.result}` : ''}</div>
                  </div>
                  <Badge status={t.status} />
                  {canProcess && !['Verified', 'Completed'].includes(t.status) && (
                    <button className="btn btn-primary btn-sm" onClick={() => advance(t)}>
                      {FLOW.indexOf(t.status) === 2 ? 'Enter result' : `Mark: ${FLOW[FLOW.indexOf(t.status) + 1]}`}
                    </button>
                  )}
                  {['Verified', 'Completed'].includes(t.status) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => nav(`/app/lab-report/${t.id}`)}>View report</button>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-3">
                  {FLOW.map((s, i) => (
                    <div key={s} className="flex-1">
                      <div className="h-1.5 rounded-full" style={{ background: FLOW.indexOf(t.status === 'Completed' ? 'Verified' : t.status) >= i ? '#0d9488' : '#e5eaf1' }} />
                      <div className="text-[10px] font-semibold mt-1 opacity-60 hidden sm:block">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {showNew && (
        <Modal title="Order lab test" subtitle="Goes straight to the lab queue." onClose={() => setShowNew(false)}>
          <div className="space-y-4">
            <Field label="Patient" required>
              <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.patient_id}</option>)}
              </select>
            </Field>
            <Field label="Test" required>
              <select className="input" value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })}>
                {TESTS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option>Routine</option><option>Urgent</option><option>STAT</option>
              </select>
            </Field>
            <Field label="Clinical notes">
              <input className="input" placeholder="Fasting sample, diagnosis context…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={order} disabled={saving}>{saving ? 'Ordering…' : 'Order test'}</button>
          </div>
        </Modal>
      )}

      {resultFor && (
        <Modal title="Enter result" subtitle={`${resultFor.test_name} · ${resultFor.patient?.name}`} onClose={() => setResultFor(null)}>
          <Field label="Result" hint="e.g. Hb 13.2 g/dL (Normal range 13–17)">
            <textarea className="input" rows={4} value={result} onChange={(e) => setResult(e.target.value)} placeholder="Type the verified result…" />
          </Field>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setResultFor(null)}>Cancel</button>
            <button className="btn btn-ghost" onClick={() => saveResult(false)}>Save draft</button>
            <button className="btn btn-teal" onClick={() => saveResult(true)}>Verify & release</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
