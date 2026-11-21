-- SunPower ERP: 011_procurement_and_inventory.sql
-- Phase 6: Procurement, Multi-Warehouse Inventory Ledger, Atomic Stock Reservations & Serial Tracking

-- 1. Sequences for Human-Readable Identifiers
CREATE SEQUENCE IF NOT EXISTS supplier_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS goods_receipt_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS stock_movement_number_seq START 1;

-- 2. Warehouses Table
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Gujarat',
    pincode VARCHAR(10) NOT NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses (code);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses (is_active);

-- 3. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone_e164 VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    gstin VARCHAR(15),
    payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Gujarat',
    pincode VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers (supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers (phone_e164);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers (is_active);

-- 4. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    expected_delivery_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders (po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_warehouse ON purchase_orders (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders (created_at DESC);

-- 5. Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(14, 3) NOT NULL CHECK (quantity_ordered > 0),
    quantity_received NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 12.00 CHECK (tax_rate_pct >= 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items (po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items (product_id);

-- 6. Goods Receipts (GRN) Table
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(50) NOT NULL UNIQUE,
    po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    invoice_challan_number VARCHAR(100),
    invoice_challan_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'VERIFIED', 'REJECTED')),
    notes TEXT,
    received_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_number ON goods_receipts (grn_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts (po_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier ON goods_receipts (supplier_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse ON goods_receipts (warehouse_id);

-- 7. Goods Receipt Items Table
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_received NUMERIC(14, 3) NOT NULL CHECK (quantity_received > 0),
    quantity_accepted NUMERIC(14, 3) NOT NULL CHECK (quantity_accepted >= 0),
    quantity_rejected NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
    rejection_reason TEXT,
    unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON goods_receipt_items (grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_product ON goods_receipt_items (product_id);

-- 8. Stock Balances Table (Transactional projection for high-speed reads)
CREATE TABLE IF NOT EXISTS stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity_on_hand NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    quantity_available NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    reorder_level NUMERIC(14, 3) NOT NULL DEFAULT 10.000 CHECK (reorder_level >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stock_balances_product_wh UNIQUE (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON stock_balances (warehouse_id);

-- 9. Stock Movements Table (Append-only physical ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_number VARCHAR(50) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('PURCHASE_RECEIPT', 'ORDER_RESERVATION', 'RESERVATION_RELEASE', 'DISPATCH', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'ADJUSTMENT')),
    quantity NUMERIC(14, 3) NOT NULL,
    quantity_on_hand_before NUMERIC(14, 3) NOT NULL,
    quantity_on_hand_after NUMERIC(14, 3) NOT NULL,
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('GOODS_RECEIPT', 'SALES_ORDER', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT')),
    reference_id UUID NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_wh ON stock_movements (product_id, warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements (reference_type, reference_id);

-- 10. Stock Reservations Table
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity_reserved NUMERIC(14, 3) NOT NULL CHECK (quantity_reserved > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stock_reservation UNIQUE (sales_order_id, product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_res_order ON stock_reservations (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_res_product ON stock_reservations (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_res_status ON stock_reservations (status);

-- 11. Serial Numbers Table
CREATE TABLE IF NOT EXISTS serial_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'DISPATCHED', 'INSTALLED', 'RETURNED', 'UNDER_REPAIR', 'REPLACED')),
    current_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    current_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    grn_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
    manufacturing_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_serials_serial ON serial_numbers (serial_number);
CREATE INDEX IF NOT EXISTS idx_serials_prod_wh ON serial_numbers (product_id, warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_serials_order ON serial_numbers (current_order_id);

-- 12. Serial Movements Table (Append-only audit trail)
CREATE TABLE IF NOT EXISTS serial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_id UUID NOT NULL REFERENCES serial_numbers(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    from_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('GOODS_RECEIPT', 'ORDER_RESERVATION', 'RESERVATION_RELEASE', 'DISPATCH', 'INSTALLATION', 'RETURN', 'ADJUSTMENT')),
    reference_id UUID,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_serial_movements_serial ON serial_movements (serial_id, created_at DESC);

-- 13. Seed Baseline Warehouses
INSERT INTO warehouses (code, name, address_line1, city, state, pincode, is_active)
VALUES
    ('WH-AHM-01', 'Ahmedabad Central EPC Warehouse', 'Plot 42, GIDC Vatva, Phase IV', 'Ahmedabad', 'Gujarat', '382445', true),
    ('WH-SRT-01', 'Surat Regional Depot', 'Survey 108, Sachin GIDC Industrial Zone', 'Surat', 'Gujarat', '394230', true)
ON CONFLICT (code) DO NOTHING;

-- 14. Seed Baseline Solar Tier-1 Suppliers
INSERT INTO suppliers (supplier_code, name, contact_person, phone_e164, email, gstin, payment_terms_days, address_line1, city, state, pincode)
VALUES
    ('SUP-2026-001', 'Waaree Energies Limited', 'Hitesh Doshi (Key Accounts)', '+919820011223', 'sales@waaree.com', '27AABCW1234F1Z1', 30, 'Waaree House, 100 Ft Rd, Andheri East', 'Mumbai', 'Maharashtra', '400093'),
    ('SUP-2026-002', 'Growatt New Energy Pvt Ltd', 'Sunil Shenoy', '+919845012345', 'service.in@growatt.com', '29AABCG5678K1Z5', 45, 'Plot 14, Phase II, Electronic City', 'Bengaluru', 'Karnataka', '560100'),
    ('SUP-2026-003', 'Polycab India Limited', 'Rajesh Sharma', '+919876543210', 'solar.cables@polycab.com', '27AABCP9012M1Z8', 30, 'Polycab House, 771 Mogul Lane, Mahim', 'Mumbai', 'Maharashtra', '400016')
ON CONFLICT (supplier_code) DO NOTHING;

-- 15. Seed Procurement & Inventory Permissions
INSERT INTO permissions (code, module, description)
VALUES
    ('suppliers:read', 'procurement', 'View vendor and supplier directory'),
    ('suppliers:create', 'procurement', 'Onboard new equipment suppliers'),
    ('suppliers:update', 'procurement', 'Modify supplier payment terms and profile'),
    ('purchase_orders:read', 'procurement', 'View purchase orders and delivery status'),
    ('purchase_orders:create', 'procurement', 'Draft purchase orders for procurement'),
    ('purchase_orders:approve', 'procurement', 'Approve purchase orders for vendor issuance'),
    ('goods_receipts:read', 'procurement', 'View goods receipt notes and GRN logs'),
    ('goods_receipts:create', 'procurement', 'Perform goods receipt, count checks and serial capture'),
    ('inventory:read', 'inventory', 'View multi-warehouse stock balances and ledger'),
    ('inventory:reserve', 'inventory', 'Reserve stock allocations against sales orders'),
    ('inventory:transfer', 'inventory', 'Initiate inter-warehouse inventory transfers'),
    ('inventory:adjust', 'inventory', 'Perform audited manual inventory adjustments'),
    ('serials:read', 'inventory', 'Search and view serialized asset lifecycle and history'),
    ('serials:scan', 'inventory', 'Scan serial numbers for GRN and dispatch verification')
ON CONFLICT (code) DO NOTHING;

-- Map permissions to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
    'suppliers:read', 'suppliers:create', 'suppliers:update',
    'purchase_orders:read', 'purchase_orders:create', 'purchase_orders:approve',
    'goods_receipts:read', 'goods_receipts:create',
    'inventory:read', 'inventory:reserve', 'inventory:transfer', 'inventory:adjust',
    'serials:read', 'serials:scan'
  )
ON CONFLICT DO NOTHING;

-- Map to STORE_MANAGER, WAREHOUSE_MANAGER, OPERATIONS_HEAD
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('STORE_MANAGER', 'WAREHOUSE_MANAGER', 'OPERATIONS_HEAD')
  AND p.code IN (
    'suppliers:read', 'suppliers:create', 'suppliers:update',
    'purchase_orders:read', 'purchase_orders:create', 'purchase_orders:approve',
    'goods_receipts:read', 'goods_receipts:create',
    'inventory:read', 'inventory:reserve', 'inventory:transfer', 'inventory:adjust',
    'serials:read', 'serials:scan'
  )
ON CONFLICT DO NOTHING;

-- Map to SALES_MANAGER & SALES_REP
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('SALES_MANAGER', 'SALES_REP')
  AND p.code IN (
    'inventory:read', 'inventory:reserve', 'serials:read'
  )
ON CONFLICT DO NOTHING;
