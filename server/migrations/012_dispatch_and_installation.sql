-- Migration 012: Dispatch Logistics, Installation Execution & Digital Commissioning
-- Implements Phase 7: Material dispatch, truck/driver tracking, field installation jobs, 
-- mandatory technical checklists, geotagged evidence photos, and customer digital sign-off certificate.

-- 1. Sequences for Sequential Document Numbers
CREATE SEQUENCE IF NOT EXISTS dispatch_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS installation_job_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS commissioning_cert_number_seq START 1;

-- 2. Dispatches Table (Material Loading, Logistics & Delivery)
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) NOT NULL UNIQUE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    driver_name VARCHAR(150),
    driver_phone VARCHAR(20),
    vehicle_number VARCHAR(30),
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_target_date DATE,
    delivered_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
    delivery_notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dispatches_sales_order ON dispatches(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_warehouse ON dispatches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_created_at ON dispatches(created_at DESC);

-- 3. Dispatch Line Items (Quantities of Products Shipped)
CREATE TABLE IF NOT EXISTS dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_dispatched NUMERIC(10, 2) NOT NULL CHECK (quantity_dispatched > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_product ON dispatch_items(product_id);

-- 4. Dispatch Serials (Atomic Serial Numbers Loaded into the Vehicle)
CREATE TABLE IF NOT EXISTS dispatch_serials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    serial_number_id UUID NOT NULL REFERENCES serial_numbers(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_dispatch_serial UNIQUE(dispatch_id, serial_number_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_serials_dispatch ON dispatch_serials(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_serials_serial ON dispatch_serials(serial_number_id);

-- 5. Installation Jobs Table (Field Crew Execution & Lifecycle)
CREATE TABLE IF NOT EXISTS installation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number VARCHAR(50) NOT NULL UNIQUE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
    team_lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_completion TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN (
        'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'STRUCTURE_COMPLETE', 
        'PANELS_MOUNTED', 'WIRING_COMPLETE', 'TESTING_IN_PROGRESS', 
        'COMMISSIONED', 'BLOCKED', 'CANCELLED'
    )),
    blocked_reason TEXT,
    completion_notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_installation_jobs_order ON installation_jobs(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_installation_jobs_dispatch ON installation_jobs(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_installation_jobs_team_lead ON installation_jobs(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_installation_jobs_status ON installation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_installation_jobs_scheduled_start ON installation_jobs(scheduled_start);

-- 6. Installation Technicians Assignment
CREATE TABLE IF NOT EXISTS installation_technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_job_id UUID NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role_in_team VARCHAR(50) NOT NULL DEFAULT 'ELECTRICIAN' CHECK (role_in_team IN ('TEAM_LEAD', 'FITTER', 'ELECTRICIAN', 'HELPER')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_job_technician UNIQUE(installation_job_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_installation_techs_job ON installation_technicians(installation_job_id);
CREATE INDEX IF NOT EXISTS idx_installation_techs_user ON installation_technicians(technician_id);

-- 7. Mandatory Technical Checklist Items
CREATE TABLE IF NOT EXISTS installation_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_job_id UUID NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
    step_key VARCHAR(100) NOT NULL,
    step_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ELECTRICAL' CHECK (category IN ('STRUCTURAL', 'ELECTRICAL', 'SAFETY', 'COMMISSIONING')),
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    measured_value VARCHAR(100),
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    remarks TEXT,
    CONSTRAINT uq_job_step UNIQUE(installation_job_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_installation_checklists_job ON installation_checklists(installation_job_id);

-- 8. Geotagged Installation Photos
CREATE TABLE IF NOT EXISTS installation_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_job_id UUID NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
    photo_category VARCHAR(50) NOT NULL CHECK (photo_category IN (
        'STRUCTURE', 'PANELS_ARRAY', 'INVERTER_MOUNT', 'DCDB_ACDB', 
        'EARTHING_CHAMBER', 'LIGHTNING_ARRESTER', 'NET_METER', 'SIGN_OFF_EVIDENCE'
    )),
    file_url VARCHAR(500) NOT NULL,
    caption TEXT,
    gps_lat NUMERIC(10, 7),
    gps_lng NUMERIC(10, 7),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installation_photos_job ON installation_photos(installation_job_id);

-- 9. Digital Commissioning Sign-Offs (Customer Acceptance & Certificate)
CREATE TABLE IF NOT EXISTS installation_signoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_job_id UUID NOT NULL REFERENCES installation_jobs(id) ON DELETE CASCADE,
    certificate_number VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_signature_svg TEXT NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_rating INT CHECK (customer_rating BETWEEN 1 AND 5),
    customer_feedback TEXT,
    is_net_meter_installed BOOLEAN NOT NULL DEFAULT false,
    discom_consumer_number VARCHAR(100),
    tested_peak_power_kw NUMERIC(8, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installation_signoffs_job ON installation_signoffs(installation_job_id);

-- 10. Seed RBAC Permissions for Dispatch & Installation Execution
INSERT INTO permissions (code, module, description)
VALUES
    ('dispatches:read', 'operations', 'View material dispatches and delivery tracking'),
    ('dispatches:create', 'operations', 'Create material dispatch and allocate serial numbers'),
    ('dispatches:update', 'operations', 'Update dispatch status (in-transit, delivered)'),
    ('installations:read', 'operations', 'View installation jobs, schedules and field logs'),
    ('installations:create', 'operations', 'Schedule and assign solar installation jobs'),
    ('installations:update', 'operations', 'Update installation job progress, upload photos and checklist items'),
    ('installations:commission', 'operations', 'Complete commissioning and capture customer digital sign-off')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SUPER_ADMIN, OPERATIONS_MANAGER, FIELD_ENGINEER, TECHNICIAN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FIELD_ENGINEER', 'TECHNICIAN')
  AND p.code IN (
      'dispatches:read', 'dispatches:create', 'dispatches:update',
      'installations:read', 'installations:create', 'installations:update', 'installations:commission'
  )
ON CONFLICT DO NOTHING;
