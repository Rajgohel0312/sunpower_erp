-- SunPower ERP: 007_alternative_brands_catalog.sql
-- Seeds certified alternative panel and inverter brands (Adani, Tata Power, Solis) for BOM customization

-- 1. Insert Alternative Products
INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 'PNL-ADANI-545W', 'Adani Solar', 'Shine Series 545W Mono PERC Half-Cut', 545.00, 'NOS', 11800.00, 12.00, '85414011', true,
    '{"origin": "India", "efficiency_pct": 21.1, "cell_type": "Mono PERC 144 Half-Cell"}'::jsonb
FROM product_categories WHERE code = 'PANEL'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 'PNL-TATA-540W', 'Tata Power Solar', 'TP540M Mono PERC Half-Cut', 540.00, 'NOS', 12200.00, 12.00, '85414011', true,
    '{"origin": "India", "efficiency_pct": 20.9, "cell_type": "Mono PERC 144 Half-Cell"}'::jsonb
FROM product_categories WHERE code = 'PANEL'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 'INV-SOLIS-5KW-1P', 'Solis', 'S6-GR1P5K 5kW Single Phase On-Grid', 5000.00, 'NOS', 39000.00, 12.00, '85044084', true,
    '{"mppt_trackers": 2, "max_efficiency": "97.7%"}'::jsonb
FROM product_categories WHERE code = 'INVERTER'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (category_id, sku, brand, model_name, rated_capacity_w, unit_code, standard_cost, tax_rate_pct, hsn_code, is_serial_tracked, metadata)
SELECT 
    id, 'INV-SOLIS-10KW-3P', 'Solis', 'S5-GR3P10K 10kW Three Phase On-Grid', 10000.00, 'NOS', 65000.00, 12.00, '85044084', true,
    '{"mppt_trackers": 2, "max_efficiency": "98.5%"}'::jsonb
FROM product_categories WHERE code = 'INVERTER'
ON CONFLICT (sku) DO NOTHING;

-- 2. Insert Specifications for New Products
-- PNL-ADANI-545W
INSERT INTO product_specifications (
    product_id, category_code, rated_power_w, voc_v, vmp_v, isc_a, imp_a,
    temp_coeff_voc_pct, temp_coeff_pmax_pct, max_system_voltage_v, length_mm, width_mm, weight_kg, max_series_fuse_rating_a, attributes
)
SELECT 
    id, 'PANEL', 545.00, 49.80, 41.90, 13.92, 13.01,
    -0.270, -0.350, 1500.00, 2278.00, 1134.00, 28.50, 25.00,
    '{"warranty_product_years": 12, "warranty_performance_years": 25, "cells": 144, "frame": "Anodized Aluminum"}'::jsonb
FROM products WHERE sku = 'PNL-ADANI-545W'
ON CONFLICT (product_id) DO NOTHING;

-- PNL-TATA-540W
INSERT INTO product_specifications (
    product_id, category_code, rated_power_w, voc_v, vmp_v, isc_a, imp_a,
    temp_coeff_voc_pct, temp_coeff_pmax_pct, max_system_voltage_v, length_mm, width_mm, weight_kg, max_series_fuse_rating_a, attributes
)
SELECT 
    id, 'PANEL', 540.00, 49.60, 41.70, 13.88, 12.95,
    -0.270, -0.350, 1500.00, 2278.00, 1134.00, 28.50, 25.00,
    '{"warranty_product_years": 12, "warranty_performance_years": 25, "cells": 144, "frame": "Anodized Aluminum"}'::jsonb
FROM products WHERE sku = 'PNL-TATA-540W'
ON CONFLICT (product_id) DO NOTHING;

-- INV-SOLIS-5KW-1P
INSERT INTO product_specifications (
    product_id, category_code, rated_ac_power_w, max_dc_power_w, max_dc_voltage_v,
    mppt_voltage_min_v, mppt_voltage_max_v, mppt_trackers, inputs_per_mppt,
    max_input_current_per_mppt_a, max_short_circuit_current_a, phase, nominal_ac_voltage_v, max_ac_current_a, max_efficiency_pct, attributes
)
SELECT 
    id, 'INVERTER', 5000.00, 7000.00, 600.00,
    90.00, 520.00, 2, 1,
    14.00, 18.00, 'SINGLE', 230.00, 22.70, 97.70,
    '{"weight_kg": 11.5, "protection_rating": "IP65", "communication": "WiFi / RS485"}'::jsonb
FROM products WHERE sku = 'INV-SOLIS-5KW-1P'
ON CONFLICT (product_id) DO NOTHING;

-- INV-SOLIS-10KW-3P
INSERT INTO product_specifications (
    product_id, category_code, rated_ac_power_w, max_dc_power_w, max_dc_voltage_v,
    mppt_voltage_min_v, mppt_voltage_max_v, mppt_trackers, inputs_per_mppt,
    max_input_current_per_mppt_a, max_short_circuit_current_a, phase, nominal_ac_voltage_v, max_ac_current_a, max_efficiency_pct, attributes
)
SELECT 
    id, 'INVERTER', 10000.00, 14000.00, 1100.00,
    160.00, 1000.00, 2, 1,
    16.00, 24.00, 'THREE', 415.00, 15.20, 98.50,
    '{"weight_kg": 17.5, "protection_rating": "IP65", "communication": "WiFi / RS485"}'::jsonb
FROM products WHERE sku = 'INV-SOLIS-10KW-3P'
ON CONFLICT (product_id) DO NOTHING;

-- 3. Insert Product Prices
INSERT INTO product_prices (product_id, unit_cost, currency, supplier_name, notes)
SELECT id, standard_cost, 'INR', 'SunPower Distribution', 'Seeded alternative brand'
FROM products
WHERE sku IN ('PNL-ADANI-545W', 'PNL-TATA-540W', 'INV-SOLIS-5KW-1P', 'INV-SOLIS-10KW-3P')
ON CONFLICT DO NOTHING;
