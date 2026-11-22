-- Migration 014: Finance, Milestone Invoicing, Payments, Allocations & Project Profitability
-- Implements Phase 10: GST-compliant milestone invoices, payment verification with idempotency,
-- multi-invoice payment allocation, project direct expenses, and real gross margin P&L.

-- 1. Sequences for Sequential Document Numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS expense_number_seq START 1;

-- 2. Invoices Table (Milestone & Final Commercial Tax Invoices)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    milestone_type VARCHAR(50) NOT NULL DEFAULT 'ADVANCE' CHECK (milestone_type IN ('ADVANCE', 'DELIVERY', 'INSTALLATION_COMPLETE', 'NET_METERING', 'FINAL_SETTLEMENT', 'AD_HOC')),
    milestone_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    tax_goods_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    tax_services_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    amount_due NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID')),
    hsn_sac_code VARCHAR(20) DEFAULT '995465',
    snapshot_data JSONB NOT NULL DEFAULT '{}',
    pdf_path VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- 3. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'HARDWARE' CHECK (item_type IN ('HARDWARE', 'SERVICE', 'TRANSPORT', 'CIVIL_WORKS', 'MISCELLANEOUS')),
    description VARCHAR(255) NOT NULL,
    hsn_sac_code VARCHAR(20) DEFAULT '995465',
    quantity NUMERIC(10,3) NOT NULL DEFAULT 1.000,
    unit_code VARCHAR(20) NOT NULL DEFAULT 'NOS',
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    tax_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 4. Payments Table (Incoming Cash, Bank Transfer, UPI, Cheques)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    unallocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH', 'BANK_TRANSFER', 'DEMAND_DRAFT')),
    transaction_reference VARCHAR(100) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('RECORDED', 'VERIFIED', 'REJECTED', 'BOUNCED')),
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    idempotency_key VARCHAR(100) UNIQUE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payments_idem ON payments(idempotency_key);

-- 5. Payment Allocations Table (Applies payment amounts to invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON payment_allocations(invoice_id);

-- 6. Direct Project Expenses Table (P&L Cost Ledger)
CREATE TABLE IF NOT EXISTS project_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number VARCHAR(50) NOT NULL UNIQUE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('LABOR', 'TRANSPORT', 'CRANE_RENTAL', 'LIASONING', 'ELECTRICAL_CONSUMABLES', 'CIVIL_MATERIALS', 'MISCELLANEOUS')),
    vendor_name VARCHAR(255) NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REJECTED')),
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_order ON project_expenses(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON project_expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON project_expenses(status);

-- 7. Permissions Seed & Role Assignment
INSERT INTO permissions (code, module, description) VALUES
    ('invoices:read', 'finance', 'View customer tax invoices and billing ledger'),
    ('invoices:create', 'finance', 'Generate milestone tax invoices for sales orders'),
    ('invoices:issue', 'finance', 'Issue and approve official GST invoices'),
    ('payments:read', 'finance', 'View received payments and bank reconciliations'),
    ('payments:create', 'finance', 'Record customer payments and UTR transactions'),
    ('payments:verify', 'finance', 'Audit and verify customer payments and allocations'),
    ('expenses:read', 'finance', 'View project direct expenses and cost ledgers'),
    ('expenses:create', 'finance', 'Log direct project subcontractor/transport costs'),
    ('expenses:approve', 'finance', 'Approve project cost disbursements'),
    ('finance:report', 'finance', 'View real project profitability, gross margin P&L, and AR aging')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SUPER_ADMIN, ACCOUNTANT, OPERATIONS_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ACCOUNTANT', 'OPERATIONS_MANAGER')
  AND p.module = 'finance'
ON CONFLICT DO NOTHING;

-- Grant limited finance read and expense creation to PROJECT_MANAGER / FIELD_ENGINEER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('PROJECT_MANAGER', 'FIELD_ENGINEER')
  AND p.code IN ('invoices:read', 'payments:read', 'expenses:read', 'expenses:create', 'finance:report')
ON CONFLICT DO NOTHING;

-- Grant customer role invoice and payment read permissions for Customer Portal
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CUSTOMER'
  AND p.code IN ('invoices:read', 'payments:read')
ON CONFLICT DO NOTHING;
