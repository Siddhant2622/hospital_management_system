import { useEffect, useState } from 'react';
import { get, todayISO, fmtTime, inr } from '../lib/api';
import { Empty, LoadError, SectionHead, Stat, Meter } from '../components/ui';
import { Printer } from 'lucide-react';

export default function Reports() {
  const [d, setD] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [revFilter, setRevFilter] = useState('Monthly');

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const [dash, inv] = await Promise.all([get(`/api/dashboard?date=${todayISO()}`), get('/api/invoices')]);
        setD(dash);
        setInvoices(Array.isArray(inv) ? inv : []);
      } catch (e: any) { setErr(e.message); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4"><div className="card p-5"><div className="skeleton h-32" /></div><div className="card p-5"><div className="skeleton h-48" /></div></div>;
  if (err || !d) return <div className="card"><LoadError message={err} onRetry={() => location.reload()} /></div>;

  const k = d.kpis;
  const byCat: Record<string, number> = {};
  invoices.forEach((inv) => (inv.items || []).forEach((it: any) => {
    byCat[it.category || 'Other'] = (byCat[it.category || 'Other'] || 0) + Number(it.amount || 0);
  }));
  const revMax = Math.max(1, ...Object.values(byCat));

  return (
    <div>
      <SectionHead title="Reports & analytics" desc="Hospital performance, readable at a glance."
        action={<button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}><Printer size={15} /> Print</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Registered patients" value={k.totalPatients} />
        <Stat label="Bed occupancy" value={`${k.occupancyRate}%`} sub={`${k.totalBeds - k.availableBeds}/${k.totalBeds} beds`} />
        <Stat label="Revenue collected" value={inr(k.todayRevenue)} />
        <Stat label="Outstanding" value={inr(k.pendingAmount)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold mb-1">Patient volume — weekly trend</div>
          <div className="text-xs opacity-55 mb-4">Appointments per day, last 7 days</div>
          <div className="flex items-end gap-2 h-44">
            {(d.weeklyTrend || []).map((w: any) => {
              const max = Math.max(1, ...d.weeklyTrend.map((x: any) => x.appointments));
              return (
                <div key={w.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-bold">{w.appointments}</span>
                  <div className="w-full max-w-[52px] rounded-t-lg bg-gradient-to-t from-med-700 to-med-500 dark:from-sky-700 dark:to-sky-400" style={{ height: `${Math.max(6, (w.appointments / max) * 100)}%` }} />
                  <span className="text-[11px] font-semibold opacity-55">{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold">Revenue by service</div>
            <select className="input !py-0.5 !text-xs !h-7 w-24" value={revFilter} onChange={(e) => setRevFilter(e.target.value)}>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>
          <div className="text-xs opacity-55 mb-4">Billed amounts across all invoices ({revFilter.toLowerCase()})</div>
          {Object.keys(byCat).length === 0 ? <Empty title="No billing data yet" /> : (
            <div className="space-y-3">
              {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-32 truncate shrink-0">{c}</span>
                  <Meter value={v} max={revMax} />
                  <span className="text-sm font-bold w-24 text-right shrink-0">{inr(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="font-bold mb-1">Bed utilization</div>
          <div className="text-xs opacity-55 mb-4">Occupied vs total, by category</div>
          <div className="space-y-3.5">
            {Object.entries(d.bedByCategory || {}).map(([cat, v]: any) => {
              const pct = v.total ? Math.round((v.occupied / v.total) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{cat}</span><span className="opacity-60">{v.occupied}/{v.total} · {pct}%</span></div>
                  <Meter value={pct} color={pct >= 85 ? '#b4232a' : pct >= 65 ? '#d99a0b' : '#0d9488'} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="font-bold mb-1">Department load today</div>
          <div className="text-xs opacity-55 mb-4">Appointments by department · {fmtTime(new Date().toTimeString().slice(0, 5))} snapshot</div>
          {Object.keys(d.deptLoad || {}).length === 0 ? <Empty title="No department activity today" /> : (
            <div className="space-y-3">
              {Object.entries(d.deptLoad || {}).sort((a: any, b: any) => b[1] - a[1]).map(([dept, c]: any) => (
                <div key={dept} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-36 truncate shrink-0">{dept}</span>
                  <Meter value={c} max={Math.max(1, ...Object.values(d.deptLoad).map(Number))} />
                  <span className="text-sm font-bold w-6 text-right">{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="font-bold mb-1">Staff performance</div>
          <div className="text-xs opacity-55 mb-4">Consultations & procedures completed</div>
          <div className="space-y-3.5">
            {[
              { name: 'Dr. Vivek Singh', val: 42 },
              { name: 'Dr. Ramesh Kumar', val: 38 },
              { name: 'Nurse Anjali', val: 24 },
            ].map(s => (
              <div key={s.name}>
                <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{s.name}</span><span className="opacity-60">{s.val} tasks</span></div>
                <Meter value={s.val} max={50} color="#1470cc" />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="font-bold mb-1">Average Turnaround Time (TAT)</div>
          <div className="text-xs opacity-55 mb-4">Time taken from registration to discharge/completion</div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold">OPD</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-1 font-bold"><span>OPD Visit</span><span>45 mins</span></div>
                <Meter value={45} max={120} color="#0d9488" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold">IPD</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-1 font-bold"><span>IPD Admission</span><span>3.2 days</span></div>
                <Meter value={3.2} max={10} color="#b4232a" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold">LAB</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-1 font-bold"><span>Lab Reports</span><span>4.5 hours</span></div>
                <Meter value={4.5} max={24} color="#d99a0b" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
