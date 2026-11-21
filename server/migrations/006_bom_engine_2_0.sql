-- SunPower ERP: 006_bom_engine_2_0.sql
-- Dynamic Engineering BOM Engine 2.0: Technical Specifications, Price History, and Engineering Validation

-- 1. Product Specifications Table
CREATE TABLE IF NOT EXISTS product_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    category_code VARCHAR(50) NOT NULL,
    
    -- PV Module Specifications
    rated_power_w NUMERIC(10, 2),
    voc_v NUMERIC(8, 2),
    vmp_v NUMERIC(8, 2),
    isc_a NUMERIC(8, 2),
    imp_a NUMERIC(8, 2),
    temp_coeff_voc_pct NUMERIC(6, 3) DEFAULT -0.270, -- % / deg C
    temp_coeff_pmax_pct NUMERIC(6, 3) DEFAULT -0.350, -- % / deg C
    max_system_voltage_v NUMERIC(8, 2) DEFAULT 1500.00,
    length_mm NUMERIC(8, 2),
    width_mm NUMERIC(8, 2),
    weight_kg NUMERIC(8, 2),
    max_series_fuse_rating_a NUMERIC(6, 2) DEFAULT 25.00,

    -- Inverter Specifications
    rated_ac_power_w NUMERIC(10, 2),
    max_dc_power_w NUMERIC(10, 2),
    max_dc_voltage_v NUMERIC(8, 2),
    mppt_voltage_min_v NUMERIC(8, 2),
    mppt_voltage_max_v NUMERIC(8, 2),
    mppt_nominal_voltage_v NUMERIC(8, 2),
    mppt_trackers INTEGER DEFAULT 1,
    inputs_per_mppt INTEGER DEFAULT 1,
    max_input_current_per_mppt_a NUMERIC(8, 2),
    max_short_circuit_current_a NUMERIC(8, 2),
    phase VARCHAR(20) DEFAULT 'SINGLE' CHECK (phase IN ('SINGLE', 'THREE')),
    nominal_ac_voltage_v NUMERIC(8, 2) DEFAULT 230.00,
    max_ac_current_a NUMERIC(8, 2),
    max_efficiency_pct NUMERIC(5, 2) DEFAULT 98.40,

    -- Mounting Structure Specifications
    supported_roof_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    material VARCHAR(100),
    coating_thickness_microns NUMERIC(6, 2),
    wind_speed_rating_kmph NUMERIC(6, 2) DEFAULT 150.00,
    tilt_angle_min_deg NUMERIC(5, 2) DEFAULT 10.00,
    tilt_angle_max_deg NUMERIC(5, 2) DEFAULT 25.00,
    ground_clearance_mm NUMERIC(8, 2) DEFAULT 300.00,

    -- Cable Specifications
    conductor_material VARCHAR(50) DEFAULT 'Copper',
    cross_section_sqmm NUMERIC(6, 2),
    cores INTEGER DEFAULT 1,
    voltage_rating_v NUMERIC(8, 2) DEFAULT 1100.00,
    current_carrying_capacity_a NUMERIC(8, 2),
    resistance_ohm_per_km NUMERIC(8, 4),
    is_uv_resistant BOOLEAN DEFAULT false,
    is_armored BOOLEAN DEFAULT false,

    -- Protection Switchgear Specifications
    rated_voltage_v NUMERIC(8, 2),
    rated_current_a NUMERIC(8, 2),
    poles INTEGER DEFAULT 2,
    spd_type VARCHAR(50) DEFAULT 'Type 2',
    spd_voltage_rating_v NUMERIC(8, 2),
    fuse_rating_a NUMERIC(6, 2),
    ip_rating VARCHAR(20) DEFAULT 'IP65',

    -- Supplementary Datasheet Attributes
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_specs_product ON product_specifications (product_id);
CREATE INDEX IF NOT EXISTS idx_prod_specs_category ON product_specifications (category_code);

