-- SunPower ERP: 004_catalog_surveys_and_bom.sql
-- Product Catalog, Rooftop Site Surveys, Rooftop Photos & Engineering Bill of Materials (BOM)

-- 1. Sequences for Human-Readable Identifiers
CREATE SEQUENCE IF NOT EXISTS survey_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS bom_number_seq START 1;

-- 2. Product Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Standard Solar Categories
INSERT INTO product_categories (code, name, description) VALUES
('PANEL', 'Solar PV Modules', 'Mono Perc, Bi-facial, and TopCon high-efficiency photovoltaic panels'),
('INVERTER', 'Solar Inverters', 'On-grid string inverters, hybrid inverters, and micro-inverters'),
('STRUCTURE', 'Mounting Structures', 'GI hot-dip galvanized rooftop, tin shed clamps, and elevated structures'),
('CABLE', 'Solar Cables & Wires', 'UV-resistant DC solar cables (4/6 sq mm) and AC armored copper/aluminum cables'),
('ACDB_DCDB', 'Distribution & Protection Boxes', 'ACDB and DCDB combiner boxes equipped with SPD and MCB protection'),
('PROTECTION_EARTHING', 'Earthing & Lightning Arresters', 'Chemical earthing electrodes, carbon backfill compound, and lightning arresters'),
('NET_METER', 'Bi-directional Meters', 'DISCOM approved bi-directional net-meters and generation check meters'),
('ACCESSORY', 'Installation Accessories', 'MC4 connectors, PVC conduits, cable trays, anchor fasteners, and hardware')
ON CONFLICT (code) DO NOTHING;

-- 3. Products Table (Master Component Catalog)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
    sku VARCHAR(100) NOT NULL UNIQUE,
    brand VARCHAR(100) NOT NULL,
    model_name VARCHAR(150) NOT NULL,
    rated_capacity_w NUMERIC(10, 2),
    unit_code VARCHAR(20) NOT NULL DEFAULT 'NOS',
    standard_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (standard_cost >= 0),
    tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 12.00 CHECK (tax_rate_pct >= 0),
    hsn_code VARCHAR(20) DEFAULT '85414011',
    is_serial_tracked BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active) WHERE deleted_at IS NULL;

-- Seed Initial Product Catalog for Rooftop Projects
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'PNL-WAAREE-540W', 
    'Waaree', 
    'Aditya Series 540W Mono Perc Half-Cut', 
    540.00, 
    'NOS', 
    11500.00, 
    12.00, 
    '85414011', 
    true, 
    '{"efficiency_pct": 21.3, "warranty_years": 25, "cell_type": "Mono PERC"}'::jsonb
FROM product_categories WHERE code = 'PANEL'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'INV-GROWATT-5KW-1P', 
    'Growatt', 
    'MIN 5000TL-X 5kW Single Phase On-Grid', 
    5000.00, 
    'NOS', 
    38000.00, 
    12.00, 
    '85044080', 
    true, 
    '{"mppt_trackers": 2, "max_efficiency_pct": 98.4, "warranty_years": 10}'::jsonb
FROM product_categories WHERE code = 'INVERTER'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'INV-GROWATT-10KW-3P', 
    'Growatt', 
    'MOD 10KTL3-X 10kW Three Phase On-Grid', 
    10000.00, 
    'NOS', 
    62000.00, 
    12.00, 
    '85044080', 
    true, 
    '{"mppt_trackers": 2, "max_efficiency_pct": 98.6, "warranty_years": 10}'::jsonb
FROM product_categories WHERE code = 'INVERTER'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'STR-GI-ELEVATED-PERKW', 
    'SunPower Fab', 
    'HDG Elevated GI Module Mounting Structure Kit', 
    1000.00, 
    'SET', 
    4500.00, 
    18.00, 
    '73089090', 
    false, 
    '{"coating_micron": 80, "wind_speed_rating_kmph": 150}'::jsonb
FROM product_categories WHERE code = 'STRUCTURE'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'CBL-DC-POLYCAB-4SQMM', 
    'Polycab', 
    'Solar DC Flexible Cable 1C x 4 sq mm (Tinned Copper)', 
    NULL, 
    'MTR', 
    42.00, 
    18.00, 
    '85444999', 
    false, 
    '{"voltage_rating_v": 1500, "conductor": "Tinned Copper"}'::jsonb
FROM product_categories WHERE code = 'CABLE'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'BOX-ACDB-1P-6KW', 
    'Hensel', 
    'AC Distribution Box Single Phase with Type II SPD & 32A MCB', 
    6000.00, 
    'NOS', 
    2800.00, 
    18.00, 
    '85371000', 
    false, 
    '{"ip_rating": "IP65", "spd_type": "Type 2"}'::jsonb
FROM product_categories WHERE code = 'ACDB_DCDB'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'BOX-DCDB-2IN-2OUT', 
    'Hensel', 
    'DC Distribution Box 2-String with 1000V DC SPD & Fuses', 
    NULL, 
    'NOS', 
    3200.00, 
    18.00, 
    '85371000', 
    false, 
    '{"ip_rating": "IP65", "voltage_v": 1000}'::jsonb
