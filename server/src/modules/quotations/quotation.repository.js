import { prisma } from '../../database/prisma.js';

/**
 * Generates formatted human-readable quotation number: QT-YYYY-XXXXX
 */
export async function generateQuotationNumber() {
  const currentYear = new Date().getFullYear();
  const seqRes = await prisma.$queryRawUnsafe(`SELECT nextval('quotation_number_seq') AS seq`);
  const seqNum = String(seqRes[0].seq).padStart(5, '0');
  return `QT-${currentYear}-${seqNum}`;
}

/**
 * Creates quotation with line items in an atomic database transaction
 */
export async function createQuotationRecord(quotationData, itemsData = []) {
  return await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotations.create({
      data: {
        quotation_number: quotationData.quotation_number,
        lead_id: quotationData.lead_id || null,
        customer_id: quotationData.customer_id || null,
        survey_id: quotationData.survey_id || null,
        bom_id: quotationData.bom_id,
        version: quotationData.version || 1,
        system_capacity_kw: quotationData.system_capacity_kw,
        hardware_subtotal: quotationData.hardware_subtotal,
        installation_charges: quotationData.installation_charges,
        transport_charges: quotationData.transport_charges,
        subtotal: quotationData.subtotal,
        discount_amount: quotationData.discount_amount || 0,
        taxable_amount: quotationData.taxable_amount,
        tax_goods_amount: quotationData.tax_goods_amount,
        tax_services_amount: quotationData.tax_services_amount,
        tax_total: quotationData.tax_total,
        grand_total: quotationData.grand_total,
        subsidy_amount: quotationData.subsidy_amount || 0,
        net_payable: quotationData.net_payable,
        payment_terms: quotationData.payment_terms || [],
        commercial_terms: quotationData.commercial_terms || null,
        valid_until: new Date(quotationData.valid_until),
        status: quotationData.status || 'DRAFT',
        snapshot_data: quotationData.snapshot_data || null,
        created_by: quotationData.created_by || null
      }
    });

    if (itemsData && itemsData.length > 0) {
      const itemsToInsert = itemsData.map((item, idx) => ({
        quotation_id: quotation.id,
        product_id: item.product_id || null,
        item_type: item.item_type || 'HARDWARE',
        item_name: item.item_name,
        description: item.description || null,
        quantity: item.quantity,
        unit_code: item.unit_code || 'NOS',
        unit_price: item.unit_price,
        tax_rate_pct: item.tax_rate_pct || 12.00,
        tax_amount: item.tax_amount || 0.00,
        total_price: item.total_price,
        is_optional: Boolean(item.is_optional),
        sort_order: item.sort_order !== undefined ? item.sort_order : idx
      }));

      await tx.quotation_items.createMany({
        data: itemsToInsert
      });
    }

    return quotation;
  });
}

/**
 * Retrieves quotation by ID with all relations
 */
export async function getQuotationById(id) {
  return await prisma.quotations.findUnique({
    where: { id },
    include: {
      quotation_items: {
        orderBy: { sort_order: 'asc' },
        include: {
          products: {
            select: {
              id: true,
              sku: true,
              brand: true,
              model_name: true,
              category_id: true
            }
          }
        }
      },
      leads: {
        select: {
          id: true,
          lead_number: true,
          full_name: true,
          phone_e164: true,
          email: true,
          stage: true
        }
      },
      customers: {
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true,
          email: true,
          customer_type: true
        }
      },
      surveys: {
        select: {
          id: true,
          survey_number: true,
          status: true,
          roof_type: true,
          structure_type: true
        }
      },
      project_boms: {
        select: {
          id: true,
          bom_number: true,
          system_capacity_kw: true,
          total_cost: true,
          status: true
        }
      },
      users_quotations_created_byTousers: {
        select: {
          id: true,
          full_name: true,
          email: true
        }
      },
      users_quotations_approved_byTousers: {
        select: {
          id: true,
          full_name: true,
          email: true
        }
      }
    }
  });
}

/**
 * Lists quotations with standardized integer sanitization, pagination and search
 */
export async function listQuotations({
  page = 1,
  limit = 10,
  search = '',
  status = 'ALL',
  customer_id,
  lead_id
} = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const whereClause = {
    deleted_at: null
  };

  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  if (customer_id) {
    whereClause.customer_id = customer_id;
  }

  if (lead_id) {
    whereClause.lead_id = lead_id;
  }

  if (search && search.trim()) {
    const s = search.trim();
    whereClause.OR = [
      { quotation_number: { contains: s, mode: 'insensitive' } },
      { leads: { full_name: { contains: s, mode: 'insensitive' } } },
      { leads: { phone_e164: { contains: s, mode: 'insensitive' } } },
      { customers: { full_name: { contains: s, mode: 'insensitive' } } },
      { customers: { customer_code: { contains: s, mode: 'insensitive' } } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.quotations.findMany({
      where: whereClause,
      skip,
      take: safeLimit,
      orderBy: { created_at: 'desc' },
      include: {
        leads: {
          select: {
            id: true,
            lead_number: true,
            full_name: true,
            phone_e164: true
          }
        },
        customers: {
          select: {
            id: true,
            customer_code: true,
            full_name: true,
            phone_e164: true
          }
        },
        project_boms: {
          select: {
            id: true,
            bom_number: true
          }
        },
        _count: {
          select: { quotation_items: true }
        }
      }
    }),
    prisma.quotations.count({ where: whereClause })
  ]);

  return {
    data: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

/**
 * Updates quotation commercial status and logs actor
 */
export async function updateQuotationStatus(id, updateData) {
  return await prisma.quotations.update({
    where: { id },
    data: {
      ...updateData,
      updated_at: new Date()
    }
  });
}

/**
 * Updates quotation calculation fields and replaces line items
 */
export async function updateQuotationRecord(id, quotationData, itemsData) {
  return await prisma.$transaction(async (tx) => {
    const updated = await tx.quotations.update({
      where: { id },
      data: {
        ...quotationData,
        updated_at: new Date()
      }
    });

    if (itemsData && Array.isArray(itemsData)) {
      await tx.quotation_items.deleteMany({
        where: { quotation_id: id }
      });

      const itemsToInsert = itemsData.map((item, idx) => ({
        quotation_id: id,
        product_id: item.product_id || null,
        item_type: item.item_type || 'HARDWARE',
        item_name: item.item_name,
        description: item.description || null,
        quantity: item.quantity,
        unit_code: item.unit_code || 'NOS',
        unit_price: item.unit_price,
        tax_rate_pct: item.tax_rate_pct || 12.00,
        tax_amount: item.tax_amount || 0.00,
        total_price: item.total_price,
        is_optional: Boolean(item.is_optional),
        sort_order: item.sort_order !== undefined ? item.sort_order : idx
      }));

      await tx.quotation_items.createMany({
        data: itemsToInsert
      });
    }

    return updated;
  });
}
