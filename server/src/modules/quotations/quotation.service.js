import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/response.js';
import { calculateQuotationPricing } from './quotation.pricing.js';
import * as quotationRepo from './quotation.repository.js';
import { crmRepository } from '../crm/crm.repository.js';

/**
 * Creates a new commercial quotation from an Engineering BOM
 */
export async function createQuotation(input, actor) {
  // 1. Fetch and validate engineering BOM
  const bom = await prisma.project_boms.findUnique({
    where: { id: input.bom_id },
    include: {
      project_bom_items: {
        include: {
          products: true
        }
      },
      surveys: true,
      leads: true,
      customers: true
    }
  });

  if (!bom) {
    throw new AppError('Associated Engineering BOM does not exist', 404, 'BOM_NOT_FOUND');
  }

  // 2. Resolve Lead and Customer
  const leadId = input.lead_id || bom.lead_id || null;
  const customerId = input.customer_id || bom.customer_id || (bom.leads ? bom.leads.customer_id : null);
  const surveyId = input.survey_id || bom.survey_id || null;

  let customerType = 'RESIDENTIAL';
  if (customerId) {
    const cust = await prisma.customers.findUnique({ where: { id: customerId } });
    if (cust && cust.customer_type) {
      customerType = cust.customer_type;
    }
  }

  // 3. Resolve Items: if not explicitly supplied, convert from BOM line items
  let rawItems = input.items;
  if (!rawItems || rawItems.length === 0) {
    rawItems = bom.project_bom_items.map((bItem, idx) => ({
      product_id: bItem.product_id,
      item_type: 'HARDWARE',
      item_name: bItem.products?.model_name || `Hardware Item ${idx + 1}`,
      description: bItem.products?.brand ? `Brand: ${bItem.products.brand} | SKU: ${bItem.products.sku}` : null,
      quantity: Number(bItem.quantity),
      unit_code: bItem.products?.unit_code || 'NOS',
      unit_price: Number(bItem.unit_cost),
      tax_rate_pct: Number(bItem.products?.tax_rate_pct || 12.00),
      is_optional: false,
      sort_order: idx
    }));
  }

  // 4. Compute exact pricing with Indian Solar GST and PM Surya Ghar subsidy
  const capacityKw = Number(input.system_capacity_kw || bom.system_capacity_kw) || 1.0;
  const pricing = calculateQuotationPricing({
    systemCapacityKw: capacityKw,
    items: rawItems,
    installationCharges: input.installation_charges,
    transportCharges: input.transport_charges,
    discountAmount: input.discount_amount || 0,
    customerType
  });

  // 5. Validity date (default 30 days forward)
  let validUntil = input.valid_until;
  if (!validUntil) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    validUntil = d.toISOString().split('T')[0];
  }

  // 6. Generate human-readable identifier: QT-YYYY-XXXXX
  const quotationNumber = await quotationRepo.generateQuotationNumber();

  // 7. Save quotation record in transaction
  const quotation = await quotationRepo.createQuotationRecord({
    quotation_number: quotationNumber,
    lead_id: leadId,
    customer_id: customerId,
    survey_id: surveyId,
    bom_id: bom.id,
    version: 1,
    system_capacity_kw: capacityKw,
    hardware_subtotal: pricing.hardware_subtotal,
    installation_charges: pricing.installation_charges,
    transport_charges: pricing.transport_charges,
    subtotal: pricing.subtotal,
    discount_amount: pricing.discount_amount,
    taxable_amount: pricing.taxable_amount,
    tax_goods_amount: pricing.tax_goods_amount,
    tax_services_amount: pricing.tax_services_amount,
    tax_total: pricing.tax_total,
    grand_total: pricing.grand_total,
    subsidy_amount: pricing.subsidy_amount,
    net_payable: pricing.net_payable,
    payment_terms: pricing.payment_terms,
    commercial_terms: input.commercial_terms || 'Standard 25-Year Performance Warranty on PV Modules, 5-Year Comprehensive Inverter Warranty.',
    valid_until: validUntil,
    status: 'DRAFT',
    created_by: actor?.id || null
  }, pricing.items);

  // 8. If linked to lead, log activity
  if (leadId) {
    try {
      await crmRepository.createActivity({
        lead_id: leadId,
        actor_id: actor?.id || null,
        activity_type: 'NOTE',
        details: `Draft quotation ${quotationNumber} initialized for ${capacityKw} kW solar system (₹${pricing.net_payable.toLocaleString('en-IN')} net payable).`
      });
    } catch (e) {
      console.warn('Could not log quotation lead activity:', e.message);
    }
  }

  return await quotationRepo.getQuotationById(quotation.id);
}

