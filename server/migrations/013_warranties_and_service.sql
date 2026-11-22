-- Migration 013: Warranties, Service Tickets, AMC & Equipment RMA Swaps
-- Implements Phase 8: Automated warranty registration on commissioning, manufacturer policy snapshots,
-- customer service ticketing lifecycle, technician field diagnostics, and serialized RMA swaps.

-- 1. Sequences for Sequential Document Numbers
CREATE SEQUENCE IF NOT EXISTS warranty_cert_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS service_ticket_number_seq START 1;

-- 2. Product Warranty Policies (Manufacturer Master Policies)
CREATE TABLE IF NOT EXISTS product_warranty_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code VARCHAR(50) NOT NULL UNIQUE,
    policy_name VARCHAR(150) NOT NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    warranty_type VARCHAR(50) NOT NULL CHECK (warranty_type IN ('PERFORMANCE', 'REPLACEMENT', 'WORKMANSHIP', 'COMPREHENSIVE')),
    duration_months INT NOT NULL CHECK (duration_months > 0),
    terms_and_conditions TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_policies_category ON product_warranty_policies(category_id);
CREATE INDEX IF NOT EXISTS idx_warranty_policies_code ON product_warranty_policies(policy_code);

-- 3. Warranties Table (Registered Certificates with Frozen Policy Snapshots)
CREATE TABLE IF NOT EXISTS warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warranty_certificate_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    installation_job_id UUID REFERENCES installation_jobs(id) ON DELETE SET NULL,
    serial_number_id UUID REFERENCES serial_numbers(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    policy_snapshot JSONB NOT NULL,
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID')),
    qr_code_hash VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranties_customer ON warranties(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranties_order ON warranties(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_warranties_serial ON warranties(serial_number_id);
CREATE INDEX IF NOT EXISTS idx_warranties_status ON warranties(status);
CREATE INDEX IF NOT EXISTS idx_warranties_cert_num ON warranties(warranty_certificate_number);

-- 4. Service Tickets Table (Customer Support, Maintenance & AMC)
CREATE TABLE IF NOT EXISTS service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    installation_job_id UUID REFERENCES installation_jobs(id) ON DELETE SET NULL,
    serial_number_id UUID REFERENCES serial_numbers(id) ON DELETE SET NULL,
    warranty_id UUID REFERENCES warranties(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'INVERTER_FAULT' CHECK (category IN (
        'INVERTER_FAULT', 'LOW_GENERATION', 'PHYSICAL_DAMAGE', 
        'GRID_TRIP', 'ROUTINE_AMC', 'WIRING_ISSUE', 'OTHER'
    )),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED', 'CANCELLED'
    )),
    source VARCHAR(30) NOT NULL DEFAULT 'WEB' CHECK (source IN ('WEB', 'WHATSAPP', 'PHONE', 'FIELD_INSPECTION')),
    reported_issue TEXT NOT NULL,
    diagnostic_notes TEXT,
    resolution_notes TEXT,
    assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sla_due_date TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    reopened_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_customer ON service_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_serial ON service_tickets(serial_number_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON service_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON service_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_technician ON service_tickets(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON service_tickets(created_at DESC);

-- 5. Ticket Activities Table (Audit History, Notes & Status Progression)
CREATE TABLE IF NOT EXISTS ticket_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('STATUS_CHANGE', 'ASSIGNMENT', 'NOTE', 'RMA_REPLACEMENT', 'DIAGNOSTIC')),
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);

-- 6. Warranty Replacements Table (RMA Equipment Swap Ledger)
CREATE TABLE IF NOT EXISTS warranty_replacements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    defective_serial_id UUID NOT NULL REFERENCES serial_numbers(id) ON DELETE RESTRICT,
    replacement_serial_id UUID NOT NULL REFERENCES serial_numbers(id) ON DELETE RESTRICT,
    replaced_by UUID REFERENCES users(id) ON DELETE SET NULL,
    replaced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transfer_warranty BOOLEAN NOT NULL DEFAULT true,
    reason TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_replacements_ticket ON warranty_replacements(ticket_id);
CREATE INDEX IF NOT EXISTS idx_warranty_replacements_defective ON warranty_replacements(defective_serial_id);
CREATE INDEX IF NOT EXISTS idx_warranty_replacements_replacement ON warranty_replacements(replacement_serial_id);

-- 7. Seed RBAC Permissions
INSERT INTO permissions (code, module, description)
VALUES
    ('warranties:read', 'service', 'View warranty certificates, policy terms and claims'),
    ('warranties:create', 'service', 'Issue and register equipment warranty certificates'),
    ('warranties:manage', 'service', 'Manage warranty policies, extend or void warranties'),
    ('tickets:read', 'service', 'View service and support tickets'),
    ('tickets:create', 'service', 'Log service tickets via web portal or API'),
    ('tickets:update', 'service', 'Update ticket notes, diagnostics and status progress'),
    ('tickets:assign', 'service', 'Assign field technicians to service tickets'),
    ('tickets:close', 'service', 'Resolve and close service tickets'),
    ('rma:execute', 'service', 'Execute serialized RMA hardware replacements')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SUPER_ADMIN, OPERATIONS_MANAGER, FIELD_ENGINEER, TECHNICIAN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FIELD_ENGINEER', 'TECHNICIAN')
  AND p.code IN (
      'warranties:read', 'warranties:create', 'warranties:manage',
      'tickets:read', 'tickets:create', 'tickets:update', 'tickets:assign', 'tickets:close',
      'rma:execute'
  )
ON CONFLICT DO NOTHING;

-- Grant customer role tickets:create, tickets:read, warranties:read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CUSTOMER'
  AND p.code IN ('warranties:read', 'tickets:read', 'tickets:create')
ON CONFLICT DO NOTHING;

-- 8. Seed Standard Manufacturer Warranty Policies
INSERT INTO product_warranty_policies (policy_code, policy_name, warranty_type, duration_months, terms_and_conditions)
VALUES
    (
        'POL-PANEL-PERF-25Y',
        '25-Year Linear PV Module Performance Warranty',
        'PERFORMANCE',
        300,
        'Guarantees minimum 97.5% peak power output in year 1, with linear degradation not exceeding 0.55% per year, ensuring at least 84.8% peak power output at year 25 under Standard Test Conditions (STC).'
    ),
    (
        'POL-PANEL-PROD-10Y',
        '10-Year PV Module Workmanship & Product Warranty',
        'REPLACEMENT',
        120,
        'Covers manufacturing defects in materials and workmanship, including frame delamination, EVA browning, backsheet cracking, and junction box terminal failure.'
    ),
    (
        'POL-INVERTER-5Y',
        '5-Year Solar On-Grid/Hybrid Inverter Comprehensive Warranty',
        'REPLACEMENT',
        60,
        'Covers hardware component failure, IGBT bridge breakdown, MPPT controller malfunction, and display/telemetry card failure. Free bench repair or direct serial replacement.'
    ),
    (
        'POL-STRUCTURE-10Y',
        '10-Year Module Mounting Structure & HDGI Warranty',
        'WORKMANSHIP',
        120,
        'Covers structural integrity of Hot Dip Galvanized Iron (HDGI) / Aluminum mounting structures against corrosion, weld fractures, and wind gust damage up to 150 km/h.'
    ),
    (
        'POL-BOS-2Y',
        '2-Year Balance of System (BOS) Electrical Warranty',
        'REPLACEMENT',
        24,
        'Covers DCDB, ACDB, surge protection devices (SPDs), DC disconnect switches, and MCB trip mechanisms against premature electrical breakdown.'
    )
ON CONFLICT (policy_code) DO NOTHING;
