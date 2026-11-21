-- SunPower ERP: 008_allow_rejected_bom_status.sql
-- Allows 'REJECTED' status in project_boms check constraint and adds rejection_reason column

ALTER TABLE project_boms DROP CONSTRAINT IF EXISTS project_boms_status_check;
ALTER TABLE project_boms ADD CONSTRAINT project_boms_status_check CHECK (status IN ('DRAFT', 'APPROVED', 'SUPERSEDED', 'REJECTED'));
ALTER TABLE project_boms ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
