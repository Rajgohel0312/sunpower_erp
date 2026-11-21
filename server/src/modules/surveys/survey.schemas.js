/**
 * Zod Validation Schemas for Rooftop Site Surveys & Engineering BOM
 */

import { z } from 'zod';

export const roofTypeEnum = z.enum([
  'RCC_FLAT',
  'METAL_SHEET',
  'TILED_ROOF',
  'GROUND_MOUNT',
  'OTHER'
]);

export const supplyPhaseEnum = z.enum(['SINGLE', 'THREE']);

export const structureTypeEnum = z.enum([
  'STANDARD_GI',
  'ELEVATED_SUPER_STRUCTURE',
  'BALLASTED',
  'FLUSH_MOUNT'
]);

export const surveyStatusEnum = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REVISION_REQUIRED',
  'CANCELLED'
]);

export const photoCategoryEnum = z.enum([
  'ROOF_PANORAMA',
  'SHADOW_OBSTRUCTION',
  'METER_BOX',
  'DISTRIBUTION_PANEL',
  'EARTHING_SITE',
  'CABLE_PATH',
  'GENERAL'
]);

// 1. Schedule Survey
export const scheduleSurveySchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  assigned_engineer_id: z.string().uuid('assigned_engineer_id must be a valid user UUID'),
  scheduled_at: z.string().datetime({ message: 'scheduled_at must be an ISO 8601 timestamp' }),
  notes: z.string().trim().max(1000).optional()
}).refine(data => data.lead_id || data.customer_id, {
  message: 'Survey must be linked to either a lead_id or customer_id',
  path: ['lead_id']
});

// 2. Update Survey Rooftop Feasibility Specs
export const updateSurveySpecsSchema = z.object({
  roof_type: roofTypeEnum.optional(),
  shadow_free_area_sqft: z.coerce.number().min(0).optional(),
  proposed_capacity_kw: z.coerce.number().positive().max(500).optional(),
  sanctioned_load_kw: z.coerce.number().positive().max(1000).optional(),
  supply_phase: supplyPhaseEnum.optional(),
  discom_provider: z.string().trim().max(100).optional(),
  consumer_number: z.string().trim().max(50).optional(),
  distance_roof_to_meter_m: z.coerce.number().min(0).max(500).optional(),
  earthing_pits_needed: z.coerce.number().int().min(1).max(20).default(2),
  structure_type: structureTypeEnum.optional(),
  notes: z.string().trim().max(2000).optional()
});

// 3. Review Survey (Approve / Request Revision)
export const reviewSurveySchema = z.object({
  decision: z.enum(['APPROVED', 'REVISION_REQUIRED']),
  comments: z.string().trim().max(1000).optional()
}).refine(data => {
  if (data.decision === 'REVISION_REQUIRED' && (!data.comments || data.comments.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Review comments are mandatory when requesting survey revision.',
  path: ['comments']
});

// 4. Survey Photo Upload
export const addSurveyPhotoSchema = z.object({
  photo_category: photoCategoryEnum.default('ROOF_PANORAMA'),
  file_url: z.string().url('file_url must be a valid URL'),
  caption: z.string().trim().max(255).optional(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable()
});

// 5. Query Filters
export const listSurveysQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: surveyStatusEnum.optional(),
  assigned_engineer_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  search: z.string().trim().optional()
});

// 6. Generate BOM Schema
export const generateBomSchema = z.object({
  panel_product_id: z.string().uuid().optional(),
  inverter_product_id: z.string().uuid().optional(),
  structure_product_id: z.string().uuid().optional(),
  dc_cable_meters: z.coerce.number().min(0).max(1000).optional(),
  ac_cable_meters: z.coerce.number().min(0).max(1000).optional()
});
