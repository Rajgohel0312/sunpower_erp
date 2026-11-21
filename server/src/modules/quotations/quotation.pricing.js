/**
 * SunPower ERP — Quotation Pricing, Indian Solar Tax & PM Surya Ghar Subsidy Engine
 * All calculations use 2-decimal rounded monetary units (paise/cents safety).
 */

/**
 * Standard Indian Rooftop Solar PM Surya Ghar Central Subsidy Calculator
 * @param {number} capacityKw - Rated solar system capacity in kW
 * @param {string} customerType - 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL'
 * @returns {number} Subsidy amount in INR
 */
export function calculatePmSuryaGharSubsidy(capacityKw, customerType = 'RESIDENTIAL') {
  if (customerType !== 'RESIDENTIAL') {
    return 0.00;
  }

  const cap = Number(capacityKw) || 0;
  if (cap <= 0) return 0.00;

  if (cap <= 1.0) {
    return 30000.00;
  } else if (cap <= 2.0) {
    return 60000.00;
  } else {
    // 3 kW and above capped at ₹78,000 under PM Surya Ghar Muft Bijli Yojana
    return 78000.00;
  }
}

/**
 * Calculates Indian Solar GST Split (70% Goods @ 12%, 30% Services @ 18%)
 * Effective composite rate = 13.80%
 * @param {number} taxableAmount - Pre-tax contract value in INR
 * @returns {object} Split tax details
 */
export function calculateSolarGstSplit(taxableAmount) {
  const taxable = round2(taxableAmount);
  if (taxable <= 0) {
    return {
      taxableGoodsAmount: 0.00,
      taxableServicesAmount: 0.00,
      taxGoodsAmount: 0.00,
      taxServicesAmount: 0.00,
      taxTotal: 0.00,
      effectiveRatePct: 13.80
    };
  }

  const taxableGoodsAmount = round2(taxable * 0.70);
  const taxableServicesAmount = round2(taxable - taxableGoodsAmount); // Ensure exact sum matches taxable

  const taxGoodsAmount = round2(taxableGoodsAmount * 0.12);
  const taxServicesAmount = round2(taxableServicesAmount * 0.18);
  const taxTotal = round2(taxGoodsAmount + taxServicesAmount);

  return {
    taxableGoodsAmount,
    taxableServicesAmount,
    taxGoodsAmount,
    taxServicesAmount,
    taxTotal,
    effectiveRatePct: 13.80
  };
}

/**
 * Generates standard 4-milestone payment schedule for solar EPC
 * @param {number} totalAmount - Total contract payable amount
 * @returns {Array<object>} Payment milestones
 */
export function generateDefaultPaymentMilestones(totalAmount) {
  const total = round2(totalAmount);
  const bookingAmount = round2(total * 0.10);
  const dispatchAmount = round2(total * 0.70);
  const installationAmount = round2(total * 0.15);
  const commissioningAmount = round2(total - (bookingAmount + dispatchAmount + installationAmount));

  return [
    {
      milestone: 'BOOKING',
      name: 'Order Confirmation & Engineering Booking',
      percentage: 10,
      amount: bookingAmount,
      condition: 'Upon formal sales order signing'
    },
    {
      milestone: 'MATERIAL_DISPATCH',
      name: 'Hardware Allocation & Warehouse Dispatch',
      percentage: 70,
      amount: dispatchAmount,
      condition: 'Prior to truck departure from central warehouse'
    },
    {
      milestone: 'INSTALLATION_COMPLETE',
      name: 'Rooftop Mounting & Electrical Inverter Commissioning',
      percentage: 15,
      amount: installationAmount,
      condition: 'Upon mechanical and electrical completion sign-off'
    },
    {
      milestone: 'NET_METERING',
      name: 'DISCOM Bi-directional Net Metering & Inspection',
      percentage: 5,
      amount: commissioningAmount,
      condition: 'Upon DISCOM meter installation and solar grid synchronization'
    }
  ];
}

