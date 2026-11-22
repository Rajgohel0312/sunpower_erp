import { prisma, withTransaction } from '../../database/prisma.js';

/**
 * Sequential Invoice Number Generator (INV-YYYY-XXXXX)
 */
export async function generateInvoiceNumber(tx = prisma) {
  const currentYear = new Date().getFullYear();
  try {
    const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('invoice_number_seq') AS seq`);
    const seqNum = String(seqRes[0].seq).padStart(5, '0');
    return `INV-${currentYear}-${seqNum}`;
  } catch (err) {
    const count = await tx.invoices.count();
    return `INV-${currentYear}-${String(count + 1).padStart(5, '0')}`;
  }
}

/**
 * Sequential Payment Number Generator (PAY-YYYY-XXXXX)
 */
export async function generatePaymentNumber(tx = prisma) {
  const currentYear = new Date().getFullYear();
  try {
    const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('payment_number_seq') AS seq`);
    const seqNum = String(seqRes[0].seq).padStart(5, '0');
    return `PAY-${currentYear}-${seqNum}`;
  } catch (err) {
    const count = await tx.payments.count();
    return `PAY-${currentYear}-${String(count + 1).padStart(5, '0')}`;
  }
}

/**
 * Sequential Expense Number Generator (EXP-YYYY-XXXXX)
 */
export async function generateExpenseNumber(tx = prisma) {
  const currentYear = new Date().getFullYear();
  try {
    const seqRes = await tx.$queryRawUnsafe(`SELECT nextval('expense_number_seq') AS seq`);
    const seqNum = String(seqRes[0].seq).padStart(5, '0');
    return `EXP-${currentYear}-${seqNum}`;
  } catch (err) {
    const count = await tx.project_expenses.count();
    return `EXP-${currentYear}-${String(count + 1).padStart(5, '0')}`;
  }
}

/**
 * Creates Invoice and nested Invoice Items in a transaction
 */
export async function createInvoiceRecord(invoiceData, itemsData = [], tx = prisma) {
  return await tx.invoices.create({
    data: {
      ...invoiceData,
      invoice_items: itemsData.length > 0 ? {
        create: itemsData
      } : undefined
    },
    include: {
      invoice_items: true,
      customers: {
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true,
          email: true,
          gstin: true
        }
      },
      sales_orders: {
        select: {
          id: true,
          order_number: true,
          total_amount: true,
          net_customer_payable: true,
          payment_status: true,
          status: true
        }
      }
    }
  });
}

/**
 * Lists Invoices with search, filtering, and pagination
 */
export async function listInvoices({ page = 1, limit = 10, search, status, customer_id, sales_order_id, milestone_type }) {
  const skip = (page - 1) * limit;
  const where = { deleted_at: null };

  if (status) where.status = status;
  if (customer_id) where.customer_id = customer_id;
  if (sales_order_id) where.sales_order_id = sales_order_id;
  if (milestone_type) where.milestone_type = milestone_type;

  if (search) {
    where.OR = [
      { invoice_number: { contains: search, mode: 'insensitive' } },
      { customers: { full_name: { contains: search, mode: 'insensitive' } } },
      { sales_orders: { order_number: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoices.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        customers: {
          select: {
            id: true,
            customer_code: true,
            full_name: true,
            phone_e164: true,
            email: true,
            gstin: true
          }
        },
        sales_orders: {
          select: {
            id: true,
            order_number: true,
            total_amount: true,
            net_customer_payable: true
          }
        },
        payment_allocations: {
          select: {
            id: true,
            allocated_amount: true,
            allocated_at: true,
            payments: {
              select: {
                id: true,
                payment_number: true,
                payment_mode: true,
                transaction_reference: true
              }
            }
          }
        }
      }
    }),
    prisma.invoices.count({ where })
  ]);

  return {
    invoices,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Gets Invoice by ID with detailed items and allocations
 */
export async function getInvoiceById(id, tx = prisma) {
  return await tx.invoices.findUnique({
    where: { id },
    include: {
      invoice_items: {
        include: {
          products: {
            select: {
              id: true,
              sku: true,
              model_name: true,
              brand: true
            }
          }
        }
      },
      customers: {
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true,
          email: true,
          gstin: true
        }
      },
      sales_orders: {
        select: {
          id: true,
          order_number: true,
          total_amount: true,
          net_customer_payable: true,
          payment_status: true,
          status: true,
          snapshot_data: true
        }
      },
      payment_allocations: {
        include: {
          payments: {
            select: {
              id: true,
              payment_number: true,
              payment_mode: true,
              transaction_reference: true,
              payment_date: true
            }
          }
        }
      }
    }
  });
}

/**
 * Updates Invoice Status
 */
export async function updateInvoiceStatus(id, status, tx = prisma) {
  return await tx.invoices.update({
    where: { id },
    data: {
      status,
      updated_at: new Date()
    }
  });
}

/**
 * Finds payment by idempotency key
 */
export async function findPaymentByIdempotencyKey(idempotencyKey, tx = prisma) {
  if (!idempotencyKey) return null;
  return await tx.payments.findUnique({
    where: { idempotency_key: idempotencyKey }
  });
}

/**
 * Creates Payment Record
 */
export async function createPaymentRecord(paymentData, tx = prisma) {
  return await tx.payments.create({
    data: paymentData,
    include: {
      customers: {
        select: {
          id: true,
          customer_code: true,
          full_name: true,
          phone_e164: true
        }
      },
      sales_orders: {
        select: {
          id: true,
          order_number: true,
          total_amount: true,
          net_customer_payable: true
        }
      }
    }
  });
}

