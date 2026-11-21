-- SunPower ERP: 003_crm_and_leads.sql
-- CRM, Lead Management, Customer Lifecycle, Customer Addresses, Activities & Follow-ups

-- Sequences for Human-Readable Identifiers
CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;

-- 1. Customers Table (Unified Customer Record)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(32) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    customer_type VARCHAR(20) NOT NULL DEFAULT 'RESIDENTIAL' CHECK (customer_type IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL')),
    gstin VARCHAR(15),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone_e164);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers (customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers (created_at DESC);

-- 2. Customer Addresses Table (Supports Multiple Sites/Billing Addresses)
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL DEFAULT 'SITE' CHECK (address_type IN ('SITE', 'BILLING', 'RESIDENTIAL', 'OTHER')),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Gujarat',
    pincode VARCHAR(10) NOT NULL,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_cust ON customer_addresses (customer_id);

-- 3. Leads Table (Lead Acquisition & Pipeline)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_number VARCHAR(32) NOT NULL UNIQUE,
    source VARCHAR(32) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('WEBSITE', 'WHATSAPP', 'PHONE', 'WALK_IN', 'REFERRAL', 'MANUAL')),
    stage VARCHAR(32) NOT NULL DEFAULT 'NEW' CHECK (stage IN ('NEW', 'CONTACTED', 'QUALIFIED', 'SURVEY_SCHEDULED', 'SURVEY_APPROVED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    site_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Gujarat',
    pincode VARCHAR(10),
    monthly_electricity_bill NUMERIC(12, 2) CHECK (monthly_electricity_bill IS NULL OR monthly_electricity_bill >= 0),
    requested_capacity_kw NUMERIC(6, 2) CHECK (requested_capacity_kw IS NULL OR requested_capacity_kw > 0),
    system_type VARCHAR(20) DEFAULT 'ON_GRID' CHECK (system_type IN ('ON_GRID', 'OFF_GRID', 'HYBRID')),
    lost_reason TEXT,
    notes TEXT,
    converted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone_e164);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads (customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);

-- 4. Lead Activities Table (Audit History of Every Interaction & Stage Transition)
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id),
    activity_type VARCHAR(32) NOT NULL CHECK (activity_type IN ('CALL', 'WHATSAPP', 'MEETING', 'NOTE', 'STAGE_CHANGE', 'ASSIGNMENT', 'CONVERSION')),
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities (lead_id, created_at DESC);

-- 5. Follow-ups Table (Sales Staff Action Reminders)
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'MISSED', 'CANCELLED')),
    reminder_sent BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups (lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups (scheduled_at) WHERE status = 'PENDING';

-- 6. Customer Documents Table (Electricity bills, ID proofs, roof NOCs, etc.)
CREATE TABLE IF NOT EXISTS customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('ELECTRICITY_BILL', 'ID_PROOF', 'ROOFTOP_NOC', 'TAX_INVOICE', 'SUBSIDY_APPLICATION', 'OTHER')),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_docs_cust ON customer_documents (customer_id);

-- Additional Permissions for CRM
INSERT INTO permissions (code, module, description) VALUES
    ('leads:assign', 'crm', 'Assign leads to sales representatives'),
    ('leads:convert', 'crm', 'Convert qualified leads into customers'),
    ('leads:delete', 'crm', 'Soft delete or archive leads')
ON CONFLICT (code) DO NOTHING;

-- Grant All CRM Permissions to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN' AND p.module = 'crm'
ON CONFLICT DO NOTHING;

-- Grant CRM Permissions to SALES_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALES_MANAGER'
  AND p.code IN (
    'leads:create', 'leads:read', 'leads:update', 'leads:assign', 'leads:convert', 'leads:delete',
    'customers:read', 'customers:manage'
  )
ON CONFLICT DO NOTHING;

-- Grant CRM Permissions to SALES_REP
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALES_REP'
  AND p.code IN (
    'leads:create', 'leads:read', 'leads:update', 'leads:convert',
    'customers:read', 'customers:manage'
  )
ON CONFLICT DO NOTHING;