/**
 * Master Pricing Calculator for Quotation
 * @param {object} params
 * @param {number} params.systemCapacityKw - Capacity in kW
 * @param {Array<object>} params.items - BOM or customized line items
 * @param {number} [params.installationCharges] - Custom installation/labour charges
 * @param {number} [params.transportCharges] - Custom freight/transport charges
 * @param {number} [params.discountAmount=0] - Commercial discount
 * @param {string} [params.customerType='RESIDENTIAL'] - Customer classification
 * @returns {object} Fully calculated commercial structure
 */
export function calculateQuotationPricing({
  systemCapacityKw,
  items = [],
  installationCharges = null,
  transportCharges = null,
  discountAmount = 0,
  customerType = 'RESIDENTIAL'
}) {
  const cap = Number(systemCapacityKw) || 1.0;

  // 1. Calculate hardware line items subtotal
  let hardwareSubtotal = 0;
  const processedItems = items.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = round2(Number(item.unit_price || item.unit_cost) || 0);
    const taxRate = Number(item.tax_rate_pct) || 12.0;
    const itemTotal = round2(qty * unitPrice);
    const itemTax = round2(itemTotal * (taxRate / 100));

    if (!item.is_optional) {
      hardwareSubtotal += itemTotal;
    }

    return {
      product_id: item.product_id || null,
      item_type: item.item_type || 'HARDWARE',
      item_name: item.item_name || item.model_name || `Component ${index + 1}`,
      description: item.description || null,
      quantity: qty,
      unit_code: item.unit_code || 'NOS',
      unit_price: unitPrice,
      tax_rate_pct: taxRate,
      tax_amount: itemTax,
      total_price: itemTotal,
      is_optional: Boolean(item.is_optional),
      sort_order: item.sort_order !== undefined ? item.sort_order : index
    };
  });

  hardwareSubtotal = round2(hardwareSubtotal);

  // 2. Installation charges (default ₹2,500/kW if not specified)
  const finalInstallationCharges = installationCharges !== null && installationCharges !== undefined
    ? round2(Number(installationCharges))
    : round2(cap * 2500);

  // 3. Transport charges (default ₹2,000 flat if not specified)
  const finalTransportCharges = transportCharges !== null && transportCharges !== undefined
    ? round2(Number(transportCharges))
    : 2000.00;

  // 4. Pre-discount Subtotal
  const subtotal = round2(hardwareSubtotal + finalInstallationCharges + finalTransportCharges);

  // 5. Discount
  const safeDiscount = Math.min(subtotal, Math.max(0, round2(Number(discountAmount) || 0)));

  // 6. Taxable Amount
  const taxableAmount = round2(subtotal - safeDiscount);

  // 7. Taxes (Indian Solar GST 70:30 Split)
  const taxSplit = calculateSolarGstSplit(taxableAmount);

  // 8. Grand Total (Gross Customer Proposal)
  const grandTotal = round2(taxableAmount + taxSplit.taxTotal);

  // 9. Central / State Subsidy
  const subsidyAmount = calculatePmSuryaGharSubsidy(cap, customerType);

  // 10. Net Payable by Customer
  const netPayable = round2(Math.max(0, grandTotal - subsidyAmount));

  // 11. Payment milestones
  const paymentMilestones = generateDefaultPaymentMilestones(grandTotal);

  return {
    system_capacity_kw: cap,
    hardware_subtotal: hardwareSubtotal,
    installation_charges: finalInstallationCharges,
    transport_charges: finalTransportCharges,
    subtotal,
    discount_amount: safeDiscount,
    taxable_amount: taxableAmount,
    tax_goods_amount: taxSplit.taxGoodsAmount,
    tax_services_amount: taxSplit.taxServicesAmount,
    tax_total: taxSplit.taxTotal,
    grand_total: grandTotal,
    subsidy_amount: subsidyAmount,
    net_payable: netPayable,
    payment_terms: paymentMilestones,
    items: processedItems
  };
}

/**
 * Rounds a number to exactly 2 decimal places using epsilon math
 */
function round2(val) {
  const num = Number(val);
  if (isNaN(num)) return 0.00;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
