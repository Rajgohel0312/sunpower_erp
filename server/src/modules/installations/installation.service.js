import { withTransaction } from '../../database/index.js';
import { AppError } from '../../utils/response.js';
import * as installationRepo from './installation.repository.js';
import { prisma } from '../../database/index.js';

const STANDARD_SOLAR_CHECKLIST = [
  {
    step_key: 'ROOF_STRUCTURE_ANCHORING',
    step_name: 'Structure anchoring, chemical fastener curing & torque test',
    category: 'STRUCTURAL',
    is_mandatory: true
  },
  {
    step_key: 'MODULE_CLAMP_TORQUE_CHECK',
    step_name: 'PV module mid & end clamp alignment and torque tightness',
    category: 'STRUCTURAL',
    is_mandatory: true
  },
  {
    step_key: 'DC_POLARITY_CHECK',
    step_name: 'DC string open circuit voltage (Voc) & string polarity test',
    category: 'ELECTRICAL',
    is_mandatory: true
  },
  {
    step_key: 'EARTHING_RESISTANCE_TEST',
    step_name: 'Dual chemical earthing pit resistance measurement (< 5.0 Ohms)',
    category: 'SAFETY',
    is_mandatory: true
  },
  {
    step_key: 'LIGHTNING_ARRESTER_CHECK',
    step_name: 'ESE Lightning arrester installation & down conductor continuity',
    category: 'SAFETY',
    is_mandatory: true
  },
  {
    step_key: 'AC_VOLTAGE_PHASE_SYNC',
    step_name: 'Grid voltage, frequency & phase sequence sync check (415V/230V)',
    category: 'ELECTRICAL',
    is_mandatory: true
  },
  {
    step_key: 'INVERTER_ONLINE_APP_SYNC',
    step_name: 'Inverter Wi-Fi datalogger configuration & cloud telemetry sync',
    category: 'COMMISSIONING',
    is_mandatory: true
  },
  {
    step_key: 'NET_METERING_TEST',
    step_name: 'Bi-directional net meter generation test & export verification',
    category: 'COMMISSIONING',
    is_mandatory: true
  }
];

export async function listInstallationJobs(query) {
  return installationRepo.listInstallationJobs(query);
}

export async function getInstallationJob(id) {
  const job = await installationRepo.getInstallationJobById(id);
  if (!job) {
    throw new AppError('Installation job not found', 404, 'JOB_NOT_FOUND');
  }
  return job;
}