FROM product_categories WHERE code = 'ACDB_DCDB'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'EARTH-COPPER-ROD-2M', 
    'TruePower', 
    'Chemical Earthing Copper Bonded Electrode 2 Meter with 25kg Compound', 
    NULL, 
    'SET', 
    2400.00, 
    18.00, 
    '85359090', 
    false, 
    '{"diameter_mm": 17.2, "length_mtr": 2.0}'::jsonb
FROM product_categories WHERE code = 'PROTECTION_EARTHING'
ON CONFLICT (sku) DO NOTHING;

-- 4. Site Surveys Table
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_number VARCHAR(50) NOT NULL UNIQUE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVISION_REQUIRED', 'CANCELLED')),
    roof_type VARCHAR(50) CHECK (roof_type IS NULL OR roof_type IN ('RCC_FLAT', 'METAL_SHEET', 'TILED_ROOF', 'GROUND_MOUNT', 'OTHER')),
    shadow_free_area_sqft NUMERIC(10, 2) CHECK (shadow_free_area_sqft IS NULL OR shadow_free_area_sqft >= 0),
    proposed_capacity_kw NUMERIC(10, 2) CHECK (proposed_capacity_kw IS NULL OR proposed_capacity_kw > 0),
    sanctioned_load_kw NUMERIC(10, 2) CHECK (sanctioned_load_kw IS NULL OR sanctioned_load_kw > 0),
    supply_phase VARCHAR(20) DEFAULT 'SINGLE' CHECK (supply_phase IN ('SINGLE', 'THREE')),
    discom_provider VARCHAR(100),
    consumer_number VARCHAR(50),
    distance_roof_to_meter_m NUMERIC(10, 2) CHECK (distance_roof_to_meter_m IS NULL OR distance_roof_to_meter_m >= 0),
    earthing_pits_needed INTEGER DEFAULT 2 CHECK (earthing_pits_needed >= 1),
    structure_type VARCHAR(50) DEFAULT 'STANDARD_GI' CHECK (structure_type IN ('STANDARD_GI', 'ELEVATED_SUPER_STRUCTURE', 'BALLASTED', 'FLUSH_MOUNT')),
    notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_comments TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_surveys_lead ON surveys (lead_id);
CREATE INDEX IF NOT EXISTS idx_surveys_customer ON surveys (customer_id);
CREATE INDEX IF NOT EXISTS idx_surveys_engineer ON surveys (assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys (status);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys (created_at DESC);

-- 5. Survey Photos Table
CREATE TABLE IF NOT EXISTS survey_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    photo_category VARCHAR(50) NOT NULL CHECK (photo_category IN ('ROOF_PANORAMA', 'SHADOW_OBSTRUCTION', 'METER_BOX', 'DISTRIBUTION_PANEL', 'EARTHING_SITE', 'CABLE_PATH', 'GENERAL')),
    file_record_id UUID REFERENCES file_records(id) ON DELETE SET NULL,
    file_url VARCHAR(500),
    caption VARCHAR(255),
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_photos_survey ON survey_photos (survey_id);

-- 6. Project BOMs Table (Engineering Bill of Materials)
CREATE TABLE IF NOT EXISTS project_boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_number VARCHAR(50) NOT NULL UNIQUE,
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    system_capacity_kw NUMERIC(10, 2) NOT NULL CHECK (system_capacity_kw > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'SUPERSEDED')),
    total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost >= 0),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boms_lead ON project_boms (lead_id);
CREATE INDEX IF NOT EXISTS idx_boms_survey ON project_boms (survey_id);
CREATE INDEX IF NOT EXISTS idx_boms_status ON project_boms (status);

-- 7. Project BOM Items Table
CREATE TABLE IF NOT EXISTS project_bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES project_boms(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost >= 0),
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON project_bom_items (bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_product ON project_bom_items (product_id);

-- 8. Register Phase 4 Permissions
INSERT INTO permissions (code, module, description) VALUES
('catalog:read', 'catalog', 'Permission to view product catalog and categories'),
('catalog:manage', 'catalog', 'Permission to create, update, or deactivate products and categories'),
('surveys:read', 'surveys', 'Permission to view site surveys and rooftop photos'),
('surveys:create', 'surveys', 'Permission to schedule new rooftop site surveys'),
('surveys:update', 'surveys', 'Permission to execute, record parameters, and submit site surveys'),
('surveys:approve', 'surveys', 'Permission to approve or request revision on site surveys'),
('bom:read', 'bom', 'Permission to view engineering Bill of Materials'),
('bom:manage', 'bom', 'Permission to generate, modify, and approve project BOMs')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to standard roles
-- SUPER_ADMIN gets all permissions automatically via bypass.
-- SALES_MANAGER:
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'SALES_MANAGER'
  AND p.code IN ('catalog:read', 'surveys:read', 'surveys:create', 'surveys:update', 'surveys:approve', 'bom:read', 'bom:manage')
ON CONFLICT DO NOTHING;

-- SALES_REP:
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'SALES_REP'
  AND p.code IN ('catalog:read', 'surveys:read', 'surveys:create', 'bom:read')
ON CONFLICT DO NOTHING;

-- SURVEY_ENGINEER:
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'SURVEY_ENGINEER'
  AND p.code IN ('catalog:read', 'surveys:read', 'surveys:update', 'bom:read', 'bom:manage')
ON CONFLICT DO NOTHING;
