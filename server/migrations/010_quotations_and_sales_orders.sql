-- SunPower ERP: 010_quotations_and_sales_orders.sql
-- Quotation Engine, Commercial Snapshots, Sales Orders & Role Permissions

-- 1. Sequences for Human-Readable Identifiers
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq START 1;

-- 2. Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(50) NOT NULL UNIQUE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    bom_id UUID REFERENCES project_boms(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    system_capacity_kw NUMERIC(10, 2) NOT NULL CHECK (system_capacity_kw > 0),
    hardware_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (hardware_subtotal >= 0),
    installation_charges NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (installation_charges >= 0),
    transport_charges NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (transport_charges >= 0),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    taxable_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (taxable_amount >= 0),
    tax_goods_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_goods_amount >= 0),
    tax_services_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_services_amount >= 0),
    tax_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    grand_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    subsidy_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subsidy_amount >= 0),
    net_payable NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (net_payable >= 0),
    payment_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
    commercial_terms TEXT,
    valid_until DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED')),
    rejection_reason TEXT,
    snapshot_data JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations (quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations (lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_survey ON quotations (survey_id);
CREATE INDEX IF NOT EXISTS idx_quotations_bom ON quotations (bom_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations (status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations (created_at DESC);

-- 3. Quotation Items Table
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'HARDWARE' CHECK (item_type IN ('HARDWARE', 'INSTALLATION', 'ELECTRICAL', 'TRANSPORT', 'CUSTOM')),
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit_code VARCHAR(20) NOT NULL DEFAULT 'NOS',
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 12.00 CHECK (tax_rate_pct >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
    is_optional BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items (quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_product ON quotation_items (product_id);

-- 4. Sales Orders Table
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    bom_id UUID REFERENCES project_boms(id) ON DELETE RESTRICT,
    system_capacity_kw NUMERIC(10, 2) NOT NULL CHECK (system_capacity_kw > 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    subsidy_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subsidy_amount >= 0),
    net_customer_payable NUMERIC(14, 2) NOT NULL CHECK (net_customer_payable >= 0),
    advance_payment_received NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (advance_payment_received >= 0),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIALLY_PAID', 'FULLY_PAID')),
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'IN_ENGINEERING', 'MATERIAL_RESERVED', 'DISPATCHED', 'INSTALLATION_IN_PROGRESS', 'COMMISSIONED', 'CANCELLED', 'CLOSED')),
    snapshot_data JSONB NOT NULL,
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    installation_target_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_number ON sales_orders (order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation ON sales_orders (quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_lead ON sales_orders (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders (status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders (created_at DESC);

-- 5. Role Permissions Mapping
-- Sales Manager: Full quotations and orders oversight
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALES_MANAGER'
  AND p.code IN (
      'quotations:create', 'quotations:read', 'quotations:approve', 'quotations:update',
      'orders:read', 'orders:manage'
  )
ON CONFLICT DO NOTHING;

-- Sales Rep: Draft, view, and update own quotations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALES_REP'
  AND p.code IN (
      'quotations:create', 'quotations:read', 'quotations:update',
      'orders:read'
  )
ON CONFLICT DO NOTHING;

-- Accountant: Invoices, payment recording, read quotations & orders
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ACCOUNTANT'
  AND p.code IN (
      'quotations:read', 'orders:read'
  )
ON CONFLICT DO NOTHING;
