import { useEffect, useState, useRef, useCallback } from 'react';
import {
  FileText, Upload, Trash2, Eye, Plus, AlertTriangle, CheckCircle2,
  Clock, Download, Search, Filter, RefreshCw, CalendarDays, XCircle,
  FileCheck, FileClock, ShieldAlert, X,
} from 'lucide-react';
import { get, post, put, del, fmtDate } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SectionHead, Modal, Field, Empty, LoadError, SkeletonRows } from '../components/ui';

/* ─────────────────────────────── types ─────────────────────────────── */
interface HospitalDocument {
  id: number;
  title: string;
  document_type: string;
  description?: string;
  expiry_date?: string;
  uploaded_by: string;
  uploaded_by_role?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  file_path?: string;
  file_url?: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  created_at: string;
}

/* ─────────────────────────────── constants ──────────────────────────── */
const DOC_TYPES = [
  'License & Registration',
  'Accreditation Certificate',
  'Fire NOC',
  'Staff ID Proof',
  'Insurance Policy',
  'Government Permit',
  'Lab Certification',
  'Equipment Certificate',
  'Contract Agreement',
  'Compliance Report',
  'Other',
];

const STATUS_COLORS: Record<string, string> = {
  Active: 'b-green',
  'Expiring Soon': 'b-amber',
  Expired: 'b-red',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Active: <CheckCircle2 size={14} className="text-emerald-500" />,
  'Expiring Soon': <Clock size={14} className="text-amber-500" />,
  Expired: <XCircle size={14} className="text-red-500" />,
};

function daysUntilExpiry(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T23:59:59').getTime() - Date.now();
  return Math.ceil(diff / 864e5);
}

function fmtBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ─────────────────────────────── upload helper ──────────────────────── */
async function uploadFileToStorage(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new Error(`File upload failed (${res.status})`);
}

