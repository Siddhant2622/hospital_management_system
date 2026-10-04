import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Phone, UserPlus } from 'lucide-react';
import { get, post, fmtDate, todayISO } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SkeletonRows, Pagination, SectionHead, Avatar } from '../components/ui';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Patients() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const [catF, setCatF] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', gender: 'Male', phone: '', email: '', blood_group: '', address: '', emergency_contact: '', insurance_provider: '', insurance_policy: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const perPage = 10;

  const canEdit = user?.role !== 'Patient' && user?.role !== 'Accountant';

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const d = await get('/api/patients');
      setRows(Array.isArray(d) ? d : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('new') === '1' && canEdit) setShowNew(true); }, []);

  const getTags = (p: any) => {
    const t = [];
    if (p.age >= 60) t.push('Senior Citizen');
    if (p.age <= 12) t.push('Pediatric');
    if (p.insurance_provider) t.push('Insurance');
    else t.push('Cash');
    if (p.name?.toLowerCase().includes('vip')) t.push('VIP');
    return t;
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusF && r.status !== statusF) return false;
      if (catF && !getTags(r).includes(catF)) return false;
      if (!needle) return true;
      return [r.name, r.patient_id, r.phone, r.email].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [rows, q, statusF, catF]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [q, statusF, catF]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Patient name is required.';
    if (!form.age || Number(form.age) <= 0 || Number(form.age) > 130) e.age = 'Enter a valid age.';
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 8) e.phone = 'Enter a valid phone number.';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Enter a valid email.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const count = rows.length;
      const pid = `ASH-${String(count + 1 + Math.floor(Math.random() * 3)).padStart(5, '0')}`;
      const created = await post('/api/patients', {
        patient_id: pid,
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        blood_group: form.blood_group || null,
        address: form.address.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        insurance_provider: form.insurance_provider.trim() || null,
        insurance_policy: form.insurance_policy.trim() || null,
        registration_date: todayISO(),
        status: 'Active',
      });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Registered patient ${form.name} (${pid})`, module: 'Patients' });
      toast({ kind: 'success', title: 'Patient registered successfully', desc: `${form.name} · ${pid}` });
      setShowNew(false);
      setForm({ name: '', age: '', gender: 'Male', phone: '', email: '', blood_group: '', address: '', emergency_contact: '', insurance_provider: '', insurance_policy: '' });
      load();
      if (created?.id) nav(`/app/patients/${created.id}`);
    } catch (e: any) {
      toast({ kind: 'error', title: 'Registration failed', desc: e.message });
    }
    setSaving(false);
  };

  return (
    <div>
      <SectionHead title="Patients" desc={`${rows.length} registered · search by name, ID or phone`}
        action={canEdit ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> Register patient</button> : undefined} />

      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input className="input !pl-10" placeholder="Search patients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-44" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          <option>Active</option>
          <option>Admitted</option>
          <option>Discharged</option>
          <option>Inactive</option>
        </select>
        <select className="input sm:w-44" value={catF} onChange={(e) => setCatF(e.target.value)}>
          <option value="">All categories</option>
          <option>VIP</option>
          <option>Senior Citizen</option>
          <option>Pediatric</option>
          <option>Insurance</option>
          <option>Cash</option>
        </select>
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={8} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : filtered.length === 0 ? <div className="card"><Empty title={q || statusF ? 'No patients match your filters' : 'No patients registered yet'} desc={q || statusF ? undefined : 'Register the first patient to get started.'} action={canEdit && !q ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><UserPlus size={15} /> Register patient</button> : undefined} /></div>
        : (
          <>
            {/* desktop table */}
            <div className="table-wrap hidden md:block">
              <table className="grid-table">
                <thead><tr><th>Patient</th><th>Patient ID</th><th>Age / Gender</th><th>Tags</th><th>Contact</th><th>Registered</th><th>Status</th></tr></thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} onClick={() => nav(`/app/patients/${r.id}`)} className="cursor-pointer">
                      <td><div className="flex items-center gap-2.5"><Avatar name={r.name} size={32} /><span className="font-semibold">{r.name}</span></div></td>
                      <td className="font-mono text-[13px]">{r.patient_id}</td>
                      <td>{r.age}y · {r.gender}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {getTags(r).slice(0, 2).map(t => <span key={t} className="badge bg-slate-100 dark:bg-slate-800 text-[10px] !px-1.5">{t}</span>)}
                        </div>
                      </td>
                      <td><span className="flex items-center gap-1.5 text-[13px]"><Phone size={13} className="opacity-50" />{r.phone}</span></td>
                      <td className="text-[13px]">{fmtDate(r.registration_date)}</td>
                      <td><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* mobile cards */}
            <div className="grid gap-3 md:hidden">
              {pageRows.map((r) => (
                <button key={r.id} onClick={() => nav(`/app/patients/${r.id}`)} className="card p-4 text-left flex items-center gap-3">
                  <Avatar name={r.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{r.name}</div>
                    <div className="text-xs opacity-55">{r.patient_id} · {r.age}y {r.gender} · {r.phone}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {getTags(r).map(t => <span key={t} className="badge bg-slate-100 dark:bg-slate-800 text-[10px] !px-1.5">{t}</span>)}
                    </div>
                  </div>
                  <Badge status={r.status} />
                </button>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
          </>
        )}

      {showNew && (
        <Modal title="Register patient" subtitle="A new hospital file. The ID is generated automatically." onClose={() => setShowNew(false)} wide>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" required error={errors.name}>
              <input className="input" placeholder="e.g. Vikram Malhotra" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Age" required error={errors.age}>
                <input type="number" className="input" placeholder="42" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </Field>
              <Field label="Gender" required>
                <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </Field>
            </div>
            <Field label="Phone" required error={errors.phone}>
              <input className="input" placeholder="+91 98XXX XXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className="input" placeholder="patient@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Blood group">
              <select className="input" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                <option value="">Select…</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Emergency contact">
              <input className="input" placeholder="Name & phone" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input className="input" placeholder="Street, area, city" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
            <Field label="Insurance provider">
              <input className="input" placeholder="e.g. Star Health (optional)" value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} />
            </Field>
            <Field label="Policy number">
              <input className="input" placeholder="Policy no. (optional)" value={form.insurance_policy} onChange={(e) => setForm({ ...form, insurance_policy: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Registering…' : 'Register patient'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
