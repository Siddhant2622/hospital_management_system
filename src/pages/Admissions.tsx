import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowRightLeft, LogOut, BedDouble } from 'lucide-react';
import { get, post, put, fmtDate, todayISO, inr } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SkeletonRows, SectionHead, Avatar } from '../components/ui';

export default function Admissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('Admitted');
  const [showNew, setShowNew] = useState(false);
  const [transfer, setTransfer] = useState<any>(null);
  const [transferBed, setTransferBed] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patient_id: params.get('patient') || '', doctor_id: '', department: 'General Medicine', ward: 'General Ward A', bed_id: '', reason: '', expected_discharge: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canManage = ['Admin', 'Receptionist', 'Doctor'].includes(user?.role || '');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [a, p, d, b] = await Promise.all([get('/api/admissions'), get('/api/patients'), get('/api/doctors'), get('/api/beds')]);
      setRows(Array.isArray(a) ? a : []);
      setPatients(Array.isArray(p) ? p : []);
      setDoctors(Array.isArray(d) ? d : []);
      setBeds(Array.isArray(b) ? b : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('new') === '1' && canManage) setShowNew(true); }, []);

  const freeBeds = beds.filter((b) => b.status === 'Available');
  const shown = rows.filter((r) => (filter === 'All' ? true : r.status === filter));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.patient_id) e.patient_id = 'Choose a patient.';
    if (!form.doctor_id) e.doctor_id = 'Assign a doctor.';
    if (!form.bed_id) e.bed_id = 'Assign a bed.';
    if (!form.reason.trim()) e.reason = 'Admission reason is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const admit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const bed = beds.find((b) => String(b.id) === String(form.bed_id));
      const doc = doctors.find((d) => String(d.id) === String(form.doctor_id));
      const pat = patients.find((p) => String(p.id) === String(form.patient_id));
      await post('/api/admissions', {
        patient_id: Number(form.patient_id),
        doctor_id: Number(form.doctor_id),
        doctor_name: doc?.name,
        department: form.department,
        ward: bed?.ward || form.ward,
        room_number: bed?.room_number,
        bed_id: bed?.id,
        bed_number: bed?.bed_number,
        admission_date: todayISO(),
        expected_discharge: form.expected_discharge || null,
        reason: form.reason,
        status: 'Admitted',
        condition: 'Stable',
        admitted_by: user!.name,
      });
      await put('/api/beds', { id: bed.id, status: 'Occupied', patient_id: pat.id, patient_name: pat.name });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Admitted ${pat.name} to ${bed.bed_number} (${bed.ward})`, module: 'Admissions' });
      toast({ kind: 'success', title: 'Patient admitted', desc: `${pat.name} · Bed ${bed.bed_number}` });
      setShowNew(false);
      setForm({ patient_id: '', doctor_id: '', department: 'General Medicine', ward: 'General Ward A', bed_id: '', reason: '', expected_discharge: '' });
      load();
    } catch (e: any) { toast({ kind: 'error', title: 'Admission failed', desc: e.message }); }
    setSaving(false);
  };

  const discharge = async (a: any) => {
    if (!confirm(`Discharge ${a.patient?.name}? The bed will be released for cleaning.`)) return;
    try {
      await put('/api/admissions', { id: a.id, status: 'Discharged', discharge_date: todayISO() });
      if (a.bed_id) await put('/api/beds', { id: a.bed_id, status: 'Cleaning', patient_id: null, patient_name: null });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Discharged ${a.patient?.name} from ${a.bed_number}`, module: 'Admissions' });
      toast({ kind: 'success', title: 'Patient discharged', desc: `${a.bed_number} sent for cleaning` });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Discharge failed', desc: e.message });
    }
  };

  const doTransfer = async () => {
    if (!transferBed) return;
    try {
      const bed = beds.find((b) => String(b.id) === String(transferBed));
      if (transfer.bed_id) await put('/api/beds', { id: transfer.bed_id, status: 'Cleaning', patient_id: null, patient_name: null });
      await put('/api/beds', { id: bed.id, status: 'Occupied', patient_id: transfer.patient_id, patient_name: transfer.patient?.name });
      await put('/api/admissions', { id: transfer.id, bed_id: bed.id, bed_number: bed.bed_number, ward: bed.ward, room_number: bed.room_number });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Transferred ${transfer.patient?.name} to ${bed.bed_number}`, module: 'Admissions' });
      toast({ kind: 'success', title: 'Bed transferred', desc: `Now in ${bed.bed_number} · ${bed.ward}` });
      setTransfer(null);
      setTransferBed('');
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Transfer failed', desc: e.message });
    }
  };

  return (
    <div>
      <SectionHead title="Admissions (IPD)" desc="Admit, transfer and discharge — beds update automatically."
        action={canManage ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> Admit patient</button> : undefined} />

      <div className="flex gap-1.5 mb-4">
        {['Admitted', 'Discharged', 'All'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`tab-btn ${filter === f ? 'active' : ''}`}>{f}</button>
        ))}
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={7} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : shown.length === 0 ? <div className="card"><Empty title={`No ${filter.toLowerCase()} patients`} /></div>
        : (
          <div className="grid gap-3">
            {shown.map((a) => (
              <div key={a.id} className="card p-4 sm:p-5 flex flex-wrap items-center gap-3.5">
                <Avatar name={a.patient?.name} size={44} />
                <div className="min-w-0 flex-1 basis-52 cursor-pointer" onClick={() => nav(`/app/patients/${a.patient_id}`)}>
                  <div className="font-bold">{a.patient?.name} <span className="opacity-50 font-semibold text-sm">· {a.patient?.patient_id}</span></div>
                  <div className="text-[13px] opacity-60 mt-0.5">{a.department} · Dr. {a.doctor_name} · admitted {fmtDate(a.admission_date)}</div>
                  <div className="text-[13px] opacity-60">{a.reason}</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BedDouble size={16} className="opacity-50" />
                  <span className="font-bold">{a.bed_number}</span>
                  <span className="opacity-55 text-[13px]">{a.ward}{a.room_number ? ` · Room ${a.room_number}` : ''}</span>
                </div>
                <Badge status={a.condition || 'Stable'} />
                <Badge status={a.status} />
                {a.status === 'Admitted' && canManage && (
                  <div className="flex gap-1.5">
                    <button className="btn btn-ghost btn-sm" onClick={() => setTransfer(a)}><ArrowRightLeft size={14} /> Transfer</button>
                    <button className="btn btn-teal btn-sm" onClick={() => discharge(a)}><LogOut size={14} /> Discharge</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {showNew && (
        <Modal title="Admit patient" subtitle="Bed assignment releases from the live bed map." onClose={() => setShowNew(false)}>
          <div className="space-y-4">
            <Field label="Patient" required error={errors.patient_id}>
              <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.patient_id}</option>)}
              </select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Treating doctor" required error={errors.doctor_id}>
                <select className="input" value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                  <option value="">Select…</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {['General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Gynecology', 'Surgery', 'Emergency'].map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Assign bed" required error={errors.bed_id} hint={`${freeBeds.length} beds currently free`}>
              <select className="input" value={form.bed_id} onChange={(e) => setForm({ ...form, bed_id: e.target.value })}>
                <option value="">Select a free bed…</option>
                {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.bed_number} · {b.ward} · {b.category} · {inr(b.daily_rate)}/day</option>)}
              </select>
            </Field>
            <Field label="Reason for admission" required error={errors.reason}>
              <input className="input" placeholder="e.g. Acute appendicitis — pre-op observation" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <Field label="Expected discharge">
              <input type="date" className="input" value={form.expected_discharge} min={todayISO()} onChange={(e) => setForm({ ...form, expected_discharge: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={admit} disabled={saving}>{saving ? 'Admitting…' : 'Admit patient'}</button>
          </div>
        </Modal>
      )}

      {transfer && (
        <Modal title={`Transfer ${transfer.patient?.name}`} subtitle={`Currently in ${transfer.bed_number}`} onClose={() => setTransfer(null)}>
          <Field label="Move to bed" hint="The old bed goes for cleaning automatically.">
            <select className="input" value={transferBed} onChange={(e) => setTransferBed(e.target.value)}>
              <option value="">Select a free bed…</option>
              {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.bed_number} · {b.ward} · {b.category}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setTransfer(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={doTransfer} disabled={!transferBed}>Confirm transfer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
