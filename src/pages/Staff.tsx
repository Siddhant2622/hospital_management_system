import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShieldCheck, Mail, Trash2, KeyRound, Eye, EyeOff, Lock } from 'lucide-react';
import { get, post, put, del } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, SkeletonRows, Pagination, SectionHead, Avatar } from '../components/ui';
import { ALL_HOSPITAL_DEPARTMENTS } from '../lib/departments';

export default function Staff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [deptF, setDeptF] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Add staff modal state
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: 'Nurse',
    department: 'General',
    email: '',
    phone: '',
    password: '',
    status: 'Active',
  });

  // Edit staff modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: 0,
    name: '',
    role: 'Nurse',
    department: 'General',
    email: '',
    phone: '',
    password: '',
    status: 'Active',
  });

  const perPage = 10;
  const canManage = user?.role === 'Admin';

  const ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Accountant'];
  const [departments, setDepartments] = useState<string[]>([...ALL_HOSPITAL_DEPARTMENTS]);

  const load = async () => {
    setLoading(true);
    try {
      const [data, deptData] = await Promise.all([
        get('/api/staff'),
        get('/api/departments').catch(() => [])
      ]);
      setRows(Array.isArray(data) ? data : []);
      if (Array.isArray(deptData) && deptData.length > 0) {
        const names = deptData.map((d: any) => d.name).filter(Boolean);
        const merged = Array.from(new Set([...ALL_HOSPITAL_DEPARTMENTS, ...names]));
        setDepartments(merged);
      }
    } catch {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleF && r.role !== roleF) return false;
      if (deptF && r.department !== deptF) return false;
      if (!needle) return true;
      return [r.name, r.email, r.phone].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [rows, q, roleF, deptF]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  // Save new staff
  const saveNew = async () => {
    if (!form.name || !form.role) return toast({ kind: 'error', title: 'Name and role are required' });
    if (!form.password || form.password.length < 6) {
      return toast({ kind: 'error', title: 'Password is required (min 6 characters) for initial staff setup' });
    }
    setSaving(true);
    try {
      await post('/api/staff', form);
      toast({ kind: 'success', title: 'Staff profile & Supabase credentials created' });
      setShowNew(false);
      setForm({ name: '', role: 'Nurse', department: 'General', email: '', phone: '', password: '', status: 'Active' });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to create staff', desc: e.message });
    }
    setSaving(false);
  };

  // Open edit modal
  const openEdit = (staff: any) => {
    setEditForm({
      id: staff.id,
      name: staff.name || '',
      role: staff.role || 'Nurse',
      department: staff.department || 'General',
      email: staff.email || '',
      phone: staff.phone || '',
      password: '',
      status: staff.status || 'Active',
    });
    setShowPassword(false);
    setShowEdit(true);
  };

  // Save edit staff
  const saveEdit = async () => {
    if (!editForm.name || !editForm.role) return toast({ kind: 'error', title: 'Name and role are required' });
    setSaving(true);
    try {
      const { password: _pwd, ...payload } = editForm;
      await put('/api/staff', payload);
      toast({
        kind: 'success',
        title: 'Staff updated successfully',
        desc: 'Profile and department details saved.',
      });
      setShowEdit(false);
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update staff', desc: e.message });
    }
    setSaving(false);
  };

  // Delete staff
  const removeStaff = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name}? This will revoke their access to the hospital portal.`)) {
      return;
    }
    try {
      await del(`/api/staff?id=${id}`, { id });
      toast({ kind: 'success', title: 'Staff member removed', desc: `${name}'s access was revoked.` });
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to remove staff', desc: e.message });
    }
  };

  return (
    <div>
      <SectionHead
        title="Staff Directory & Access Control"
        desc="Manage hospital personnel, roles, and login credentials."
        action={
          canManage ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
              <Plus size={15} /> Add Staff
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input className="input !pl-10" placeholder="Search staff by name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-40" value={roleF} onChange={(e) => setRoleF(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select className="input sm:w-60" value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="">All departments ({rows.length})</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card p-4">
          <SkeletonRows rows={8} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty title="No staff members found" desc="Adjust your filters or add new staff." />
        </div>
      ) : (
        <>
          <div className="table-wrap hidden md:block">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Contact</th>
                  <th>Status</th>
                  {canManage && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} size={32} />
                        <div>
                          <span className="font-semibold block">{r.name}</span>
                          <span className="text-xs opacity-50 flex items-center gap-1">
                            <ShieldCheck size={12} className="text-teal-600" /> {r.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td><span className="font-medium">{r.role}</span></td>
                    <td>{r.department}</td>
                    <td>
                      <div className="text-[13px]">
                        <span className="block font-medium">{r.email || '—'}</span>
                        <span className="opacity-60">{r.phone || '—'}</span>
                      </div>
                    </td>
                    <td><Badge status={r.status || 'Active'} /></td>
                    {canManage && (
                      <td>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs py-1 px-2.5"
                            onClick={() => openEdit(r)}
                            title="Edit staff profile"
                          >
                            <KeyRound size={13} className="text-med-600" />
                            <span>Edit Profile</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 p-1.5"
                            onClick={() => removeStaff(r.id, r.name)}
                            title="Remove staff"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {pageRows.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{r.name}</div>
                    <div className="text-sm opacity-60">{r.role} · {r.department}</div>
                    <div className="text-xs opacity-70 mt-0.5 truncate">{r.email}</div>
                  </div>
                  <Badge status={r.status || 'Active'} />
                </div>
                {canManage && (
                  <div className="mt-3 pt-3 border-t hairline flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"
                      onClick={() => openEdit(r)}
                    >
                      <KeyRound size={13} /> Edit / Access
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-red-600"
                      onClick={() => removeStaff(r.id, r.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
        </>
      )}

      {/* ADD STAFF MODAL */}
      {showNew && (
        <Modal title="Add Staff Member" subtitle="Create profile and Supabase login credentials." onClose={() => setShowNew(false)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Full name" required>
                <input className="input" placeholder="e.g. Dr. Rajesh Kumar" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Role" required>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Login Email Address" hint="Used to sign in to the portal">
                <input className="input" type="email" placeholder="staff@abhishree.hospital" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Login Password (One-Time Creation — Permanent)"
                hint="Initial password for Supabase Auth (min 6 characters). Cannot be changed after creation."
                required
              >
                <div className="relative">
                  <input
                    className="input !pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter permanent staff password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
            </div>
            <Field label="Phone">
              <input className="input" placeholder="+91 98765 00000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Account Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveNew} disabled={saving}>{saving ? 'Creating...' : 'Create Staff & Access'}</button>
          </div>
        </Modal>
      )}

      {/* EDIT STAFF & CREDENTIALS MODAL */}
      {showEdit && (
        <Modal
          title={`Edit ${editForm.name}`}
          subtitle="Update staff details, assigned role, and contact information."
          onClose={() => setShowEdit(false)}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Full name" required>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Role" required>
              <select className="input" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select className="input" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Login Email Address" hint="Changing this modifies their Supabase login ID">
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input
                    className="input !pl-9"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-3">
                <Lock size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-amber-900 dark:text-amber-200">Password Permanently Locked</div>
                  <div className="opacity-75 mt-0.5 text-amber-800 dark:text-amber-300">
                    Per hospital security policy, staff passwords can only be configured once by the Admin during creation and cannot be modified again.
                  </div>
                </div>
              </div>
            </div>
            <Field label="Phone">
              <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </Field>
            <Field label="Account Status">
              <select className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Profile Changes'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
