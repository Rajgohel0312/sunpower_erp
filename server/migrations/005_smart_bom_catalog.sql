-- SunPower ERP: 005_smart_bom_catalog.sql
-- Expand product catalog for intelligent multi-variable BOM generation

-- 1. Growatt 3kW Single Phase Inverter
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'INV-GROWATT-3KW-1P', 
    'Growatt', 
    'MIN 3000TL-X 3kW Single Phase On-Grid', 
    3000.00, 
    'NOS', 
    26000.00, 
    12.00, 
    '85044080', 
    true, 
    '{"mppt_trackers": 1, "max_efficiency_pct": 98.2, "warranty_years": 10}'::jsonb
FROM product_categories WHERE code = 'INVERTER'
ON CONFLICT (sku) DO NOTHING;

-- 2. Growatt 5kW Three Phase Inverter
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'INV-GROWATT-5KW-3P', 
    'Growatt', 
    'MOD 5000TL3-X 5kW Three Phase On-Grid', 
    5000.00, 
    'NOS', 
    46000.00, 
    12.00, 
    '85044080', 
    true, 
    '{"mppt_trackers": 2, "max_efficiency_pct": 98.4, "warranty_years": 10}'::jsonb
FROM product_categories WHERE code = 'INVERTER'
ON CONFLICT (sku) DO NOTHING;

-- 3. Tin Shed Rail-less Mounting Kit for METAL_SHEET
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'STR-TIN-SHED-PERKW', 
    'SunPower Fab', 
    'Rail-less Anodized Aluminum Clamp Kit for Metal Sheds', 
    1000.00, 
    'SET', 
    2200.00, 
    18.00, 
    '76109090', 
    false, 
    '{"material": "AL6005-T5 Aluminum", "waterproofing": "EPDM Gasket included"}'::jsonb
FROM product_categories WHERE code = 'STRUCTURE'
ON CONFLICT (sku) DO NOTHING;

-- 4. Heavy-Duty Elevated Super-Structure Kit (> 8ft clearance)
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'STR-SUPER-ELEVATED-PERKW', 
    'SunPower Fab', 
    'High-Clearance HDG Elevated Super-Structure Kit (>8ft)', 
    1000.00, 
    'SET', 
    6800.00, 
    18.00, 
    '73089090', 
    false, 
    '{"clearance_ft": 8.5, "coating_micron": 85, "truss_design": "Heavy C-Channel/Pipe"}'::jsonb
FROM product_categories WHERE code = 'STRUCTURE'
ON CONFLICT (sku) DO NOTHING;

-- 5. Tiled Roof SS304 Brackets & Rail Kit
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'STR-TILED-ROOF-PERKW', 
    'SunPower Fab', 
    'SS304 Tile Hook & Extruded Rail Mounting Kit', 
    1000.00, 
    'SET', 
    3800.00, 
    18.00, 
    '73089090', 
    false, 
    '{"bracket_material": "SS304", "rail_material": "AL6005-T5"}'::jsonb
FROM product_categories WHERE code = 'STRUCTURE'
ON CONFLICT (sku) DO NOTHING;

-- 6. Three-Phase AC Distribution Box (ACDB 3-Phase)
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'BOX-ACDB-3P-10KW', 
    'Hensel', 
    'AC Distribution Box Three Phase 415V with Type II SPD & 32A 4P MCB', 
    10000.00, 
    'NOS', 
    4800.00, 
    18.00, 
    '85371000', 
    false, 
    '{"ip_rating": "IP65", "spd_type": "Type 2", "poles": 4}'::jsonb
FROM product_categories WHERE code = 'ACDB_DCDB'
ON CONFLICT (sku) DO NOTHING;

-- 7. Heavy-Duty 4-Core Armored AC Cable
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'CBL-AC-ARMORED-4SQMM', 
    'Polycab', 
    'Heavy-Duty 4-Core 4 sq mm Armored Copper AC Cable', 
    NULL, 
    'MTR', 
    95.00, 
    18.00, 
    '85444999', 
    false, 
    '{"voltage_v": 1100, "conductor": "Copper", "armored": true}'::jsonb
FROM product_categories WHERE code = 'CABLE'
ON CONFLICT (sku) DO NOTHING;

-- 8. Lightning Arrester (LA) Protection Kit
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'LA-LIGHTNING-ARRESTER-KIT', 
    'TruePower', 
    'Conventional Copper Lightning Arrester Kit with 1m Mast & Base', 
    NULL, 
    'SET', 
    3500.00, 
    18.00, 
    '85354030', 
    false, 
    '{"mast_height_m": 1.0, "coverage_radius_m": 25, "material": "Solid Pure Copper"}'::jsonb
FROM product_categories WHERE code = 'PROTECTION_EARTHING'
ON CONFLICT (sku) DO NOTHING;

-- 9. Balance of System (BOS) Installation Accessories Kit per kW
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 
    'ACC-INSTALL-KIT-PERKW', 
    'SunPower BOS', 
    'Complete Balance of System (BOS) Installation Kit per kW', 
    1000.00, 
    'SET', 
    1200.00, 
    18.00, 
    '85389000', 
    false, 
    '{"includes": "MC4 connector pairs, heavy-duty PVC conduits, UV-resistant cable ties, fasteners"}'::jsonb
FROM product_categories WHERE code = 'ACCESSORY'
ON CONFLICT (sku) DO NOTHING;
