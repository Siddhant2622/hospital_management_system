import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { get, post, put, todayISO, fmtTime } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SkeletonRows, SectionHead, Avatar } from '../components/ui';

const PRI = ['Critical', 'High', 'Medium', 'Low'];
const STAGES = ['Arrived', 'Triage', 'Under Treatment', 'Observation', 'Admitted', 'Discharged'];

export default function Emergency() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [priF, setPriF] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patient_name: '', age: '', gender: 'Male', complaint: '', triage_level: 'High', doctor_name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canManage = user?.role !== 'Patient';

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [e, b] = await Promise.all([get('/api/emergency'), get('/api/beds')]);
      setRows(Array.isArray(e) ? e : []);
      setBeds(Array.isArray(b) ? b : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const active = useMemo(() => rows.filter((r) => !['Discharged', 'Admitted'].includes(r.status) && (!priF || r.triage_level === priF)), [rows, priF]);
  const freeEmerg = beds.filter((b) => b.status === 'Available').length;

  const move = async (c: any, status: string) => {
    try {
      await put('/api/emergency', { id: c.id, status });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Moved emergency case ${c.case_id} to ${status}`, module: 'Emergency' });
      toast({ kind: 'success', title: `${c.case_id} → ${status}` });
      load();
    } catch (err: any) {
      toast({ kind: 'error', title: 'Failed to update case', desc: err.message });
    }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.patient_name.trim()) e.patient_name = 'Patient name is required.';
    if (!form.complaint.trim()) e.complaint = 'Chief complaint is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const created = await post('/api/emergency', {
        case_id: `EMG-${String(rows.length + 1).padStart(4, '0')}`,
        patient_name: form.patient_name.trim(),
        age: form.age ? Number(form.age) : null,
        gender: form.gender,
        complaint: form.complaint.trim(),
        triage_level: form.triage_level,
        doctor_name: form.doctor_name.trim() || null,
        arrival_time: new Date().toISOString(),
        arrival_date: todayISO(),
        status: 'Triage',
        created_by: user!.name,
      });
      await post('/api/notifications', { type: 'Critical', title: `Emergency arrival: ${form.triage_level}`, message: `${form.patient_name} — ${form.complaint}`, target_role: 'All' });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Logged emergency arrival ${created.case_id}`, module: 'Emergency' });
      toast({ kind: 'success', title: 'Emergency case logged', desc: `${created.case_id} · ${form.triage_level} priority` });
      setShowNew(false);
      setForm({ patient_name: '', age: '', gender: 'Male', complaint: '', triage_level: 'High', doctor_name: '' });
      load();
    } catch (err: any) { toast({ kind: 'error', title: 'Failed to log case', desc: err.message }); }
    setSaving(false);
  };

  const priColor: Record<string, string> = { Critical: '#b4232a', High: '#d99a0b', Medium: '#1470cc', Low: '#64748b' };

  return (
    <div>
      <SectionHead title="Emergency department" desc={`${active.length} active cases · ${freeEmerg} emergency beds free`}
        action={canManage ? <button className="btn btn-danger btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> Log arrival</button> : undefined} />

      <div className="grid grid-cols-4 gap-3 mb-4">
        {PRI.map((p) => (
          <button key={p} onClick={() => setPriF(priF === p ? '' : p)} className={`card p-4 text-left transition-all ${priF === p ? 'ring-2 ring-offset-1 ring-red-400' : ''}`}>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: priColor[p] }} /><span className="text-[13px] font-semibold opacity-60">{p}</span></div>
            <div className="text-2xl font-bold mt-1">{active.filter((r) => r.triage_level === p).length}</div>
          </button>
        ))}
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={6} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : active.length === 0 ? <div className="card"><Empty title="No active emergency cases" desc="New arrivals appear here the moment they are logged." /></div>
        : (
          <div className="grid gap-3">
            {active.sort((a, b) => PRI.indexOf(a.triage_level) - PRI.indexOf(b.triage_level)).map((c) => (
              <div key={c.id} className="card p-4 sm:p-5 border-l-4" style={{ borderLeftColor: priColor[c.triage_level] || '#64748b' }}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={c.patient_name} size={42} />
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="font-bold">{c.patient_name} <span className="opacity-50 font-mono font-semibold text-[13px]">{c.case_id}</span></div>
                    <div className="text-[13px] opacity-65 mt-0.5">{c.complaint}</div>
                    <div className="text-xs opacity-50 mt-0.5">Arrived {c.arrival_time ? fmtTime(new Date(c.arrival_time).toISOString().slice(11, 16)) : '—'}{c.doctor_name ? ` · Dr. ${c.doctor_name}` : ''}</div>
                  </div>
                  <Badge status={c.triage_level} />
                  <Badge status={c.status === 'Under Treatment' ? 'In consultation' : c.status} />
                  {canManage && (
                    <select className="input !w-auto !py-1.5 !text-[13px]" value={c.status} onChange={(e) => move(c, e.target.value)} aria-label="Move stage">
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </div>
                {/* stage progress */}
                <div className="flex items-center gap-1 mt-3.5">
                  {STAGES.map((s, i) => {
                    const cur = STAGES.indexOf(c.status);
                    return (
                      <div key={s} className="flex-1">
                        <div className="h-1.5 rounded-full" style={{ background: i <= cur ? priColor[c.triage_level] : '#e5eaf1' }} />
                        <div className={`text-[10px] font-semibold mt-1 ${i <= cur ? '' : 'opacity-40'}`}>{s}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      {rows.filter((r) => ['Discharged', 'Admitted'].includes(r.status)).length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-bold mb-2 opacity-70">Recently closed</div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.filter((r) => ['Discharged', 'Admitted'].includes(r.status)).slice(0, 5).map((c) => (
                <div key={c.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-semibold">{c.patient_name}</span>
                  <span className="opacity-50 text-[13px]">{c.case_id} · {c.complaint}</span>
                  <span className="ml-auto"><Badge status={c.status} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <Modal title="Log emergency arrival" subtitle="Triage starts the moment this is saved." onClose={() => setShowNew(false)}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Patient name" required error={errors.patient_name}>
                <input className="input" placeholder="Name or 'Unknown male'" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Age"><input type="number" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></Field>
                <Field label="Gender"><select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option>Male</option><option>Female</option><option>Other</option></select></Field>
              </div>
            </div>
            <Field label="Chief complaint" required error={errors.complaint}>
              <input className="input" placeholder="e.g. Road traffic accident, chest trauma" value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Triage priority">
                <select className="input" value={form.triage_level} onChange={(e) => setForm({ ...form, triage_level: e.target.value })}>
                  {PRI.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Assigned doctor">
                <input className="input" placeholder="On-duty doctor (optional)" value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={save} disabled={saving}>{saving ? 'Logging…' : 'Log arrival'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