/**
 * Retrieves quotation by ID
 */
export async function getQuotation(id, actor) {
  const quotation = await quotationRepo.getQuotationById(id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }
  return quotation;
}

/**
 * Updates an editable draft quotation
 */
export async function updateQuotation(id, input, actor) {
  const existing = await quotationRepo.getQuotationById(id);
  if (!existing) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (['SENT', 'ACCEPTED', 'CONVERTED'].includes(existing.status)) {
    throw new AppError(`Cannot modify quotation in ${existing.status} status. Commercial proposal is locked.`, 400, 'QUOTATION_LOCKED');
  }

  // Recalculate pricing
  const items = input.items || existing.quotation_items;
  let customerType = 'RESIDENTIAL';
  if (existing.customers?.customer_type) {
    customerType = existing.customers.customer_type;
  }

  const pricing = calculateQuotationPricing({
    systemCapacityKw: Number(existing.system_capacity_kw),
    items,
    installationCharges: input.installation_charges !== undefined ? input.installation_charges : existing.installation_charges,
    transportCharges: input.transport_charges !== undefined ? input.transport_charges : existing.transport_charges,
    discountAmount: input.discount_amount !== undefined ? input.discount_amount : existing.discount_amount,
    customerType
  });

  const updateData = {
    installation_charges: pricing.installation_charges,
    transport_charges: pricing.transport_charges,
    subtotal: pricing.subtotal,
    discount_amount: pricing.discount_amount,
    taxable_amount: pricing.taxable_amount,
    tax_goods_amount: pricing.tax_goods_amount,
    tax_services_amount: pricing.tax_services_amount,
    tax_total: pricing.tax_total,
    grand_total: pricing.grand_total,
    subsidy_amount: pricing.subsidy_amount,
    net_payable: pricing.net_payable,
    payment_terms: pricing.payment_terms
  };

  if (input.valid_until) updateData.valid_until = new Date(input.valid_until);
  if (input.commercial_terms !== undefined) updateData.commercial_terms = input.commercial_terms;

  await quotationRepo.updateQuotationRecord(id, updateData, pricing.items);
  return await quotationRepo.getQuotationById(id);
}

/**
 * Submits quotation for manager approval
 */