export async function createInstallationJob(input, actor) {
  return withTransaction(async (trx) => {
    // 1. Verify Sales Order exists
    const order = await trx.sales_orders.findUnique({
      where: { id: input.sales_order_id },
      include: {
        customers: { select: { id: true, full_name: true } }
      }
    });

    if (!order) {
      throw new AppError('Sales order not found for installation scheduling', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === 'CANCELLED') {
      throw new AppError('Cannot schedule installation for a cancelled sales order', 400, 'ORDER_CANCELLED');
    }

    // 2. Generate job number
    const jobNumber = await installationRepo.generateJobNumber(trx);

    // 3. Create job record
    const job = await installationRepo.createJobRecord(
      {
        job_number: jobNumber,
        sales_order_id: input.sales_order_id,
        dispatch_id: input.dispatch_id,
        team_lead_id: input.team_lead_id,
        scheduled_start: input.scheduled_start,
        scheduled_end: input.scheduled_end,
        created_by: actor?.id
      },
      trx
    );

    // 4. Assign technicians if provided
    if (input.technicians && input.technicians.length > 0) {
      const techData = input.technicians.map((t) => ({
        installation_job_id: job.id,
        technician_id: t.technician_id,
        role_in_team: t.role_in_team || 'ELECTRICIAN'
      }));
      await installationRepo.assignTechnicians(techData, trx);
    }

    // 5. Initialize the 8 mandatory solar installation checklist steps
    const checklistData = STANDARD_SOLAR_CHECKLIST.map((step) => ({
      installation_job_id: job.id,
      step_key: step.step_key,
      step_name: step.step_name,
      category: step.category,
      is_mandatory: step.is_mandatory,
      is_completed: false
    }));
    await installationRepo.initializeChecklist(checklistData, trx);

    // 6. Update sales order status to INSTALLATION_IN_PROGRESS if not already
    if (order.status !== 'INSTALLATION_IN_PROGRESS' && order.status !== 'COMMISSIONED') {
      await trx.sales_orders.update({
        where: { id: input.sales_order_id },
        data: {
          status: 'INSTALLATION_IN_PROGRESS',
          updated_at: new Date()
        }
      });
    }

    return installationRepo.getInstallationJobById(job.id, trx);
  });
}

export async function updateJobStatus(id, input, actor) {
  const existing = await installationRepo.getInstallationJobById(id);
  if (!existing) {
    throw new AppError('Installation job not found', 404, 'JOB_NOT_FOUND');
  }

  const updateData = {
    status: input.status,
    blocked_reason: input.blocked_reason || null,
    completion_notes: input.completion_notes || existing.completion_notes
  };

  if (input.status === 'ON_SITE' && !existing.actual_start) {
    updateData.actual_start = new Date();
  }

  if (input.status === 'COMMISSIONED') {
    // Check if mandatory checklist items are complete
    const incompleteMandatory = existing.installation_checklists.filter(
      (c) => c.is_mandatory && !c.is_completed
    );
    if (incompleteMandatory.length > 0) {
      throw new AppError(
        `Cannot commission job: ${incompleteMandatory.length} mandatory checklist steps are incomplete (${incompleteMandatory.map((s) => s.step_name).join('; ')})`,
        400,
        'MANDATORY_CHECKLIST_INCOMPLETE'
      );
    }
    updateData.actual_completion = new Date();
  }

  return installationRepo.updateJobStatus(id, updateData);
}

export async function updateChecklistStep(jobId, stepKey, input, actor) {
  const job = await installationRepo.getInstallationJobById(jobId);
  if (!job) {
    throw new AppError('Installation job not found', 404, 'JOB_NOT_FOUND');
  }

  await installationRepo.updateChecklistStep(jobId, stepKey, {
    is_completed: input.is_completed,
    measured_value: input.measured_value || null,
    remarks: input.remarks || null,
    completed_by: actor?.id
  });

  return installationRepo.getInstallationJobById(jobId);
}

export async function uploadInstallationPhoto(jobId, input, actor) {
  const job = await installationRepo.getInstallationJobById(jobId);
  if (!job) {
    throw new AppError('Installation job not found', 404, 'JOB_NOT_FOUND');
  }

  return installationRepo.createInstallationPhoto({
    installation_job_id: jobId,
    photo_category: input.photo_category,
    file_url: input.file_url,
    caption: input.caption || null,
    gps_lat: input.gps_lat || null,
    gps_lng: input.gps_lng || null,
    uploaded_by: actor?.id
  });
}

export async function submitCustomerSignoff(jobId, input, actor) {
  return withTransaction(async (trx) => {
    const job = await trx.installation_jobs.findUnique({
      where: { id: jobId },
      include: {
        sales_orders: true,
        installation_checklists: true,
        installation_signoffs: true
      }
    });

    if (!job) {
      throw new AppError('Installation job not found', 404, 'JOB_NOT_FOUND');
    }

    if (job.installation_signoffs && job.installation_signoffs.length > 0) {
      throw new AppError('This installation job already has a customer commissioning sign-off', 400, 'ALREADY_SIGNED_OFF');
    }

    // Verify mandatory checklist steps
    const incompleteMandatory = job.installation_checklists.filter((c) => c.is_mandatory && !c.is_completed);
    if (incompleteMandatory.length > 0) {
      throw new AppError(
        `Cannot complete commissioning: ${incompleteMandatory.length} mandatory checklist steps are incomplete.`,
        400,
        'MANDATORY_CHECKLIST_INCOMPLETE'
      );
    }

    // 1. Generate Commissioning Certificate Number
    const certNumber = await installationRepo.generateCertificateNumber(trx);

    // 2. Create sign-off record
    const signoff = await trx.installation_signoffs.create({
      data: {
        installation_job_id: jobId,
        certificate_number: certNumber,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_signature_svg: input.customer_signature_svg,
        customer_rating: input.customer_rating || 5,
        customer_feedback: input.customer_feedback || null,
        is_net_meter_installed: input.is_net_meter_installed || false,
        discom_consumer_number: input.discom_consumer_number || null,
        tested_peak_power_kw: input.tested_peak_power_kw || job.sales_orders?.system_capacity_kw
      }
    });

    // 3. Update Job status to COMMISSIONED
    await trx.installation_jobs.update({
      where: { id: jobId },
      data: {
        status: 'COMMISSIONED',
        actual_completion: new Date(),
        updated_at: new Date()
      }
    });

    // 4. Update Sales Order status to COMMISSIONED
    await trx.sales_orders.update({
      where: { id: job.sales_order_id },
      data: {
        status: 'COMMISSIONED',
        updated_at: new Date()
      }
    });

    // 5. Advance linked serial numbers to INSTALLED
    // Find all serials allocated via dispatches for this order
    const dispatches = await trx.dispatches.findMany({
      where: { sales_order_id: job.sales_order_id },
      include: { dispatch_serials: true }
    });

    const serialIds = [];
    for (const d of dispatches) {
      for (const ds of d.dispatch_serials) {
        serialIds.push(ds.serial_number_id);
      }
    }

    if (serialIds.length > 0) {
      await trx.serial_numbers.updateMany({
        where: { id: { in: serialIds } },
        data: {
          status: 'INSTALLED',
          updated_at: new Date()
        }
      });

      // Record serial movement to INSTALLED
      const movements = serialIds.map((sId) => ({
        serial_id: sId,
        from_status: 'DISPATCHED',
        to_status: 'INSTALLED',
        reference_type: 'INSTALLATION',
        reference_id: jobId,
        actor_id: actor?.id,
        notes: `Installed and commissioned under Certificate ${certNumber}`
      }));

      await trx.serial_movements.createMany({
        data: movements
      });
    }

    return installationRepo.getInstallationJobById(jobId, trx);
  });
}
