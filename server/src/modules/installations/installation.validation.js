import { z } from 'zod';

export const createInstallationJobSchema = z.object({
  sales_order_id: z.string().uuid({ message: 'Valid Sales Order ID is required' }),
  dispatch_id: z.string().uuid().optional(),
  team_lead_id: z.string().uuid().optional(),
  scheduled_start: z.string({ message: 'Scheduled start date/time is required' })
    .refine((val) => {
      const scheduledDate = new Date(val);
      // Allow up to 5 minutes grace window for clock drift / request transit
      return !isNaN(scheduledDate.getTime()) && scheduledDate.getTime() >= Date.now() - 5 * 60 * 1000;
    }, {
      message: 'Scheduled start date and time cannot be in the past. Please select today or a future date/time.'
    }),
  scheduled_end: z.string().optional(),
  technicians: z.array(
    z.object({
      technician_id: z.string().uuid({ message: 'Valid technician user ID is required' }),
      role_in_team: z.enum(['TEAM_LEAD', 'FITTER', 'ELECTRICIAN', 'HELPER']).default('ELECTRICIAN')
    })
  ).optional().default([])
}).refine((data) => {
  if (data.scheduled_end && data.scheduled_start) {
    return new Date(data.scheduled_end).getTime() >= new Date(data.scheduled_start).getTime();
  }
  return true;
}, {
  message: 'Target completion date/time must be after or equal to the scheduled start date/time',
  path: ['scheduled_end']
});

export const updateJobStatusSchema = z.object({
  status: z.enum([
    'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'STRUCTURE_COMPLETE',
    'PANELS_MOUNTED', 'WIRING_COMPLETE', 'TESTING_IN_PROGRESS',
    'COMMISSIONED', 'BLOCKED', 'CANCELLED'
  ], {
    errorMap: () => ({ message: 'Invalid installation job status' })
  }),
  blocked_reason: z.string().optional(),
  completion_notes: z.string().optional()
});

export const updateChecklistStepSchema = z.object({
  is_completed: z.boolean(),
  measured_value: z.string().optional(),
  remarks: z.string().optional()
});

export const uploadInstallationPhotoSchema = z.object({
  photo_category: z.enum([
    'STRUCTURE', 'PANELS_ARRAY', 'INVERTER_MOUNT', 'DCDB_ACDB',
    'EARTHING_CHAMBER', 'LIGHTNING_ARRESTER', 'NET_METER', 'SIGN_OFF_EVIDENCE'
  ]),
  file_url: z.string().min(5, { message: 'Valid photo URL or storage path is required' }),
  caption: z.string().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional()
});

export const submitSignoffSchema = z.object({
  customer_name: z.string().min(2, { message: 'Customer name is required' }),
  customer_phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, { message: 'Valid customer phone is required' }),
  customer_signature_svg: z.string().min(10, { message: 'Customer digital signature is required' }),
  customer_rating: z.number().int().min(1).max(5).default(5),
  customer_feedback: z.string().optional(),
  is_net_meter_installed: z.boolean().default(false),
  discom_consumer_number: z.string().optional(),
  tested_peak_power_kw: z.number().positive().optional()
});

export const listInstallationJobsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: z.string().optional(),
  team_lead_id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().optional()
});