export async function submitForApproval(id, actor) {
  const quotation = await quotationRepo.getQuotationById(id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (quotation.status !== 'DRAFT') {
    throw new AppError(`Cannot submit quotation in status ${quotation.status} for approval`, 400, 'INVALID_STATUS');
  }

  return await quotationRepo.updateQuotationStatus(id, {
    status: 'PENDING_APPROVAL'
  });
}

/**
 * Reviews and Approves/Rejects a commercial quotation (Manager role)
 */
export async function reviewQuotation(id, { decision, comments }, actor) {
  const quotation = await quotationRepo.getQuotationById(id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (quotation.status !== 'PENDING_APPROVAL') {
    throw new AppError(`Quotation must be in PENDING_APPROVAL status to review`, 400, 'INVALID_STATUS');
  }

  if (decision === 'APPROVE') {
    return await quotationRepo.updateQuotationStatus(id, {
      status: 'APPROVED',
      approved_by: actor?.id || null,
      approved_at: new Date()
    });
  } else {
    return await quotationRepo.updateQuotationStatus(id, {
      status: 'REJECTED',
      rejection_reason: comments || 'Rejected by manager'
    });
  }
}

/**
 * Sends quotation proposal to customer and captures immutable snapshot
 */
export async function sendQuotation(id, { channel = 'MANUAL' } = {}, actor) {
  const quotation = await quotationRepo.getQuotationById(id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (!['APPROVED', 'DRAFT'].includes(quotation.status)) {
    throw new AppError(`Quotation must be APPROVED before sending to customer`, 400, 'NOT_APPROVED');
  }

  // Freeze immutable commercial snapshot
  const snapshotData = {
    quotation_number: quotation.quotation_number,
    system_capacity_kw: Number(quotation.system_capacity_kw),
    customer: quotation.customers ? {
      code: quotation.customers.customer_code,
      name: quotation.customers.full_name,
      phone: quotation.customers.phone_e164,
      email: quotation.customers.email
    } : null,
    lead: quotation.leads ? {
      number: quotation.leads.lead_number,
      name: quotation.leads.full_name,
      phone: quotation.leads.phone_e164
    } : null,
    financials: {
      hardware_subtotal: Number(quotation.hardware_subtotal),
      installation_charges: Number(quotation.installation_charges),
      transport_charges: Number(quotation.transport_charges),
      subtotal: Number(quotation.subtotal),
      discount: Number(quotation.discount_amount),
      taxable_amount: Number(quotation.taxable_amount),
      tax_goods_amount: Number(quotation.tax_goods_amount),
      tax_services_amount: Number(quotation.tax_services_amount),
      tax_total: Number(quotation.tax_total),
      grand_total: Number(quotation.grand_total),
      subsidy_amount: Number(quotation.subsidy_amount),
      net_payable: Number(quotation.net_payable)
    },
    payment_terms: quotation.payment_terms,
    commercial_terms: quotation.commercial_terms,
    items: quotation.quotation_items.map((i) => ({
      item_name: i.item_name,
      quantity: Number(i.quantity),
      unit_code: i.unit_code,
      unit_price: Number(i.unit_price),
      tax_rate_pct: Number(i.tax_rate_pct),
      total_price: Number(i.total_price),
      sku: i.products?.sku || null,
      brand: i.products?.brand || null
    })),
    sent_channel: channel,
    sent_at: new Date().toISOString()
  };

  const updated = await quotationRepo.updateQuotationStatus(id, {
    status: 'SENT',
    sent_at: new Date(),
    snapshot_data: snapshotData
  });

  // Advance linked lead stage to QUOTATION_SENT
  if (quotation.lead_id) {
    try {
      await prisma.leads.update({
        where: { id: quotation.lead_id },
        data: {
          stage: 'QUOTATION_SENT',
          updated_at: new Date()
        }
      });

      await crmRepository.createActivity({
        lead_id: quotation.lead_id,
        actor_id: actor?.id || null,
        activity_type: 'STAGE_CHANGE',
        details: `Quotation ${quotation.quotation_number} dispatched to customer via ${channel}. Lead stage transitioned to QUOTATION_SENT.`
      });
    } catch (e) {
      console.warn('Lead stage update failed:', e.message);
    }
  }

  return updated;
}

/**
 * Customer accepts quotation proposal
 */
export async function acceptQuotation(id, { accepted_by_name, notes } = {}, actor) {
  const quotation = await quotationRepo.getQuotationById(id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (!['SENT', 'APPROVED'].includes(quotation.status)) {
    throw new AppError(`Only SENT or APPROVED quotations can be accepted`, 400, 'INVALID_STATUS');
  }

  // Check validity expiry
  const today = new Date().toISOString().split('T')[0];
  const validUntilStr = new Date(quotation.valid_until).toISOString().split('T')[0];
  if (validUntilStr < today) {
    await quotationRepo.updateQuotationStatus(id, { status: 'EXPIRED' });
    throw new AppError('This quotation has expired and cannot be accepted. Please request an updated proposal.', 400, 'QUOTATION_EXPIRED');
  }

  const updated = await quotationRepo.updateQuotationStatus(id, {
    status: 'ACCEPTED',
    accepted_at: new Date()
  });

  if (quotation.lead_id) {
    try {
      await prisma.leads.update({
        where: { id: quotation.lead_id },
        data: {
          stage: 'NEGOTIATION',
          updated_at: new Date()
        }
      });

      await crmRepository.createActivity({
        lead_id: quotation.lead_id,
        actor_id: actor?.id || null,
        activity_type: 'STAGE_CHANGE',
        details: `Customer accepted proposal ${quotation.quotation_number}${accepted_by_name ? ` (signed by ${accepted_by_name})` : ''}. Lead advanced to NEGOTIATION.`
      });
    } catch (e) {
      console.warn('Lead activity update failed:', e.message);
    }
  }

  return updated;
}

/**
 * Customer declines quotation proposal
 */
export async function rejectQuotation(id, { rejection_reason }, actor) {
  const quotation = await quotationRepo.getQuotationById(id);
  if (!quotation) {
    throw new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND');
  }

  if (['ACCEPTED', 'CONVERTED'].includes(quotation.status)) {
    throw new AppError(`Cannot reject quotation in ${quotation.status} status`, 400, 'INVALID_STATUS');
  }

  return await quotationRepo.updateQuotationStatus(id, {
    status: 'REJECTED',
    rejection_reason
  });
}

/**
 * Lists quotations with filters and pagination
 */
export async function listQuotations(query, actor) {
  return await quotationRepo.listQuotations(query);
}