/* ─────────────────────────────── upload modal ───────────────────────── */
function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    document_type: DOC_TYPES[0],
    description: '',
    expiry_date: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Document title is required';
    if (!file) e.file = 'Please select a file to upload';
    return e;
  };

  const handleFile = (f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      toast({ kind: 'error', title: 'File too large', desc: 'Maximum file size is 20 MB.' });
      return;
    }
    setFile(f);
    setErrors((e) => ({ ...e, file: '' }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const submit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      // 1. Create document record + get signed upload URL
      const result: any = await post('/api/documents', {
        title: form.title.trim(),
        document_type: form.document_type,
        description: form.description.trim() || undefined,
        expiry_date: form.expiry_date || undefined,
        uploaded_by: user?.name,
        uploaded_by_role: user?.role,
        file_name: file!.name,
        file_size: file!.size,
        file_mime: file!.type,
      });

      // 2. Upload the file using signed URL
      if (result.signedUploadUrl && file) {
        await uploadFileToStorage(result.signedUploadUrl, file);
      }

      toast({
        kind: 'success',
        title: 'Document uploaded',
        desc: `"${form.title}" has been saved successfully.`,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ kind: 'error', title: 'Upload failed', desc: err.message });
    }
    setSaving(false);
  };

  const daysLeft = form.expiry_date ? daysUntilExpiry(form.expiry_date) : null;

  return (
    <Modal title="Upload Document" subtitle="Add a document with its expiry date. Notifications will be sent automatically." onClose={onClose} wide>
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-med-500 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-med-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
        >
          <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-med-50 dark:bg-sky-950 flex items-center justify-center">
                <FileCheck size={22} className="text-med-600 dark:text-sky-300" />
              </div>
              <div className="font-semibold text-sm">{file.name}</div>
              <div className="text-xs opacity-55">{fmtBytes(file.size)} · {file.type || 'unknown type'}</div>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="btn btn-ghost btn-sm !text-red-500 mt-1">
                <X size={13} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Upload size={22} className="opacity-50" />
              </div>
              <div>
                <div className="font-semibold text-sm">Drag &amp; drop file here, or click to browse</div>
                <div className="text-xs opacity-55 mt-1">PDF, Word, Excel, Images · Max 20 MB</div>
              </div>
            </div>
          )}
        </div>
        {errors.file && <p className="text-xs text-red-600 font-medium -mt-2">{errors.file}</p>}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Document Title" required error={errors.title}>
            <input
              className="input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Fire Safety NOC 2026"
            />
          </Field>
          <Field label="Document Type" required>
            <select className="input" value={form.document_type} onChange={(e) => set('document_type', e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description" hint="Optional notes about this document">
          <textarea
            className="input resize-none"
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Any important notes or reference numbers…"
          />
        </Field>

        <Field label="Expiry Date" hint="Leave blank if this document does not expire">
          <input
            type="date"
            className="input"
            value={form.expiry_date}
            onChange={(e) => set('expiry_date', e.target.value)}
          />
        </Field>

        {/* Expiry warning preview */}
        {form.expiry_date && daysLeft !== null && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium border ${
            daysLeft < 0
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300'
              : daysLeft <= 7
              ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300'
          }`}>
            {daysLeft < 0 ? <XCircle size={16} /> : daysLeft <= 7 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>
              {daysLeft < 0
                ? `This document has already expired ${Math.abs(daysLeft)} day(s) ago.`
                : daysLeft === 0
                ? 'This document expires today!'
                : daysLeft === 1
                ? 'This document expires tomorrow — notifications will be sent.'
                : daysLeft <= 7
                ? `Expires in ${daysLeft} days — expiry notifications will be sent automatically.`
                : `Expires on ${fmtDate(form.expiry_date)} — you'll be notified 7 days before.`}
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button className="btn btn-ghost flex-1" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={saving}>
            {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Upload size={15} />}
            {saving ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────── view modal ─────────────────────────── */
function ViewModal({ doc, onClose, onDeleted, onUpdated }: { doc: HospitalDocument; onClose: () => void; onDeleted: () => void; onUpdated: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [editExpiry, setEditExpiry] = useState(false);
  const [newExpiry, setNewExpiry] = useState(doc.expiry_date || '');
  const [saving, setSaving] = useState(false);

  const daysLeft = daysUntilExpiry(doc.expiry_date);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await del('/api/documents', { id: doc.id });
      toast({ kind: 'success', title: 'Document deleted', desc: doc.title });
      onDeleted();
    } catch (err: any) {
      toast({ kind: 'error', title: 'Delete failed', desc: err.message });
    }
    setDeleting(false);
  };

  const handleUpdateExpiry = async () => {
    setSaving(true);
    try {
      await put('/api/documents', { id: doc.id, expiry_date: newExpiry || null });
      toast({ kind: 'success', title: 'Expiry updated', desc: `New expiry: ${newExpiry ? fmtDate(newExpiry) : 'None'}` });
      setEditExpiry(false);
      onUpdated();
    } catch (err: any) {
      toast({ kind: 'error', title: 'Update failed', desc: err.message });
    }
    setSaving(false);
  };

  const canEdit = user?.role === 'Admin' || user?.role === 'Receptionist';

  return (
    <Modal title={doc.title} subtitle={doc.document_type} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Status banner */}
        <div className={`flex items-center gap-3 rounded-2xl p-4 ${
          doc.status === 'Expired'
            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
            : doc.status === 'Expiring Soon'
            ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900'
        }`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/60 dark:bg-black/20">
            {STATUS_ICONS[doc.status]}
          </div>
          <div>
            <div className="font-bold text-sm">{doc.status}</div>
            <div className="text-xs opacity-70">
              {doc.expiry_date
                ? daysLeft !== null && daysLeft < 0
                  ? `Expired ${Math.abs(daysLeft)} day(s) ago (${fmtDate(doc.expiry_date)})`
                  : daysLeft === 0
                  ? `Expires today (${fmtDate(doc.expiry_date)})`
                  : `Expires in ${daysLeft} day(s) on ${fmtDate(doc.expiry_date)}`
                : 'No expiry date set'}
            </div>
          </div>
          <span className={`ml-auto badge ${STATUS_COLORS[doc.status] || 'b-slate'}`}>{doc.status}</span>
        </div>

        {/* Details grid */}
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-50 font-bold mb-0.5">Uploaded by</div>
            <div className="font-semibold">{doc.uploaded_by} <span className="opacity-50 font-normal">· {doc.uploaded_by_role}</span></div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-50 font-bold mb-0.5">Upload Date</div>
            <div className="font-semibold">{fmtDate(doc.created_at?.slice(0, 10))}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-50 font-bold mb-0.5">File</div>
            <div className="font-semibold">{doc.file_name || '—'} <span className="opacity-50 font-normal">({fmtBytes(doc.file_size)})</span></div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-50 font-bold mb-0.5">Expiry Date</div>
            {editExpiry ? (
              <div className="flex items-center gap-2">
                <input type="date" className="input !py-1 !text-sm" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={handleUpdateExpiry} disabled={saving}>
                  {saving ? '…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditExpiry(false)}>Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{doc.expiry_date ? fmtDate(doc.expiry_date) : 'No expiry'}</span>
                {canEdit && (
                  <button className="text-xs text-med-600 hover:underline" onClick={() => setEditExpiry(true)}>Edit</button>
                )}
              </div>
            )}
          </div>
          {doc.description && (
            <div className="sm:col-span-2">
              <div className="text-[11px] uppercase tracking-wider opacity-50 font-bold mb-0.5">Description</div>
              <div className="opacity-80 leading-relaxed">{doc.description}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {doc.file_url && (
            <>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                <Eye size={14} /> Preview
              </a>
              <a href={doc.file_url} download={doc.file_name} className="btn btn-primary btn-sm">
                <Download size={14} /> Download
              </a>
            </>
          )}
          {canEdit && (
            <button className="btn btn-ghost btn-sm !text-red-500 ml-auto" onClick={handleDelete} disabled={deleting}>
              {deleting ? <span className="animate-spin w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full" /> : <Trash2 size={14} />}
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────── main page ──────────────────────────── */
export default function ReceptionDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<HospitalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [viewDoc, setViewDoc] = useState<HospitalDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const data = await get('/api/documents');
      setDocs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter((d) => {
    if (typeFilter !== 'All' && d.document_type !== typeFilter) return false;
    if (statusFilter !== 'All' && d.status !== statusFilter) return false;
    if (search && !`${d.title} ${d.document_type} ${d.uploaded_by}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const total = docs.length;
  const active = docs.filter((d) => d.status === 'Active').length;
  const expiringSoon = docs.filter((d) => d.status === 'Expiring Soon').length;
  const expired = docs.filter((d) => d.status === 'Expired').length;

  const canUpload = user?.role === 'Admin' || user?.role === 'Receptionist';

  return (
    <div>
      <SectionHead
        title="Hospital Documents"
        desc="Manage compliance certificates, licenses, and official documents. Expiry alerts are sent automatically."
        action={
          canUpload ? (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Plus size={15} /> Upload Document
            </button>
          ) : undefined
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Documents', value: total, icon: <FileText size={18} />, color: 'text-med-600 dark:text-sky-300', bg: 'bg-med-50 dark:bg-sky-950' },
          { label: 'Active', value: active, icon: <FileCheck size={18} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950' },
          { label: 'Expiring Soon', value: expiringSoon, icon: <FileClock size={18} />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
          { label: 'Expired', value: expired, icon: <ShieldAlert size={18} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-[22px] font-bold leading-tight">{s.value}</div>
              <div className="text-[12px] opacity-55 font-medium">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            className="input !pl-8 !py-2 text-sm"
            placeholder="Search title, type, uploader…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={14} className="opacity-40" />
          <select className="input !py-1.5 !text-sm w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="All">All Types</option>
            {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex gap-1 flex-wrap">
          {['All', 'Active', 'Expiring Soon', 'Expired'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? 'active' : ''}`}>{s}</button>
          ))}
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm ml-auto" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-4"><SkeletonRows rows={6} /></div>
      ) : err ? (
        <div className="card"><LoadError message={err} onRetry={load} /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty
            title={docs.length === 0 ? 'No documents yet' : 'No matching documents'}
            desc={docs.length === 0
              ? 'Upload your first hospital document to get started. Expiry alerts will be sent automatically.'
              : 'Try adjusting your search or filters.'}
            action={canUpload && docs.length === 0 ? (
              <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                <Upload size={14} /> Upload First Document
              </button>
            ) : undefined}
            icon={<FileText size={24} className="opacity-40" />}
          />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b hairline text-[11px] font-bold uppercase tracking-wider opacity-60">
            <span>Document</span>
            <span>Type</span>
            <span>Uploaded By</span>
            <span>Expiry Date</span>
            <span>Status</span>
            <span></span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((doc) => {
              const daysLeft = daysUntilExpiry(doc.expiry_date);
              return (
                <div
                  key={doc.id}
                  className={`grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 items-center px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                    doc.status === 'Expired' ? 'bg-red-50/40 dark:bg-red-950/10' : doc.status === 'Expiring Soon' ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                  }`}
                  onClick={() => setViewDoc(doc)}
                >
                  {/* Title + description */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      doc.status === 'Expired' ? 'bg-red-100 dark:bg-red-950' : doc.status === 'Expiring Soon' ? 'bg-amber-100 dark:bg-amber-950' : 'bg-med-50 dark:bg-sky-950'
                    }`}>
                      {STATUS_ICONS[doc.status] || <FileText size={16} className="opacity-50" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{doc.title}</div>
                      {doc.description && <div className="text-xs opacity-50 truncate">{doc.description}</div>}
                      {doc.file_name && <div className="text-[11px] opacity-40 truncate">{doc.file_name}</div>}
                    </div>
                  </div>

                  {/* Type */}
                  <div className="text-[13px] opacity-70 hidden sm:block truncate">{doc.document_type}</div>

                  {/* Uploaded by */}
                  <div className="text-[13px] opacity-70 hidden sm:block truncate">
                    {doc.uploaded_by}
                    {doc.uploaded_by_role && <span className="block text-[11px] opacity-55">{doc.uploaded_by_role}</span>}
                  </div>

                  {/* Expiry */}
                  <div className="hidden sm:block">
                    {doc.expiry_date ? (
                      <div>
                        <div className={`text-[13px] font-semibold flex items-center gap-1 ${
                          daysLeft !== null && daysLeft < 0 ? 'text-red-600 dark:text-red-400' : daysLeft !== null && daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : ''
                        }`}>
                          <CalendarDays size={12} />
                          {fmtDate(doc.expiry_date)}
                        </div>
                        <div className="text-[11px] opacity-55">
                          {daysLeft === null ? '' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] opacity-40">No expiry</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="hidden sm:block">
                    <span className={`badge ${STATUS_COLORS[doc.status] || 'b-slate'}`}>{doc.status}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm !px-2" title="Preview" onClick={(e) => e.stopPropagation()}>
                        <Eye size={14} />
                      </a>
                    )}
                    {canUpload && (
                      <button
                        className="btn btn-ghost btn-sm !px-2 !text-red-500"
                        title="Delete"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Delete "${doc.title}"?`)) return;
                          try {
                            await del('/api/documents', { id: doc.id });
                            toast({ kind: 'success', title: 'Deleted', desc: doc.title });
                            load();
                          } catch (err: any) {
                            toast({ kind: 'error', title: 'Delete failed', desc: err.message });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t hairline text-xs opacity-50 text-right">
            {filtered.length} of {docs.length} document(s) · Notifications sent automatically on expiry
          </div>
        </div>
      )}

      {/* Expiry alert panel */}
      {(expiringSoon > 0 || expired > 0) && (
        <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 border text-sm ${
          expired > 0
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300'
        }`}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Document Expiry Attention Required</div>
            <div className="opacity-80 mt-0.5">
              {expired > 0 && <span className="font-semibold">{expired} document(s) have expired. </span>}
              {expiringSoon > 0 && <span>{expiringSoon} document(s) are expiring within 7 days. </span>}
              Admin and Receptionist have been notified via in-app notifications.
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSaved={load} />}
      {viewDoc && (
        <ViewModal
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
          onDeleted={() => { setViewDoc(null); load(); }}
          onUpdated={() => { load(); setViewDoc(null); }}
        />
      )}
    </div>
  );
}
