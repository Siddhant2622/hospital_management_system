import admissions from './_handlers/admissions.js';
import appointments from './_handlers/appointments.js';
import approvals from './_handlers/approvals.js';
import audit from './_handlers/audit.js';
import beds from './_handlers/beds.js';
import dashboard from './_handlers/dashboard.js';
import departments from './_handlers/departments.js';
import documents from './_handlers/documents.js';
import doctors from './_handlers/doctors.js';
import emergency from './_handlers/emergency.js';
import insurance from './_handlers/insurance.js';
import inventory from './_handlers/inventory.js';
import inventoryCategories from './_handlers/inventory-categories.js';
import invoices from './_handlers/invoices.js';
import lab from './_handlers/lab.js';
import medicines from './_handlers/medicines.js';
import notifications from './_handlers/notifications.js';
import patients from './_handlers/patients.js';
import prescriptions from './_handlers/prescriptions.js';
import radiology from './_handlers/radiology.js';
import staff from './_handlers/staff.js';
import vitals from './_handlers/vitals.js';
import checkEmail from './_handlers/check-email.js';

const routes = {
  admissions,
  appointments,
  approvals,
  audit,
  beds,
  dashboard,
  departments,
  documents,
  doctors,
  emergency,
  insurance,
  inventory,
  'inventory-categories': inventoryCategories,
  inventory_categories: inventoryCategories,
  invoices,
  lab,
  medicines,
  notifications,
  patients,
  prescriptions,
  radiology,
  staff,
  vitals,
  'check-email': checkEmail,
  checkEmail,
};

export default async function handler(req, res) {
  // Polyfill CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Determine route name from query rewrite, matched path, or raw URL
  let route = req.query?.__route;
  if (!route && req.headers?.['x-matched-path']) {
    const m = req.headers['x-matched-path'].match(/^\/api\/([a-zA-Z0-9_-]+)/);
    if (m) route = m[1];
  }
  if (!route) {
    const raw = (req.url || '').split('?')[0];
    const m = raw.match(/^\/api\/([a-zA-Z0-9_-]+)/);
    if (m) route = m[1];
  }

  if (route) {
    route = route.replace(/^\/+|\/+$/g, '').split('/')[0].split('?')[0];
  }

  // Remove the routing parameter so child handlers have clean req.query
  if (req.query && '__route' in req.query) {
    delete req.query.__route;
  }

  const handlerFn = routes[route];
  if (!handlerFn) {
    return res.status(404).json({
      error: `API route not found: /api/${route || ''}`,
      available_routes: Object.keys(routes),
    });
  }

  return handlerFn(req, res);
}
