-- SunPower ERP: 009_search_indexing_and_trgm.sql
-- Database Indexing: pg_trgm Extension, GIN Trigram Search Indexes, and Composite B-Tree Indexes

-- 1. Enable pg_trgm extension for substring, prefix, and fuzzy pattern matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN Trigram Search Indexes for Leads (sub-millisecond ILIKE '%query%' execution)
CREATE INDEX IF NOT EXISTS idx_leads_full_name_trgm ON leads USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone_e164 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_lead_number_trgm ON leads USING gin (lead_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_site_address_trgm ON leads USING gin (site_address gin_trgm_ops);

-- 3. GIN Trigram Search Indexes for Customers
CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm ON customers USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone_e164 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_code_trgm ON customers USING gin (customer_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_gstin_trgm ON customers USING gin (gstin gin_trgm_ops);

-- 4. GIN Trigram Search Indexes for Surveys
CREATE INDEX IF NOT EXISTS idx_surveys_survey_number_trgm ON surveys USING gin (survey_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_surveys_consumer_number_trgm ON surveys USING gin (consumer_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_surveys_discom_trgm ON surveys USING gin (discom_provider gin_trgm_ops);

-- 5. GIN Trigram Search Indexes for Products & Inventory Catalog
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_model_name_trgm ON products USING gin (model_name gin_trgm_ops);

-- 6. Composite B-Tree Indexes for High-Velocity Filter + Sort Queries
CREATE INDEX IF NOT EXISTS idx_leads_stage_created ON leads (stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_status_scheduled ON surveys (status, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_type_created ON customers (customer_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_boms_status_created ON project_boms (status, created_at DESC);