-- 2. Product Prices Table (Historical & Effective-Dated Price Ledger)
CREATE TABLE IF NOT EXISTS product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_cost NUMERIC(14, 2) NOT NULL CHECK (unit_cost >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ,
    supplier_name VARCHAR(150),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_prices_product ON product_prices (product_id);
CREATE INDEX IF NOT EXISTS idx_prod_prices_dates ON product_prices (product_id, effective_from, effective_to);

-- 3. Extend project_boms with Engineering Validation & Snapshot Fields
ALTER TABLE project_boms 
ADD COLUMN IF NOT EXISTS generation_mode VARCHAR(50) NOT NULL DEFAULT 'PRELIMINARY' CHECK (generation_mode IN ('PRELIMINARY', 'INSTALLATION_READY')),
ADD COLUMN IF NOT EXISTS is_approval_blocked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS engineering_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. BOM Validations Table (Deterministic Multi-Variable Audit Log)
CREATE TABLE IF NOT EXISTS bom_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES project_boms(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'REVIEW', 'BLOCKER')),
    component VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    expected_value VARCHAR(255),
    actual_value VARCHAR(255),
    technical_explanation TEXT,
    recommended_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_validations_bom ON bom_validations (bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_validations_severity ON bom_validations (severity);

-- 5. Backfill Product Specifications for Existing Catalog Items
-- A. Solar Panels (Waaree Aditya 540W Mono PERC Half-Cut)
INSERT INTO product_specifications (
    product_id, category_code, rated_power_w, voc_v, vmp_v, isc_a, imp_a,
    temp_coeff_voc_pct, temp_coeff_pmax_pct, max_system_voltage_v,
    length_mm, width_mm, weight_kg, max_series_fuse_rating_a, attributes
)
SELECT 
    id, 'PANEL', 540.00, 49.50, 41.80, 13.85, 12.92,
    -0.270, -0.350, 1500.00,
    2278.00, 1134.00, 27.50, 25.00,
    '{"efficiency_pct": 21.3, "cell_type": "Mono PERC 144 Half-Cells", "certifications": ["IEC 61215", "IEC 61730", "IS 14286", "BIS"]}'::jsonb
FROM products WHERE sku = 'PNL-WAAREE-540W'
ON CONFLICT (product_id) DO UPDATE SET
    rated_power_w = EXCLUDED.rated_power_w,
    voc_v = EXCLUDED.voc_v,
    vmp_v = EXCLUDED.vmp_v,
    isc_a = EXCLUDED.isc_a,
    imp_a = EXCLUDED.imp_a;

-- B. Inverters
-- Growatt MIN 3000TL-X (3kW 1P)
INSERT INTO product_specifications (
    product_id, category_code, rated_ac_power_w, max_dc_power_w, max_dc_voltage_v,
    mppt_voltage_min_v, mppt_voltage_max_v, mppt_nominal_voltage_v, mppt_trackers, inputs_per_mppt,
    max_input_current_per_mppt_a, max_short_circuit_current_a, phase, nominal_ac_voltage_v,
    max_ac_current_a, max_efficiency_pct, attributes
)
SELECT 
    id, 'INVERTER', 3000.00, 4200.00, 500.00,
    50.00, 500.00, 360.00, 1, 1,
    13.50, 16.90, 'SINGLE', 230.00,
    13.60, 98.20,
    '{"grid_regulation": "CEA / DISCOM Approved", "protection_rating": "IP65"}'::jsonb
FROM products WHERE sku = 'INV-GROWATT-3KW-1P'
ON CONFLICT (product_id) DO UPDATE SET rated_ac_power_w = EXCLUDED.rated_ac_power_w;

-- Growatt MIN 5000TL-X (5kW 1P)
INSERT INTO product_specifications (
    product_id, category_code, rated_ac_power_w, max_dc_power_w, max_dc_voltage_v,
    mppt_voltage_min_v, mppt_voltage_max_v, mppt_nominal_voltage_v, mppt_trackers, inputs_per_mppt,
    max_input_current_per_mppt_a, max_short_circuit_current_a, phase, nominal_ac_voltage_v,
    max_ac_current_a, max_efficiency_pct, attributes
)
SELECT 
    id, 'INVERTER', 5000.00, 7000.00, 550.00,
    80.00, 500.00, 360.00, 2, 1,
    13.50, 16.90, 'SINGLE', 230.00,
    22.70, 98.40,
    '{"grid_regulation": "CEA / DISCOM Approved", "protection_rating": "IP65"}'::jsonb
FROM products WHERE sku = 'INV-GROWATT-5KW-1P'
ON CONFLICT (product_id) DO UPDATE SET rated_ac_power_w = EXCLUDED.rated_ac_power_w;

-- Growatt MOD 5000TL3-X (5kW 3P)
INSERT INTO product_specifications (
    product_id, category_code, rated_ac_power_w, max_dc_power_w, max_dc_voltage_v,
    mppt_voltage_min_v, mppt_voltage_max_v, mppt_nominal_voltage_v, mppt_trackers, inputs_per_mppt,
    max_input_current_per_mppt_a, max_short_circuit_current_a, phase, nominal_ac_voltage_v,
    max_ac_current_a, max_efficiency_pct, attributes
)
SELECT 
    id, 'INVERTER', 5000.00, 7500.00, 1100.00,
    140.00, 1000.00, 580.00, 2, 1,
    13.00, 16.00, 'THREE', 415.00,
    7.60, 98.40,
    '{"grid_regulation": "CEA / DISCOM Approved", "protection_rating": "IP66"}'::jsonb
FROM products WHERE sku = 'INV-GROWATT-5KW-3P'
ON CONFLICT (product_id) DO UPDATE SET rated_ac_power_w = EXCLUDED.rated_ac_power_w;

-- Growatt MOD 10KTL3-X (10kW 3P)
INSERT INTO product_specifications (
    product_id, category_code, rated_ac_power_w, max_dc_power_w, max_dc_voltage_v,
    mppt_voltage_min_v, mppt_voltage_max_v, mppt_nominal_voltage_v, mppt_trackers, inputs_per_mppt,
    max_input_current_per_mppt_a, max_short_circuit_current_a, phase, nominal_ac_voltage_v,
    max_ac_current_a, max_efficiency_pct, attributes
)
SELECT 
    id, 'INVERTER', 10000.00, 15000.00, 1100.00,
    140.00, 1000.00, 580.00, 2, 1,
    13.00, 16.00, 'THREE', 415.00,
    15.20, 98.60,
    '{"grid_regulation": "CEA / DISCOM Approved", "protection_rating": "IP66"}'::jsonb
FROM products WHERE sku = 'INV-GROWATT-10KW-3P'
ON CONFLICT (product_id) DO UPDATE SET rated_ac_power_w = EXCLUDED.rated_ac_power_w;

-- C. Mounting Structures
-- STR-TIN-SHED-PERKW (Metal Sheet Clamps)
INSERT INTO product_specifications (
    product_id, category_code, supported_roof_types, material, coating_thickness_microns,
    wind_speed_rating_kmph, tilt_angle_min_deg, tilt_angle_max_deg, ground_clearance_mm, attributes
)
SELECT 
    id, 'STRUCTURE', '["METAL_SHEET"]'::jsonb, 'AL6005-T5 Anodized Aluminum', 15.00,
    180.00, 5.00, 30.00, 80.00,
    '{"profile_compatibility": ["Trapezoidal", "Standing Seam"], "penetration": "Non-penetrating EPDM Clamp"}'::jsonb
FROM products WHERE sku = 'STR-TIN-SHED-PERKW'
ON CONFLICT (product_id) DO NOTHING;

-- STR-GI-ELEVATED-PERKW (RCC Flat Slab)
INSERT INTO product_specifications (
    product_id, category_code, supported_roof_types, material, coating_thickness_microns,
    wind_speed_rating_kmph, tilt_angle_min_deg, tilt_angle_max_deg, ground_clearance_mm, attributes
)
SELECT 
    id, 'STRUCTURE', '["RCC_FLAT", "GROUND_MOUNT"]'::jsonb, 'HDG Galvanized Steel IS 2062', 80.00,
    150.00, 15.00, 25.00, 350.00,
    '{"foundation_type": "Civil Ballast / Anchor Fastener", "design_standard": "IS 875 Part 3"}'::jsonb
FROM products WHERE sku = 'STR-GI-ELEVATED-PERKW'
ON CONFLICT (product_id) DO NOTHING;

-- STR-SUPER-ELEVATED-PERKW (High Clearance Super-Structure)
INSERT INTO product_specifications (
    product_id, category_code, supported_roof_types, material, coating_thickness_microns,
    wind_speed_rating_kmph, tilt_angle_min_deg, tilt_angle_max_deg, ground_clearance_mm, attributes
)
SELECT 
    id, 'STRUCTURE', '["RCC_FLAT"]'::jsonb, 'Heavy HDG C-Channel Truss IS 2062', 85.00,
    160.00, 12.00, 20.00, 2500.00,
    '{"clearance_ft": 8.5, "purpose": "Elevated rooftop canopy bridging parapets and water tanks"}'::jsonb
FROM products WHERE sku = 'STR-SUPER-ELEVATED-PERKW'
ON CONFLICT (product_id) DO NOTHING;

-- STR-TILED-ROOF-PERKW (Tiled Roofs)
INSERT INTO product_specifications (
    product_id, category_code, supported_roof_types, material, coating_thickness_microns,
    wind_speed_rating_kmph, tilt_angle_min_deg, tilt_angle_max_deg, ground_clearance_mm, attributes
)
SELECT 
    id, 'STRUCTURE', '["TILED_ROOF"]'::jsonb, 'SS304 Brackets & Aluminum Rails', 20.00,
    150.00, 15.00, 35.00, 120.00,
    '{"tile_compatibility": ["Mangalore Tile", "Clay Tile", "Roman Tile"]}'::jsonb
FROM products WHERE sku = 'STR-TILED-ROOF-PERKW'
ON CONFLICT (product_id) DO NOTHING;

-- D. Cables
-- CBL-DC-POLYCAB-4SQMM (DC Solar Cable)
INSERT INTO product_specifications (
    product_id, category_code, conductor_material, cross_section_sqmm, cores,
    voltage_rating_v, current_carrying_capacity_a, resistance_ohm_per_km, is_uv_resistant, is_armored, attributes
)
SELECT 
    id, 'CABLE', 'Tinned Copper Class 5', 4.00, 1,
    1500.00, 55.00, 4.9500, true, false,
    '{"standard": "EN 50618", "temp_rating_degc": 120, "conductor_class": "Class 5 Flexible"}'::jsonb
FROM products WHERE sku = 'CBL-DC-POLYCAB-4SQMM'
ON CONFLICT (product_id) DO NOTHING;

-- CBL-AC-ARMORED-4SQMM (Heavy-Duty AC Armored Cable)
INSERT INTO product_specifications (
    product_id, category_code, conductor_material, cross_section_sqmm, cores,
    voltage_rating_v, current_carrying_capacity_a, resistance_ohm_per_km, is_uv_resistant, is_armored, attributes
)
SELECT 
    id, 'CABLE', 'Annealed Bare Copper', 4.00, 4,
    1100.00, 38.00, 4.9500, true, true,
    '{"standard": "IS 1554 Part 1 / IS 7098", "armor_type": "Galvanized Steel Wire"}'::jsonb
FROM products WHERE sku = 'CBL-AC-ARMORED-4SQMM'
ON CONFLICT (product_id) DO NOTHING;

-- E. Protection Boxes (ACDB & DCDB)
-- BOX-ACDB-1P-6KW
INSERT INTO product_specifications (
    product_id, category_code, rated_voltage_v, rated_current_a, poles,
    spd_type, spd_voltage_rating_v, ip_rating, attributes
)
SELECT 
    id, 'ACDB_DCDB', 230.00, 32.00, 2,
    'Type 2', 320.00, 'IP65',
    '{"mcb_curve": "C", "short_circuit_ka": 10, "enclosure": "Polycarbonate UV-Stabilized"}'::jsonb
FROM products WHERE sku = 'BOX-ACDB-1P-6KW'
ON CONFLICT (product_id) DO NOTHING;

-- BOX-ACDB-3P-10KW
INSERT INTO product_specifications (
    product_id, category_code, rated_voltage_v, rated_current_a, poles,
    spd_type, spd_voltage_rating_v, ip_rating, attributes
)
SELECT 
    id, 'ACDB_DCDB', 415.00, 32.00, 4,
    'Type 2', 440.00, 'IP65',
    '{"mcb_curve": "C", "short_circuit_ka": 10, "enclosure": "Polycarbonate UV-Stabilized"}'::jsonb
FROM products WHERE sku = 'BOX-ACDB-3P-10KW'
ON CONFLICT (product_id) DO NOTHING;

-- BOX-DCDB-2IN-2OUT
INSERT INTO product_specifications (
    product_id, category_code, rated_voltage_v, rated_current_a, poles,
    spd_type, spd_voltage_rating_v, fuse_rating_a, ip_rating, attributes
)
SELECT 
    id, 'ACDB_DCDB', 1000.00, 32.00, 2,
    'Type 2 DC', 1000.00, 15.00, 'IP65',
    '{"fuse_type": "10x38 mm gPV", "isolator_rating_a": 32, "strings_supported": 2}'::jsonb
FROM products WHERE sku = 'BOX-DCDB-2IN-2OUT'
ON CONFLICT (product_id) DO NOTHING;

-- F. Earthing & Lightning Protection
-- EARTH-COPPER-ROD-2M
INSERT INTO product_specifications (
    product_id, category_code, attributes
)
SELECT 
    id, 'PROTECTION_EARTHING',
    '{"length_mtr": 2.0, "diameter_mm": 17.2, "coating_microns": 250, "compound_weight_kg": 25, "standard": "IS 3043 / IEEE 80"}'::jsonb
FROM products WHERE sku = 'EARTH-COPPER-ROD-2M'
ON CONFLICT (product_id) DO NOTHING;

-- LA-LIGHTNING-ARRESTER-KIT
INSERT INTO product_specifications (
    product_id, category_code, attributes
)
SELECT 
    id, 'PROTECTION_EARTHING',
    '{"mast_height_m": 1.0, "coverage_radius_m": 25, "material": "Solid Pure Copper", "standard": "IS/IEC 62305"}'::jsonb
FROM products WHERE sku = 'LA-LIGHTNING-ARRESTER-KIT'
ON CONFLICT (product_id) DO NOTHING;

-- G. Accessories
-- ACC-INSTALL-KIT-PERKW
INSERT INTO product_specifications (
    product_id, category_code, attributes
)
SELECT 
    id, 'ACCESSORY',
    '{"includes": "MC4 connector pairs, heavy-duty PVC conduit pipes, UV-resistant nylon cable ties, SS fasteners"}'::jsonb
FROM products WHERE sku = 'ACC-INSTALL-KIT-PERKW'
ON CONFLICT (product_id) DO NOTHING;

-- 6. Initial Backfill of Product Prices Table from products.standard_cost
INSERT INTO product_prices (product_id, unit_cost, currency, supplier_name, notes)
SELECT 
    id, standard_cost, 'INR', 'SunPower Authorized Distribution', 'Initial pricing snapshot'
FROM products
WHERE id NOT IN (SELECT product_id FROM product_prices);
