import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { get, post, put, fmtDate, inr, todayISO } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Badge, Empty, LoadError, SkeletonRows, SectionHead, Stat } from '../components/ui';

const CATS = ['Consultation', 'Room charges', 'Medicines', 'Laboratory', 'Radiology', 'Procedure', 'Package', 'Other'];

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusF, setStatusF] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [payFor, setPayFor] = useState<any>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [refundFor, setRefundFor] = useState<any>(null);
  const [refundReason, setRefundReason] = useState('');
  const [form, setForm] = useState<any>({ patient_id: '', items: [{ category: 'Consultation', description: 'General consultation', amount: '500' }], discount: '0', tax: '0' });
  const [saving, setSaving] = useState(false);

  const canBill = ['Admin', 'Accountant', 'Receptionist'].includes(user?.role || '');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [i, p] = await Promise.all([get('/api/invoices'), get('/api/patients')]);
      setRows(Array.isArray(i) ? i : []);
      setPatients(Array.isArray(p) ? p : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('new') === '1' && canBill) setShowNew(true); }, []);

  const shown = rows.filter((r) => !statusF || r.status === statusF);
  const collected = rows.reduce((s, r) => s + Number(r.paid || 0), 0);
  const outstanding = rows.reduce((s, r) => s + Number(r.balance || 0), 0);

  const formSubtotal = form.items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
  const formTotal = formSubtotal - (Number(form.discount) || 0) + (Number(form.tax) || 0);

  const addRow = () => setForm({ ...form, items: [...form.items, { category: 'Procedure', description: '', amount: '' }] });
  const setRow = (i: number, patch: any) => {
    const items = form.items.map((it: any, j: number) => (j === i ? { ...it, ...patch } : it));
    setForm({ ...form, items });
  };

  const create = async () => {
    if (!form.patient_id) return toast({ kind: 'error', title: 'Choose a patient' });
    if (form.items.some((it: any) => !it.description?.trim() || !(Number(it.amount) > 0))) return toast({ kind: 'error', title: 'Each line needs a description and amount' });
    setSaving(true);
    try {
      const inv = await post('/api/invoices', {
        invoice_number: `INV-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4, '0')}`,
        patient_id: Number(form.patient_id),
        items: form.items.map((it: any) => ({ category: it.category, description: it.description, amount: Number(it.amount) })),
        subtotal: form.items.reduce((s: number, it: any) => s + Number(it.amount), 0),
        discount: Number(form.discount) || 0,
        tax: Number(form.tax) || 0,
        total: Math.max(0, formTotal),
        paid: 0,
        balance: Math.max(0, formTotal),
        status: 'Unpaid',
        created_by: user!.name,
        invoice_date: todayISO(),
      });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Created invoice ${inv.invoice_number} for ${inv.patient?.name}`, module: 'Billing' });
      toast({ kind: 'success', title: 'Invoice created', desc: inv.invoice_number });
      setShowNew(false);
      setForm({ patient_id: '', items: [{ category: 'Consultation', description: 'General consultation', amount: '500' }], discount: '0', tax: '0' });
      load();
    } catch (e: any) { toast({ kind: 'error', title: 'Failed to create invoice', desc: e.message }); }
    setSaving(false);
  };

  const recordPayment = async () => {
    const amt = Number(payAmt);
    if (!(amt > 0)) return toast({ kind: 'error', title: 'Enter a valid amount' });
    if (amt > Number(payFor.balance) + 1) return toast({ kind: 'error', title: 'Amount exceeds balance' });
    const paid = Number(payFor.paid) + amt;
    const balance = Math.max(0, Number(payFor.total) - paid);
    try {
      await put('/api/invoices', { id: payFor.id, paid, balance, status: balance === 0 ? 'Paid' : 'Partial' });
      await post('/api/audit', { user_name: user!.name, user_role: user!.role, action: `Recorded payment of ${inr(amt)} on ${payFor.invoice_number} via ${payMethod}`, module: 'Billing' });
      toast({ kind: 'success', title: 'Payment recorded', desc: `${inr(amt)} on ${payFor.invoice_number} via ${payMethod}` });
      setPayFor(null);
      setPayAmt('');
      setPayMethod('Cash');
      load();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to record payment', desc: e.message });
    }
  };

  return (
    <div>
      <SectionHead title="Billing" desc="Invoices, payments and outstanding balances."
        action={canBill ? <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={15} /> New invoice</button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Collected" value={inr(collected)} icon={<Receipt size={19} />} />
        <Stat label="Outstanding" value={inr(outstanding)} icon={<Receipt size={19} />} />
        <Stat label="Open invoices" value={rows.filter((r) => r.status !== 'Paid').length} />
        <Stat label="Paid invoices" value={rows.filter((r) => r.status === 'Paid').length} />
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto scroll-thin">
        {['', 'Unpaid', 'Partial', 'Paid', 'Refunded'].map((s) => (
          <button key={s || 'all'} onClick={() => setStatusF(s)} className={`tab-btn ${statusF === s ? 'active' : ''}`}>{s || 'All'}</button>
        ))}
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={7} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : shown.length === 0 ? <div className="card"><Empty title="No invoices in this view" /></div>
        : (
          <div className="table-wrap">
            <table className="grid-table">
              <thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th className="!text-right">Total</th><th className="!text-right">Paid</th><th className="!text-right">Balance</th><th>Status</th><th className="!text-right">Actions</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono font-semibold text-[13px]">{r.invoice_number}</td>
                    <td className="font-semibold cursor-pointer hover:underline" onClick={() => nav(`/app/patients/${r.patient_id}`)}>{r.patient?.name}</td>
                    <td className="text-[13px]">{fmtDate(r.invoice_date || (r.created_at || '').slice(0, 10))}</td>
                    <td className="!text-right font-bold">{inr(r.total)}</td>
                    <td className="!text-right">{inr(r.paid)}</td>
                    <td className={`!text-right font-bold ${Number(r.balance) > 0 ? 'text-red-600' : ''}`}>{inr(r.balance)}</td>
                    <td><Badge status={r.status} /></td>
                    <td className="!text-right whitespace-nowrap">
                      <button className="btn btn-ghost btn-sm mr-1.5" onClick={() => nav(`/app/invoice/${r.id}`)}>View</button>
                      {canBill && r.status !== 'Paid' && r.status !== 'Refunded' && <button className="btn btn-teal btn-sm mr-1.5" onClick={() => { setPayFor(r); setPayAmt(String(r.balance)); setPayMethod('Cash'); }}>Collect</button>}
                      {canBill && (r.status === 'Paid' || r.status === 'Partial') && <button className="btn btn-ghost btn-sm" onClick={() => setRefundFor(r)}>Refund</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {showNew && (
        <Modal title="New invoice" subtitle="Line items, discount and tax." onClose={() => setShowNew(false)} wide>
          <Field label="Patient" required>
            <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.patient_id}</option>)}
            </select>
          </Field>
          <div className="mt-4 space-y-2.5">
            {form.items.map((it: any, i: number) => (
              <div key={i} className="grid grid-cols-[130px_1fr_120px_36px] gap-2">
                <select className="input" value={it.category} onChange={(e) => setRow(i, { category: e.target.value })}>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input className="input" placeholder="Description" value={it.description} onChange={(e) => setRow(i, { description: e.target.value })} />
                <input type="number" className="input" placeholder="₹" value={it.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                <button className="btn btn-ghost btn-sm !px-2" onClick={() => setForm({ ...form, items: form.items.filter((_: any, j: number) => j !== i) })} disabled={form.items.length === 1} aria-label="Remove line"><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addRow}><Plus size={14} /> Add line</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Field label="Discount (₹)"><input type="number" className="input" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
            <Field label="Tax (₹)"><input type="number" className="input" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></Field>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-50">Total</div>
              <div className="text-lg font-bold">{inr(Math.max(0, formTotal))}</div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create invoice'}</button>
          </div>
        </Modal>
      )}

      {payFor && (
        <Modal title={`Collect payment`} subtitle={`${payFor.invoice_number} · Balance ${inr(payFor.balance)}`} onClose={() => setPayFor(null)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₹)">
              <input type="number" className="input" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
            </Field>
            <Field label="Payment Method">
              <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option>Cash</option>
                <option>Card</option>
                <option>UPI</option>
                <option>Insurance</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setPayFor(null)}>Cancel</button>
            <button className="btn btn-teal" onClick={recordPayment}>Record payment</button>
          </div>
        </Modal>
      )}

      {refundFor && (
        <Modal title={`Request Refund`} subtitle={`${refundFor.invoice_number} · Paid: ${inr(refundFor.paid)}`} onClose={() => { setRefundFor(null); setRefundReason(''); }}>
          <Field label="Reason for refund" required>
            <input className="input" placeholder="e.g. Overcharged, cancelled procedure" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          </Field>
          <div className="flex items-center gap-2 text-[13px] opacity-60 mt-4 mb-2">
            <Receipt size={14} /> Refund requests are saved and sent to Admin for approval.
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => { setRefundFor(null); setRefundReason(''); }}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => {
              if (!refundReason.trim()) return toast({ kind: 'error', title: 'Please provide a reason' });
              try {
                await post('/api/approvals', {
                  type: 'Refund',
                  requested_by: user!.name,
                  reason: `${refundReason.trim()} (Invoice: ${refundFor.invoice_number})`,
                  reference_id: refundFor.invoice_number,
                  amount: Number(refundFor.paid) || 0,
                  status: 'Pending',
                });
                toast({ kind: 'success', title: 'Refund Requested', desc: 'Sent to admin for approval.' });
                setRefundFor(null);
                setRefundReason('');
              } catch (e: any) {
                toast({ kind: 'error', title: 'Failed to request refund', desc: e.message });
              }
            }}>Submit Request</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
