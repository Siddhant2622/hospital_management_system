-- ====================================================================
-- AbhiShree Hospital Management System (HMS) - Complete Database Setup
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/iimanfsvfyxvbyacspyc/sql/new
-- ====================================================================

-- Enable pgcrypto / uuid extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS
CREATE TABLE IF NOT EXISTS public.departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    head_doctor TEXT,
    location TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DOCTORS
CREATE TABLE IF NOT EXISTS public.doctors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    department TEXT,
    phone TEXT,
    email TEXT,
    qualification TEXT,
    experience_years INT DEFAULT 5,
    consultation_fee NUMERIC(10, 2) DEFAULT 500,
    available_days TEXT DEFAULT 'Mon - Sat',
    available_time TEXT DEFAULT '09:00 - 17:00',
    status TEXT DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PATIENTS
CREATE TABLE IF NOT EXISTS public.patients (
    id SERIAL PRIMARY KEY,
    patient_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    age INT,
    gender TEXT,
    phone TEXT,
    email TEXT,
    blood_group TEXT,
    address TEXT,
    emergency_contact TEXT,
    insurance_provider TEXT,
    insurance_policy TEXT,
    registration_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Active',
    user_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STAFF
CREATE TABLE IF NOT EXISTS public.staff (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    phone TEXT,
    email TEXT,
    shift TEXT DEFAULT 'General',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BEDS
CREATE TABLE IF NOT EXISTS public.beds (
    id SERIAL PRIMARY KEY,
    bed_number TEXT NOT NULL,
    ward TEXT NOT NULL,
    room_number TEXT,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'Available',
    patient_id INT,
    patient_name TEXT,
    admission_id INT,
    daily_rate NUMERIC(10, 2) DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ADMISSIONS
CREATE TABLE IF NOT EXISTS public.admissions (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id INT,
    doctor_name TEXT,
    department TEXT,
    ward TEXT,
    room_number TEXT,
    bed_id INT,
    bed_number TEXT,
    admission_date DATE DEFAULT CURRENT_DATE,
    discharge_date DATE,
    expected_discharge DATE,
    reason TEXT,
    status TEXT DEFAULT 'Admitted',
    condition TEXT DEFAULT 'Stable',
    admitted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id INT REFERENCES public.doctors(id) ON DELETE SET NULL,
    department TEXT,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    appointment_type TEXT DEFAULT 'New visit',
    reason TEXT,
    status TEXT DEFAULT 'Scheduled',
    token_number INT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. EMERGENCY CASES
CREATE TABLE IF NOT EXISTS public.emergency_cases (
    id SERIAL PRIMARY KEY,
    case_id TEXT UNIQUE NOT NULL,
    patient_id INT,
    patient_name TEXT NOT NULL,
    age INT,
    gender TEXT,
    triage_level TEXT DEFAULT 'Yellow',
    chief_complaint TEXT,
    attending_doctor TEXT,
    status TEXT DEFAULT 'Under Assessment',
    arrival_time TIMESTAMPTZ DEFAULT NOW(),
    bed_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id INT,
    doctor_name TEXT,
    diagnosis TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    status TEXT DEFAULT 'Pending',
    prescribed_date DATE DEFAULT CURRENT_DATE,
    dispensed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. MEDICINES
CREATE TABLE IF NOT EXISTS public.medicines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Tablet',
    batch_number TEXT,
    stock_quantity INT DEFAULT 100,
    reorder_level INT DEFAULT 20,
    unit_price NUMERIC(10, 2) DEFAULT 10.00,
    expiry_date DATE,
    manufacturer TEXT,
    status TEXT DEFAULT 'In stock',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. INVENTORY
CREATE TABLE IF NOT EXISTS public.inventory (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT,
    stock_quantity INT DEFAULT 50,
    reorder_level INT DEFAULT 10,
    unit TEXT DEFAULT 'Units',
    unit_price NUMERIC(10, 2) DEFAULT 0,
    location TEXT,
    supplier TEXT,
    expiry_date DATE,
    status TEXT DEFAULT 'In stock',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11b. INVENTORY CATEGORIES
CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. LAB TESTS
CREATE TABLE IF NOT EXISTS public.lab_tests (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    category TEXT,
    priority TEXT DEFAULT 'Routine',
    status TEXT DEFAULT 'Ordered',
    results JSONB DEFAULT '{}'::jsonb,
    report_text TEXT,
    ordered_date DATE DEFAULT CURRENT_DATE,
    completed_date DATE,
    ordered_by TEXT,
    conducted_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. RADIOLOGY
CREATE TABLE IF NOT EXISTS public.radiology (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    modality TEXT NOT NULL,
    body_part TEXT,
    priority TEXT DEFAULT 'Routine',
    status TEXT DEFAULT 'Requested',
    findings TEXT,
    impression TEXT,
    image_url TEXT,
    requested_date DATE DEFAULT CURRENT_DATE,
    reported_date DATE,
    requested_by TEXT,
    radiologist TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    total NUMERIC(10, 2) DEFAULT 0,
    paid NUMERIC(10, 2) DEFAULT 0,
    balance NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    payment_method TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    invoice_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. INSURANCE CLAIMS
CREATE TABLE IF NOT EXISTS public.insurance_claims (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    claim_amount NUMERIC(10, 2) DEFAULT 0,
    approved_amount NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'Submitted',
    filed_date DATE DEFAULT CURRENT_DATE,
    filed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. VITALS
CREATE TABLE IF NOT EXISTS public.vitals (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES public.patients(id) ON DELETE CASCADE,
    temperature TEXT,
    blood_pressure TEXT,
    heart_rate INT,
    respiratory_rate INT,
    spo2 INT,
    weight NUMERIC(5, 2),
    recorded_by TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT DEFAULT 'All',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17b. HOSPITAL DOCUMENTS
-- Stores official hospital compliance documents with expiry tracking.
-- Files are stored in Supabase Storage bucket: hospital-documents
CREATE TABLE IF NOT EXISTS public.hospital_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'Other',
    description TEXT,
    expiry_date DATE,
    uploaded_by TEXT NOT NULL,
    uploaded_by_role TEXT,
    file_name TEXT,
    file_size BIGINT,
    file_mime TEXT,
    file_path TEXT,                      -- Path inside the Supabase storage bucket
    status TEXT NOT NULL DEFAULT 'Active', -- Active | Expiring Soon | Expired
    notified_7d BOOLEAN DEFAULT FALSE,   -- True once 7-day expiry notification sent
    notified_1d BOOLEAN DEFAULT FALSE,   -- True once 1-day expiry notification sent
    notified_expired BOOLEAN DEFAULT FALSE, -- True once expiry-day notification sent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT,
    result TEXT DEFAULT 'Success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. APPROVALS
CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    requested_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    reason TEXT,
    reference_id TEXT,
    amount DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    staff_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    punch_in TIMESTAMPTZ,
    punch_out TIMESTAMPTZ,
    department VARCHAR(100),
    shift VARCHAR(50),
    late_status BOOLEAN DEFAULT FALSE,
    early_exit BOOLEAN DEFAULT FALSE,
    working_hours DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. STAFF PROFILES
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    shift VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ENABLE ROW LEVEL SECURITY & OPEN POLICIES FOR ALL TABLES
-- ====================================================================
DO $$
DECLARE
    tbl text;
    tbls text[] := ARRAY[
        'departments', 'doctors', 'patients', 'staff', 'beds', 'admissions',
        'appointments', 'emergency_cases', 'prescriptions', 'medicines',
        'inventory', 'inventory_categories', 'lab_tests', 'radiology', 'invoices', 'insurance_claims',
        'vitals', 'notifications', 'audit_logs', 'approvals', 'attendance', 'staff_profiles', 'hospital_documents'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access to all users" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Allow full access to all users" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- ====================================================================
-- SEED INITIAL STARTER DATA
-- ====================================================================

-- Initial Departments
INSERT INTO public.departments (name, head_doctor, location, phone, status)
VALUES
    ('General Medicine', 'Dr. Vikram Sethi', 'Block C, Ground Floor', '+91 98765 00004', 'Available'),
    ('Cardiology', 'Dr. Meera Nair', 'Block A, 2nd Floor', '+91 98765 00001', 'Available'),
    ('Orthopedics', 'Dr. Rajesh Patel', 'Block B, 1st Floor', '+91 98765 00002', 'Available'),
    ('Neurology', 'Dr. Ananya Sen', 'Block A, 3rd Floor', '+91 98765 00003', 'Available'),
    ('Pediatrics', 'Dr. Priya Sharma', 'Block B, 2nd Floor', '+91 98765 00005', 'Available'),
    ('Gynecology & Obstetrics', 'Dr. Sunita Rao', 'Block B, 3rd Floor', '+91 98765 00006', 'Available'),
    ('Surgery / General Surgery', 'Dr. Alok Verma', 'OT Complex, 2nd Floor', '+91 98765 00007', 'Available'),
    ('Dermatology', 'Dr. Ritu Kapoor', 'Block C, 1st Floor', '+91 98765 00008', 'Available'),
    ('ENT', 'Dr. Manish Gupta', 'Block A, 1st Floor', '+91 98765 00009', 'Available'),
    ('Ophthalmology', 'Dr. Sneha Joshi', 'Block A, Ground Floor', '+91 98765 00010', 'Available'),
    ('Psychiatry', 'Dr. Arvind Saxena', 'Block D, 2nd Floor', '+91 98765 00011', 'Available'),
    ('Urology', 'Dr. Sanjay Mishra', 'Block B, 4th Floor', '+91 98765 00012', 'Available'),
    ('Nephrology', 'Dr. Deepa Kulkarni', 'Dialysis Unit, Block B', '+91 98765 00013', 'Available'),
    ('Gastroenterology', 'Dr. Amit Bansal', 'Block C, 2nd Floor', '+91 98765 00014', 'Available'),
    ('Pulmonology', 'Dr. Vivek Deshmukh', 'Block A, 4th Floor', '+91 98765 00015', 'Available'),
    ('Endocrinology', 'Dr. Pooja Bhatia', 'Block C, 3rd Floor', '+91 98765 00016', 'Available'),
    ('Oncology', 'Dr. Harish Chandra', 'Daycare Chemotherapy, Block D', '+91 98765 00017', 'Available'),
    ('Radiology', 'Dr. Rohan Mathur', 'Diagnostic Wing, Ground Floor', '+91 98765 00018', 'Available'),
    ('Pathology', 'Dr. Neelam Pandey', 'Central Lab, 1st Floor', '+91 98765 00019', 'Available'),
    ('Anesthesiology', 'Dr. Sandeep Tiwary', 'OT Complex, 2nd Floor', '+91 98765 00020', 'Available'),
    ('Critical Care / ICU', 'Dr. Meenakshi Sundaram', 'ICU Block, 2nd Floor', '+91 98765 00021', 'Available'),
    ('Physiotherapy & Rehabilitation', 'Dr. Tarun Nambiar', 'Rehab Wing, Ground Floor', '+91 98765 00022', 'Available'),
    ('Dental / Dentistry', 'Dr. Radhika Sen', 'Dental OPD, Block A', '+91 98765 00023', 'Available'),
    ('Nutrition & Dietetics', 'Dt. Shalini Mehta', 'Dietetics Unit, Block C', '+91 98765 00024', 'Available'),
    ('Emergency', 'Dr. Vikram Sethi', 'Emergency Wing, Ground Floor', '+91 98765 00025', 'Available')
ON CONFLICT (name) DO NOTHING;

-- Initial Doctors
INSERT INTO public.doctors (id, name, specialty, department, phone, email, qualification, consultation_fee, status)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 'Dr. Meera Nair', 'Cardiology', 'Cardiology', '+91 98765 11001', 'doctor@abhishree.hospital', 'MD, DM (Cardiology)', 800, 'Available'),
    (2, 'Dr. Rajesh Patel', 'Orthopedics', 'Orthopedics', '+91 98765 11002', 'rajesh.patel@abhishree.hospital', 'MS (Ortho)', 700, 'Available'),
    (3, 'Dr. Ananya Sen', 'Neurology', 'Neurology', '+91 98765 11003', 'ananya.sen@abhishree.hospital', 'DM (Neurology)', 900, 'Available')
ON CONFLICT (id) DO NOTHING;

-- Initial Patients
INSERT INTO public.patients (id, patient_id, name, age, gender, phone, email, blood_group, address, status)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 'P-1001', 'Rahul Sharma', 45, 'Male', '+91 98765 22001', 'rahul.sharma@example.com', 'B+', '42 Civil Lines, Bhopal', 'Active'),
    (2, 'P-1002', 'Sunita Devi', 38, 'Female', '+91 98765 22002', 'sunita.devi@example.com', 'O+', '15 M.G. Road, Indore', 'Active'),
    (3, 'P-1003', 'Vikram Malhotra', 52, 'Male', '+91 98765 22003', 'patient@abhishree.hospital', 'A+', '88 Arera Colony, Bhopal', 'Active')
ON CONFLICT (id) DO NOTHING;

-- Initial Beds
INSERT INTO public.beds (bed_number, ward, room_number, category, status, daily_rate)
VALUES
    ('B-101', 'General Ward', 'GW-1', 'General', 'Available', 800),
    ('B-102', 'General Ward', 'GW-1', 'General', 'Available', 800),
    ('B-103', 'General Ward', 'GW-1', 'General', 'Available', 800),
    ('ICU-01', 'Intensive Care Unit', 'ICU-A', 'ICU', 'Available', 3500),
    ('ICU-02', 'Intensive Care Unit', 'ICU-A', 'ICU', 'Available', 3500),
    ('PVT-201', 'Private Ward', 'P-201', 'Private', 'Available', 2000),
    ('PVT-202', 'Private Ward', 'P-202', 'Private', 'Available', 2000)
ON CONFLICT DO NOTHING;

-- Initial Staff
INSERT INTO public.staff (name, role, department, phone, email, shift, status)
VALUES
    ('Aarav Sharma', 'Admin', 'Administration', '+91 98765 33001', 'admin@abhishree.hospital', 'General', 'Active'),
    ('Sister Lakshmi Rao', 'Nurse', 'ICU', '+91 98765 33002', 'nurse@abhishree.hospital', 'Morning', 'Active'),
    ('Rohan Verma', 'Receptionist', 'Front Desk', '+91 98765 33003', 'reception@abhishree.hospital', 'Morning', 'Active'),
    ('Kavya Iyer', 'Pharmacist', 'Pharmacy', '+91 98765 33004', 'pharmacy@abhishree.hospital', 'General', 'Active'),
    ('Arjun Patel', 'Lab Technician', 'Pathology', '+91 98765 33005', 'lab@abhishree.hospital', 'Morning', 'Active'),
    ('Neha Gupta', 'Accountant', 'Finance', '+91 98765 33006', 'accounts@abhishree.hospital', 'General', 'Active')
ON CONFLICT DO NOTHING;

-- Initial Medicines
INSERT INTO public.medicines (name, category, batch_number, stock_quantity, reorder_level, unit_price, expiry_date, manufacturer, status)
VALUES
    ('Paracetamol 650mg', 'Tablet', 'PCM-2026-01', 500, 50, 2.50, '2028-06-30', 'Cipla', 'In stock'),
    ('Amoxicillin 500mg', 'Capsule', 'AMX-2026-03', 250, 40, 8.00, '2027-12-31', 'Sun Pharma', 'In stock'),
    ('Pantoprazole 40mg', 'Tablet', 'PAN-2026-02', 300, 30, 6.50, '2028-02-28', 'Alkem', 'In stock'),
    ('Ceftriaxone 1g Inj', 'Injection', 'CEF-2026-09', 80, 20, 85.00, '2027-08-31', 'Dr. Reddy', 'In stock'),
    ('Salbutamol Inhaler', 'Inhaler', 'SAL-2026-04', 45, 15, 140.00, '2028-01-31', 'Cipla', 'In stock')
ON CONFLICT DO NOTHING;

-- Initial Inventory Categories
INSERT INTO public.inventory_categories (name, description)
VALUES
    ('Medicines', 'Pharmaceutical drugs, tablets, syrups, antibiotics and formulations'),
    ('Surgical', 'Surgical instruments, sutures, scalpels, and operation theatre supplies'),
    ('Consumables', 'Cotton, gauze, syringes, bandages, disposable medical supplies'),
    ('Equipment', 'Biomedical devices, monitors, infusion pumps, diagnostic machines'),
    ('General', 'Hospital-wide general utilities and housekeeping provisions'),
    ('Laboratory / Lab Supplies', 'Diagnostic reagents, test tubes, specimen containers, slides'),
    ('PPE & Safety', 'Gloves, masks, gowns, face shields'),
    ('Disinfectants & Cleaning', 'Hospital disinfectants, hand sanitizers, sterilization solutions'),
    ('IV Fluids & Infusion', 'Saline, dextrose, ringer lactate, IV sets, cannulas'),
    ('Implants & Prosthetics', 'Orthopedic implants, stents, pacemakers'),
    ('Medical Gases', 'Oxygen cylinders, nitrous oxide, manifolds'),
    ('Blood Bank / Blood Products', 'Blood bags, plasma, testing kits'),
    ('Dental Supplies', 'Dental instruments, filling materials, tips'),
    ('Radiology / Imaging Supplies', 'X-ray/CT/MRI related consumables'),
    ('Office / Administrative Supplies', 'Stationery, registers, printer cartridges')
ON CONFLICT (name) DO NOTHING;

-- Reset sequences so autoincrement starts after seed IDs
SELECT setval('public.patients_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.patients));
SELECT setval('public.doctors_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.doctors));