/**
 * Lists Payments with filtering and pagination
 */
export async function listPayments({ page = 1, limit = 10, search, status, customer_id, sales_order_id, payment_mode }) {
  const skip = (page - 1) * limit;
  const where = {};

  if (status) where.status = status;
  if (customer_id) where.customer_id = customer_id;
  if (sales_order_id) where.sales_order_id = sales_order_id;
  if (payment_mode) where.payment_mode = payment_mode;

  if (search) {
    where.OR = [
      { payment_number: { contains: search, mode: 'insensitive' } },
      { transaction_reference: { contains: search, mode: 'insensitive' } },
      { customers: { full_name: { contains: search, mode: 'insensitive' } } },
      { sales_orders: { order_number: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const [payments, total] = await Promise.all([
    prisma.payments.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        customers: {
          select: {
            id: true,
            customer_code: true,
            full_name: true,
            phone_e164: true
          }
        },
        sales_orders: {
          select: {
            id: true,
            order_number: true
          }
        },
        payment_allocations: {
          include: {
            invoices: {
              select: {
                id: true,
                invoice_number: true,
                grand_total: true,
                amount_paid: true,
                amount_due: true,
                status: true
              }
            }
          }
        }
      }
    }),
    prisma.payments.count({ where })
  ]);

  return {
    payments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Gets Payment by ID with allocations
 */
export async function getPaymentById(id, tx = prisma) {
  return await tx.payments.findUnique({
    where: { id },
    include: {
      customers: true,
      sales_orders: true,
      payment_allocations: {
        include: {
          invoices: true
        }
      }
    }
  });
}

/**
 * Creates payment allocation and adjusts balances
 */
export async function createPaymentAllocationRecord(allocationData, tx = prisma) {
  return await tx.payment_allocations.create({
    data: allocationData
  });
}

/**
 * Updates payment unallocated amount
 */
export async function updatePaymentUnallocatedAmount(paymentId, newUnallocated, tx = prisma) {
  return await tx.payments.update({
    where: { id: paymentId },
    data: {
      unallocated_amount: newUnallocated,
      updated_at: new Date()
    }
  });
}

/**
 * Updates invoice amounts (amount_paid, amount_due, status)
 */
export async function updateInvoiceAmounts(invoiceId, amountPaid, amountDue, status, tx = prisma) {
  return await tx.invoices.update({
    where: { id: invoiceId },
    data: {
      amount_paid: amountPaid,
      amount_due: amountDue,
      status,
      updated_at: new Date()
    }
  });
}

/**
 * Creates Project Expense
 */
export async function createExpenseRecord(expenseData, tx = prisma) {
  return await tx.project_expenses.create({
    data: expenseData,
    include: {
      sales_orders: {
        select: {
          id: true,
          order_number: true
        }
      }
    }
  });
}

/**
 * Lists Direct Project Expenses
 */
export async function listExpenses({ page = 1, limit = 10, sales_order_id, category, status }) {
  const skip = (page - 1) * limit;
  const where = {};

  if (sales_order_id) where.sales_order_id = sales_order_id;
  if (category) where.category = category;
  if (status) where.status = status;

  const [expenses, total] = await Promise.all([
    prisma.project_expenses.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        sales_orders: {
          select: {
            id: true,
            order_number: true
          }
        }
      }
    }),
    prisma.project_expenses.count({ where })
  ]);

  return {
    expenses,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Updates Project Expense Status
 */
export async function updateExpenseStatus(id, status, approvedBy, tx = prisma) {
  return await tx.project_expenses.update({
    where: { id },
    data: {
      status,
      approved_by: approvedBy,
      updated_at: new Date()
    }
  });
}

/**
 * Gets Accounts Receivable Aging Buckets
 */
export async function getAccountsReceivableSummary() {
  const openInvoices = await prisma.invoices.findMany({
    where: {
      deleted_at: null,
      status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
      amount_due: { gt: 0 }
    },
    select: {
      id: true,
      invoice_number: true,
      invoice_date: true,
      due_date: true,
      grand_total: true,
      amount_paid: true,
      amount_due: true,
      customer_id: true,
      customers: {
        select: { full_name: true, phone_e164: true }
      }
    }
  });

  const now = new Date();
  const summary = {
    total_receivables: 0,
    current_0_30: 0,
    overdue_31_60: 0,
    overdue_61_90: 0,
    overdue_90_plus: 0,
    count: openInvoices.length,
    invoices: []
  };

  for (const inv of openInvoices) {
    const due = Number(inv.amount_due);
    summary.total_receivables += due;

    const dueDate = new Date(inv.due_date);
    const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let bucket = 'CURRENT';
    if (diffDays <= 0 || diffDays <= 30) {
      summary.current_0_30 += due;
      bucket = '0_30';
    } else if (diffDays <= 60) {
      summary.overdue_31_60 += due;
      bucket = '31_60';
    } else if (diffDays <= 90) {
      summary.overdue_61_90 += due;
      bucket = '61_90';
    } else {
      summary.overdue_90_plus += due;
      bucket = '90_PLUS';
    }

    summary.invoices.push({
      ...inv,
      days_overdue: Math.max(0, diffDays),
      bucket
    });
  }

  summary.total_receivables = Number(summary.total_receivables.toFixed(2));
  summary.current_0_30 = Number(summary.current_0_30.toFixed(2));
  summary.overdue_31_60 = Number(summary.overdue_31_60.toFixed(2));
  summary.overdue_61_90 = Number(summary.overdue_61_90.toFixed(2));
  summary.overdue_90_plus = Number(summary.overdue_90_plus.toFixed(2));

  return summary;
}
