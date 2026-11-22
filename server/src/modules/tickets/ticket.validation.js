import { z } from 'zod';

export const listTicketsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  customer_id: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  category: z.enum(['INVERTER_FAULT', 'LOW_GENERATION', 'PHYSICAL_DAMAGE', 'GRID_TRIP', 'ROUTINE_AMC', 'WIRING_ISSUE', 'OTHER']).optional(),
  assigned_technician_id: z.string().uuid().optional(),
  search: z.string().optional()
});

export const createTicketSchema = z.object({
  customer_id: z.string().uuid({ message: 'Valid customer ID is required' }),
  sales_order_id: z.string().uuid().optional(),
  installation_job_id: z.string().uuid().optional(),
  serial_number_id: z.string().uuid().optional(),
  serial_number: z.string().optional(),
  warranty_id: z.string().uuid().optional(),
  category: z.enum([
    'INVERTER_FAULT', 'LOW_GENERATION', 'PHYSICAL_DAMAGE',
    'GRID_TRIP', 'ROUTINE_AMC', 'WIRING_ISSUE', 'OTHER'
  ]).default('INVERTER_FAULT'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  source: z.enum(['WEB', 'WHATSAPP', 'PHONE', 'FIELD_INSPECTION']).default('WEB'),
  reported_issue: z.string().min(5, { message: 'Reported issue description must be at least 5 characters' }),
  diagnostic_notes: z.string().optional()
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED', 'CANCELLED']),
  notes: z.string().optional(),
  resolution_notes: z.string().optional()
});

export const assignTechnicianSchema = z.object({
  technician_id: z.string().uuid({ message: 'Valid technician user ID is required' }),
  notes: z.string().optional()
});

export const addActivityNoteSchema = z.object({
  activity_type: z.enum(['NOTE', 'DIAGNOSTIC']).default('NOTE'),
  notes: z.string().min(1, { message: 'Note text cannot be empty' })
});

export const executeRmaSwapSchema = z.object({
  defective_serial_id: z.string().uuid().optional(),
  defective_serial_number: z.string().optional(),
  replacement_serial_id: z.string().uuid().optional(),
  replacement_serial_number: z.string().optional(),
  reason: z.string().min(3, { message: 'Failure reason is required' }),
  transfer_warranty: z.boolean().default(true),
  notes: z.string().optional()
}).refine((data) => {
  return (data.defective_serial_id || data.defective_serial_number) &&
         (data.replacement_serial_id || data.replacement_serial_number);
}, {
  message: 'Both defective hardware and replacement hardware serial identifiers are required'
});
