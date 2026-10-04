import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { get, put } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Badge, Empty, LoadError, SkeletonRows, SectionHead } from '../components/ui';

const TYPES = ['All', 'Appointment', 'Lab result', 'Critical', 'Stock', 'Payment', 'System', 'Prescription'];

export default function Notifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [type, setType] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const d = await get(`/api/notifications?role=${encodeURIComponent(user?.role || 'All')}`);
      setRows(Array.isArray(d) ? d : []);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const shown = rows.filter((r) => (type === 'All' || r.type === type) && (!unreadOnly || !r.is_read));

  const markOne = async (n: any) => {
    if (n.is_read) return;
    await put('/api/notifications', { id: n.id, is_read: true });
    load();
  };
  const markAll = async () => {
    await put('/api/notifications', { mark_all: true, role: user!.role });
    load();
  };

  const iconColor: Record<string, string> = { Critical: 'text-red-500', 'Lab result': 'text-teal-600', Appointment: 'text-sky-600', Stock: 'text-amber-600', Payment: 'text-emerald-600', System: 'text-slate-500', Prescription: 'text-purple-500' };

  return (
    <div>
      <SectionHead title="Notifications" desc="Reminders, results, alerts and system updates."
        action={<button className="btn btn-ghost btn-sm" onClick={markAll}><CheckCheck size={15} /> Mark all read</button>} />

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} className={`tab-btn ${type === t ? 'active' : ''}`}>{t}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="w-4 h-4 rounded accent-[#0e5aa7]" />
          <span className="opacity-70">Unread only</span>
        </label>
      </div>

      {loading ? <div className="card p-4"><SkeletonRows rows={8} /></div>
        : err ? <div className="card"><LoadError message={err} onRetry={load} /></div>
        : shown.length === 0 ? <div className="card"><Empty title="You're all caught up" desc="New notifications for your role will appear here." /></div>
        : (
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.map((n) => (
                <button key={n.id} onClick={() => markOne(n)} className={`w-full text-left px-5 py-3.5 flex gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${n.is_read ? '' : 'bg-sky-50/50 dark:bg-sky-950/20'}`}>
                  <Bell size={17} className={`shrink-0 mt-0.5 ${iconColor[n.type] || 'text-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{n.title}</div>
                    <div className="text-[13px] opacity-65 mt-0.5">{n.message}</div>
                    <div className="text-[11px] opacity-45 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <Badge status={n.type === 'Critical' ? 'Critical' : n.type === 'Lab result' ? 'Completed' : n.type === 'Stock' ? 'Pending' : 'Scheduled'}>{n.type}</Badge>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-sky-500" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
