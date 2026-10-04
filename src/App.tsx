import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { handleGoogleRedirect } from './lib/googleAuth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import OPD from './pages/OPD';
import Admissions from './pages/Admissions';
import Beds from './pages/Beds';
import Emergency from './pages/Emergency';
import Doctors from './pages/Doctors';
import Staff from './pages/Staff';
import Approvals from './pages/Approvals';
import Consult from './pages/Consult';
import Lab from './pages/Lab';
import Radiology from './pages/Radiology';
import Pharmacy from './pages/Pharmacy';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Insurance from './pages/Insurance';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import { PrescriptionDoc, InvoiceDoc, LabReportDoc } from './pages/Documents';
import { MyAppointments, MyRecords, MyPrescriptions, MyLab, MyBills } from './pages/PatientPortal';
import ReceptionDocuments from './pages/ReceptionDocuments';
import type { JSX } from 'react';

function handleRecoveryRedirect() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (hash.includes('type=recovery') || search.includes('type=recovery')) {
    window.location.replace('/login');
  }
}

handleGoogleRedirect();
handleRecoveryRedirect();

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f4f6f9] dark:bg-[#081322]">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0e5aa7,#0d9488)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" fill="#fff" /></svg>
        </div>
        <div className="text-sm font-semibold opacity-60">Opening AbhiShree Hospital…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGuard({ allow, children }: { allow: string[]; children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

const STAFF = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Accountant'];

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<Navigate to="/login" replace />} />
              <Route path="/app" element={<Protected><AppShell /></Protected>}>
                <Route index element={<Dashboard />} />
                <Route path="patients" element={<RoleGuard allow={STAFF}><Patients /></RoleGuard>} />
                <Route path="patients/:id" element={<RoleGuard allow={STAFF}><PatientDetail /></RoleGuard>} />
                <Route path="appointments" element={<RoleGuard allow={['Admin', 'Doctor', 'Nurse', 'Receptionist']}><Appointments /></RoleGuard>} />
                <Route path="opd" element={<RoleGuard allow={['Admin', 'Doctor', 'Nurse', 'Receptionist']}><OPD /></RoleGuard>} />
                <Route path="consult" element={<RoleGuard allow={['Admin', 'Doctor']}><Consult /></RoleGuard>} />
                <Route path="admissions" element={<RoleGuard allow={['Admin', 'Doctor', 'Nurse', 'Receptionist']}><Admissions /></RoleGuard>} />
                <Route path="beds" element={<RoleGuard allow={['Admin', 'Doctor', 'Nurse', 'Receptionist']}><Beds /></RoleGuard>} />
                <Route path="emergency" element={<RoleGuard allow={['Admin', 'Doctor', 'Nurse', 'Receptionist']}><Emergency /></RoleGuard>} />
                <Route path="doctors" element={<RoleGuard allow={STAFF}><Doctors /></RoleGuard>} />
                <Route path="staff" element={<RoleGuard allow={['Admin']}><Staff /></RoleGuard>} />
                <Route path="approvals" element={<RoleGuard allow={['Admin']}><Approvals /></RoleGuard>} />
                <Route path="lab" element={<RoleGuard allow={['Admin', 'Doctor', 'Lab Technician']}><Lab /></RoleGuard>} />
                <Route path="radiology" element={<RoleGuard allow={['Admin', 'Doctor', 'Lab Technician']}><Radiology /></RoleGuard>} />
                <Route path="pharmacy" element={<RoleGuard allow={['Admin', 'Doctor', 'Pharmacist']}><Pharmacy /></RoleGuard>} />
                <Route path="inventory" element={<RoleGuard allow={['Admin', 'Pharmacist']}><Inventory /></RoleGuard>} />
                <Route path="billing" element={<RoleGuard allow={['Admin', 'Receptionist', 'Accountant']}><Billing /></RoleGuard>} />
                <Route path="insurance" element={<RoleGuard allow={['Admin', 'Accountant', 'Receptionist']}><Insurance /></RoleGuard>} />
                <Route path="reports" element={<RoleGuard allow={['Admin', 'Accountant']}><Reports /></RoleGuard>} />
                <Route path="audit" element={<RoleGuard allow={['Admin']}><Audit /></RoleGuard>} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
                <Route path="reception-documents" element={<RoleGuard allow={['Admin', 'Receptionist']}><ReceptionDocuments /></RoleGuard>} />
                <Route path="prescription/:id" element={<PrescriptionDoc />} />
                <Route path="invoice/:id" element={<InvoiceDoc />} />
                <Route path="lab-report/:id" element={<LabReportDoc />} />
                <Route path="my/appointments" element={<RoleGuard allow={['Patient']}><MyAppointments /></RoleGuard>} />
                <Route path="my/records" element={<RoleGuard allow={['Patient']}><MyRecords /></RoleGuard>} />
                <Route path="my/prescriptions" element={<RoleGuard allow={['Patient']}><MyPrescriptions /></RoleGuard>} />
                <Route path="my/lab" element={<RoleGuard allow={['Patient']}><MyLab /></RoleGuard>} />
                <Route path="my/bills" element={<RoleGuard allow={['Patient']}><MyBills /></RoleGuard>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
