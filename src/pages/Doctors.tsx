import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Stethoscope, Edit2, Trash2 } from 'lucide-react';
import { get, post, put, del } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SectionHead, Avatar } from '../components/ui';
import { CLINICAL_DEPARTMENTS, ALL_HOSPITAL_DEPARTMENTS } from '../lib/departments';

export default function Doctors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([...CLINICAL_DEPARTMENTS]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'doctors' | 'staff'>('doctors');
  const [dept, setDept] = useState('');

  // Modals state
  const [showNew, setShowNew] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<any | null>(null);

  // Forms state
  const [form, setForm] = useState({
    name: '',
    specialty: 'General Medicine',
    department: 'General Medicine',
    qualification: '',
    phone: '',
    email: '',
    consultation_fee: '500',
    schedule: 'Mon–Sat · 10:00–14:00'
  });

  const [editForm, setEditForm] = useState({
    id: 0,
    name: '',
    specialty: 'General Medicine',
    department: 'General Medicine',
    qualification: '',
    phone: '',
    email: '',
    consultation_fee: '500',
    schedule: 'Mon–Sat · 10:00–14:00'
  });

  const isAdmin = user?.role === 'Admin';

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const [d, s, deptData] = await Promise.all([
        get('/api/doctors'),
        get('/api/staff'),
        get('/api/departments').catch(() => [])
      ]);
      setDoctors(Array.isArray(d) ? d : []);
      setStaff(Array.isArray(s) ? s : []);
      if (Array.isArray(deptData) && deptData.length > 0) {
        const names = deptData.map((dp: any) => dp.name).filter(Boolean);
        const merged = Array.from(new Set([...CLINICAL_DEPARTMENTS, ...names]));
        setDepartments(merged);
      }
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const shown = doctors.filter((d) => !dept || d.department === dept || d.specialty === dept);
  const shownStaff = staff.filter((s) => !dept || s.department === dept);

  const add = async () => {
    if (!form.name.trim()) return toast({ kind: 'error', title: 'Doctor name is required' });
    try {
      await post('/api/doctors', {
        ...form,
        consultation_fee: Number(form.consultation_fee) || 0,
        status: 'Available'
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Added doctor ${form.name} (${form.specialty})`,
        module: 'Staff'
      });
      toast({ kind: 'success', title: 'Doctor added', desc: form.name });
      setShowNew(false);
      setForm({
        name: '',
        specialty: departments[0] || 'General Medicine',
        department: departments[0] || 'General Medicine',
        qualification: '',
        phone: '',
        email: '',
        consultation_fee: '500',
        schedule: 'Mon–Sat · 10:00–14:00'
      });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to add doctor', desc: e.message });
    }
  };

  const startEditDoc = (d: any) => {
    setEditDoc(d);
    setEditForm({
      id: d.id,
      name: d.name || '',
      specialty: d.specialty || d.department || 'General Medicine',
      department: d.department || d.specialty || 'General Medicine',
      qualification: d.qualification || '',
      phone: d.phone || '',
      email: d.email || '',
      consultation_fee: String(d.consultation_fee ?? '500'),
      schedule: d.schedule || 'Mon–Sat · 10:00–14:00'
    });
  };

  const saveEditDoc = async () => {
    if (!editForm.name.trim()) return toast({ kind: 'error', title: 'Doctor name is required' });
    try {
      await put('/api/doctors', {
        id: editForm.id,
        name: editForm.name.trim(),
        specialty: editForm.specialty,
        department: editForm.department,
        qualification: editForm.qualification.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        consultation_fee: Number(editForm.consultation_fee) || 0,
        schedule: editForm.schedule.trim()
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Updated doctor ${editForm.name} (${editForm.specialty})`,
        module: 'Staff'
      });
      toast({ kind: 'success', title: 'Doctor profile updated', desc: editForm.name });
      setEditDoc(null);
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update doctor', desc: e.message });
    }
  };

  const deleteDoc = async () => {
    if (!deleteDocConfirm) return;
    try {
      await del('/api/doctors', { id: deleteDocConfirm.id });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Deleted doctor ${deleteDocConfirm.name}`,
        module: 'Staff'
      });
      toast({ kind: 'success', title: 'Doctor removed', desc: deleteDocConfirm.name });
      setDeleteDocConfirm(null);
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to delete doctor', desc: e.message });
    }
  };

  const toggle = async (d: any) => {
    const next = d.status === 'Available' ? 'On Leave' : 'Available';
    try {
      await put('/api/doctors', { id: d.id, status: next });
      toast({ kind: 'success', title: `${d.name} → ${next}` });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update doctor status', desc: e.message });
    }
  };

  return (
    <div>
      <SectionHead
        title="Doctors & staff"
        desc={`${doctors.length} doctors · ${staff.length} staff members across ${departments.length} departments`}
        action={
          isAdmin ? (
            <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => setShowNew(true)}>
              <Plus size={15} /> Add doctor
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center mb-4">
        <div className="flex gap-1.5">
          <button onClick={() => setTab('doctors')} className={`tab-btn ${tab === 'doctors' ? 'active' : ''}`}>
            Doctors ({doctors.length})
          </button>
          <button onClick={() => setTab('staff')} className={`tab-btn ${tab === 'staff' ? 'active' : ''}`}>
            Staff directory ({staff.length})
          </button>
        </div>

        <select className="input !w-auto sm:ml-auto max-w-xs text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {(tab === 'doctors' ? departments : ALL_HOSPITAL_DEPARTMENTS).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-28" />
            </div>
          ))}
        </div>
      ) : err ? (
        <div className="card">
          <LoadError message={err} onRetry={load} />
        </div>
      ) : tab === 'doctors' ? (
        shown.length === 0 ? (
          <div className="card">
            <Empty
              title={dept ? `No doctors in ${dept}` : 'No doctors found'}
              desc={dept ? `Try selecting another department or adding a specialist in ${dept}.` : 'Add doctors to your hospital roster.'}
              action={
                dept ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => setDept('')}>
                    View all departments
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {shown.map((d) => (
              <div key={d.id} className="card p-5 hover:shadow-lg transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3.5">
                    <Avatar name={d.name} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[16px]">{d.name}</div>
                      <div className="text-[13px] opacity-60">
                        {d.specialty} {d.qualification ? `· ${d.qualification}` : ''}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="badge b-blue">{d.department || d.specialty}</span>
                        <Badge status={d.status === 'Available' ? 'Available' : 'Cancelled'}>{d.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3.5 pt-3.5 border-t hairline text-[13px] space-y-1 opacity-75">
                    <div className="flex justify-between">
                      <span>Schedule</span>
                      <span className="font-semibold">{d.schedule || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Consultation</span>
                      <span className="font-semibold">₹{Number(d.consultation_fee || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contact</span>
                      <span className="font-semibold">{d.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t hairline">
                  <button className="btn btn-ghost btn-sm flex-1 text-xs" onClick={() => nav(`/app/appointments?new=1`)}>
                    <Stethoscope size={13} /> Book visit
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm text-xs"
                        onClick={() => toggle(d)}
                        title="Toggle active / on leave"
                      >
                        {d.status === 'Available' ? 'Leave' : 'Active'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm !px-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        onClick={() => startEditDoc(d)}
                        title="Edit doctor details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm !px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        onClick={() => setDeleteDocConfirm(d)}
                        title="Delete doctor"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : shownStaff.length === 0 ? (
        <div className="card">
          <Empty
            title={dept ? `No staff records in ${dept}` : 'No staff records'}
            desc={dept ? `Try selecting another department.` : 'Staff profiles will appear here once added.'}
            action={
              dept ? (
                <button className="btn btn-secondary btn-sm" onClick={() => setDept('')}>
                  View all staff
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Employee ID</th>
                <th>Role</th>
                <th>Department</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shownStaff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} size={32} />
                      <span className="font-semibold">{s.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-[13px]">{s.employee_id || `EMP-${s.id}`}</td>
                  <td>
                    <span className="badge b-slate">{s.role}</span>
                  </td>
                  <td>
                    <span className="badge b-blue">{s.department || 'General'}</span>
                  </td>
                  <td className="text-[13px]">
                    <div>{s.email}</div>
                    <div className="opacity-60">{s.phone}</div>
                  </td>
                  <td>
                    <Badge status={s.status || 'Active'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================== */}
      {/* ADD DOCTOR MODAL */}
      {/* ============================================================== */}
      {showNew && (
        <Modal title="Add doctor" subtitle="Joins the roster and booking lists immediately." onClose={() => setShowNew(false)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Full name" required>
                <input
                  className="input"
                  placeholder="Dr. Rajesh Kumar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Specialty / Department" required>
              <select
                className="input"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value, department: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qualification">
              <input
                className="input"
                placeholder="MBBS, MD, MS, DNB"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className="input"
                placeholder="+91 98765 00000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                placeholder="doctor@abhishree.hospital"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Consultation fee (₹)">
              <input
                type="number"
                min="0"
                className="input"
                value={form.consultation_fee}
                onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
              />
            </Field>
            <Field label="Schedule">
              <input
                className="input"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                placeholder="Mon–Sat · 10:00–14:00"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={add}>
              Add doctor
            </button>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* EDIT DOCTOR MODAL */}
      {/* ============================================================== */}
      {editDoc && (
        <Modal title="Edit doctor profile" subtitle={`Dr. ${editDoc.name} · ID #${editDoc.id}`} onClose={() => setEditDoc(null)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Full name" required>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Specialty / Department" required>
              <select
                className="input"
                value={editForm.specialty}
                onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value, department: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qualification">
              <input
                className="input"
                value={editForm.qualification}
                onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className="input"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </Field>
            <Field label="Consultation fee (₹)">
              <input
                type="number"
                min="0"
                className="input"
                value={editForm.consultation_fee}
                onChange={(e) => setEditForm({ ...editForm, consultation_fee: e.target.value })}
              />
            </Field>
            <Field label="Schedule">
              <input
                className="input"
                value={editForm.schedule}
                onChange={(e) => setEditForm({ ...editForm, schedule: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setEditDoc(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveEditDoc}>
              Save changes
            </button>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* DELETE DOCTOR CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {deleteDocConfirm && (
        <Modal title="Delete doctor" onClose={() => setDeleteDocConfirm(null)}>
          <div className="py-2">
            <p className="text-sm">
              Are you sure you want to remove <strong className="font-semibold text-red-600">{deleteDocConfirm.name}</strong> ({deleteDocConfirm.specialty}) from the hospital doctor roster?
            </p>
            <p className="text-xs opacity-60 mt-2">
              Patients will no longer be able to book consultations with this profile.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setDeleteDocConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={deleteDoc}>
              Confirm Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
