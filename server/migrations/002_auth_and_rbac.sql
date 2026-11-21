-- SunPower ERP: 002_auth_and_rbac.sql
-- Users, Roles, Permissions, Refresh Tokens, and Login Auditing

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_e164 VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_reset_token_hash VARCHAR(64),
    password_reset_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone_e164);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions (module:action)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module);

-- User Roles Junction
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID,
    PRIMARY KEY (user_id, role_id)
);

-- Role Permissions Junction
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Refresh Tokens (Hashed storage with family tracking for reuse detection)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);

-- Login Events (Security Auditing & Brute Force Prevention)
CREATE TABLE IF NOT EXISTS login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_email ON login_events (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON login_events (created_at DESC);

-- Seed System Roles
INSERT INTO roles (code, name, description, is_system) VALUES
    ('SUPER_ADMIN', 'Super Administrator', 'Complete system access and configuration authority', true),
    ('SALES_MANAGER', 'Sales Manager', 'Manages leads, survey approvals, and quotations', true),
    ('SALES_REP', 'Sales Representative', 'Customer acquisition, lead follow-ups, and quotation drafts', true),
    ('SURVEY_ENGINEER', 'Survey Engineer', 'Site surveys, roof measurements, and technical assessment', true),
    ('INVENTORY_MANAGER', 'Inventory Manager', 'Warehouse management, PO receipt, and serial tracking', true),
    ('TECHNICIAN', 'Installation Technician', 'Field installations, photo evidence, and checklists', true),
    ('ACCOUNTANT', 'Accountant', 'Invoicing, payment recording, and financial reconciliation', true),
    ('CUSTOMER', 'Solar Customer', 'Customer self-service portal access', true)
ON CONFLICT (code) DO NOTHING;

-- Seed Standard Granular Permissions
INSERT INTO permissions (code, module, description) VALUES
    -- Users & RBAC
    ('users:read', 'users', 'View user profiles and list users'),
    ('users:manage', 'users', 'Create, update, and deactivate users and assign roles'),
    -- CRM & Leads
    ('leads:create', 'crm', 'Create new leads'),
    ('leads:read', 'crm', 'View and search leads'),
    ('leads:update', 'crm', 'Update lead status and activities'),
    ('customers:read', 'crm', 'View customer details and directory'),
    ('customers:manage', 'crm', 'Create and edit customer records'),
    -- Surveys & Catalog
    ('surveys:create', 'surveys', 'Conduct and submit site surveys'),
    ('surveys:read', 'surveys', 'View survey details and photos'),
    ('surveys:approve', 'surveys', 'Approve or reject completed surveys'),
    ('catalog:read', 'catalog', 'View products, packages, and BOM templates'),
    ('catalog:manage', 'catalog', 'Manage catalog products and BOM templates'),
    -- Sales & Orders
    ('quotations:create', 'sales', 'Draft and edit quotations'),
    ('quotations:read', 'sales', 'View quotations and PDF proposals'),
    ('quotations:approve', 'sales', 'Approve commercial quotations'),
    ('orders:read', 'sales', 'View sales orders and project statuses'),
    ('orders:manage', 'sales', 'Confirm and manage sales orders'),
    -- Inventory & Dispatch
    ('inventory:read', 'inventory', 'View stock balances and warehouse locations'),
    ('inventory:manage', 'inventory', 'Record goods receipts, transfers, and adjustments'),
    ('serials:read', 'inventory', 'Search and view serial number history'),
    ('dispatch:manage', 'logistics', 'Prepare and scan dispatches to installation sites'),
    -- Installation & Service
    ('installations:read', 'installations', 'View scheduled installation jobs'),
    ('installations:execute', 'installations', 'Submit technician checklists and evidence'),
    ('warranties:read', 'service', 'View warranty policies and certificates'),
    ('tickets:read', 'service', 'View customer support and service tickets'),
    ('tickets:manage', 'service', 'Create, assign, and resolve service tickets'),
    -- Finance
    ('invoices:read', 'finance', 'View invoices and payment schedules'),
    ('invoices:manage', 'finance', 'Generate and send invoices'),
    ('payments:record', 'finance', 'Record and allocate customer payments'),
    ('finance:reports', 'finance', 'View financial metrics, project margins, and P&L'),
    -- WhatsApp
    ('whatsapp:read', 'whatsapp', 'View WhatsApp inbox and conversation history'),
    ('whatsapp:reply', 'whatsapp', 'Send WhatsApp replies and manage templates'),
    ('whatsapp:manage', 'whatsapp', 'Manage gateway sessions and connections')
ON CONFLICT (code) DO NOTHING;

-- Grant All Permissions to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;
