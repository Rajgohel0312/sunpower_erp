import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  DollarSign,
  AlertCircle,
  FileText
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import Badge from '../../components/common/Badge.jsx';

export function PaymentsListPage() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [activePaymentForAlloc, setActivePaymentForAlloc] = useState(null);

  // Record Form
  const [recordCustomerId, setRecordCustomerId] = useState('');
  const [recordOrderId, setRecordOrderId] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMode, setRecordMode] = useState('NEFT');
  const [recordRef, setRecordRef] = useState('');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordNotes, setRecordNotes] = useState('');
  const [autoAllocInvoiceId, setAutoAllocInvoiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Allocation Form
  const [targetInvoiceId, setTargetInvoiceId] = useState('');
  const [allocAmount, setAllocAmount] = useState('');

  useEffect(() => {
    loadPayments();
    loadCustomers();
  }, [page, modeFilter]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (searchTerm) params.append('search', searchTerm);
      if (modeFilter) params.append('payment_mode', modeFilter);

      const res = await apiRequest(`/finance/payments?${params.toString()}`);
      setPayments(res.data || []);
      if (res.meta?.pagination) {
        setTotalPages(res.meta.pagination.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await apiRequest('/customers?limit=100');
      setCustomers(res.data || []);
    } catch (err) {
      console.warn('Could not load customers', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadPayments();
  };

  // Open Allocation Modal
  const openAllocateModal = async (payment) => {
    setActivePaymentForAlloc(payment);
    try {
      const res = await apiRequest(`/finance/invoices?customer_id=${payment.customer_id}&status=ISSUED&limit=50`);
      const partiallyPaidRes = await apiRequest(`/finance/invoices?customer_id=${payment.customer_id}&status=PARTIALLY_PAID&limit=50`);
      const openInvs = [...(res.data || []), ...(partiallyPaidRes.data || [])];
      setInvoices(openInvs);

      if (openInvs.length > 0) {
        setTargetInvoiceId(openInvs[0].id);
        const maxApplicable = Math.min(Number(payment.unallocated_amount), Number(openInvs[0].amount_due));
        setAllocAmount(String(maxApplicable));
      } else {
        setTargetInvoiceId('');
        setAllocAmount('');
      }
      setShowAllocateModal(true);
    } catch (err) {
      alert('Could not fetch open invoices for allocation');
    }
  };

  // Submit Payment Record
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!recordCustomerId || !recordAmount || !recordRef) {
      alert('Please fill all mandatory fields');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: recordCustomerId,
          sales_order_id: recordOrderId || null,
          amount: Number(recordAmount),
          payment_mode: recordMode,
          transaction_reference: recordRef,
          payment_date: recordDate,
          notes: recordNotes || null,
          auto_allocate_invoice_id: autoAllocInvoiceId || null
        })
      });

      setShowRecordModal(false);
      setRecordCustomerId('');
      setRecordAmount('');
      setRecordRef('');
      setRecordNotes('');
      setAutoAllocInvoiceId('');
      loadPayments();
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Allocation
  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!activePaymentForAlloc || !targetInvoiceId || !allocAmount) {
      alert('Please select an invoice and enter allocation amount');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest(`/finance/payments/${activePaymentForAlloc.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          payment_id: activePaymentForAlloc.id,
          invoice_id: targetInvoiceId,
          amount: Number(allocAmount)
        })
      });

      setShowAllocateModal(false);
      setActivePaymentForAlloc(null);
      loadPayments();
    } catch (err) {
      alert(err.message || 'Failed to allocate payment');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalUnallocated = payments.reduce((sum, p) => sum + Number(p.unallocated_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-solar-gold" />
            Customer Payments & Allocations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bank transfers (NEFT/RTGS/UPI), verified cash collections, and multi-invoice settlement ledger
          </p>
        </div>

        <button
          onClick={() => setShowRecordModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-solar-gold hover:bg-yellow-500 text-midnight font-semibold rounded-lg shadow-sm transition-all text-sm shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Record Payment (UTR)
        </button>
      </div>

      {/* 2. KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Collections (Page)</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <p className="text-xs text-slate-500 mt-1">{payments.length} Verified Transactions</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Unallocated Cash</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">₹{totalUnallocated.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <p className="text-xs text-amber-600 font-medium mt-1">Available to apply on open invoices</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Reconciliation Ratio</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">
              {totalCollected > 0 ? (((totalCollected - totalUnallocated) / totalCollected) * 100).toFixed(1) : 100}%
            </h3>
            <p className="text-xs text-indigo-600 font-medium mt-1">Applied to Tax Invoices</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by payment number, UTR reference, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
          />
        </form>

        <select
          value={modeFilter}
          onChange={(e) => {
            setModeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
        >
          <option value="">All Payment Modes</option>
          <option value="NEFT">NEFT</option>
          <option value="RTGS">RTGS</option>
          <option value="UPI">UPI</option>
          <option value="CHEQUE">Cheque</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </select>
      </div>

      {/* 4. Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-3 text-sm">Loading payments...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">{error}</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">No Payments Recorded Yet</h3>
            <p className="text-sm mt-1">Record a client bank transfer or receipt above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Payment # & Date</th>
                  <th className="py-3 px-4">Customer & Project</th>
                  <th className="py-3 px-4">Mode & UTR / Ref</th>
                  <th className="py-3 px-4 text-right">Received Amount</th>
                  <th className="py-3 px-4 text-right">Unallocated</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => {
                  const pDate = new Date(p.payment_date).toLocaleDateString('en-IN');
                  const amt = Number(p.amount);
                  const unallocated = Number(p.unallocated_amount);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                        <div>{p.payment_number}</div>
                        <div className="text-xs text-slate-400 font-sans">{pDate}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{p.customers?.full_name}</div>
                        <div className="text-xs text-slate-400">{p.customers?.phone_e164}</div>
                        {p.sales_orders && (
                          <div className="text-[11px] font-mono text-indigo-600 font-medium">
                            {p.sales_orders.order_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                          {p.payment_mode}
                        </span>
                        <div className="text-xs font-mono text-slate-600 mt-0.5">
                          Ref: {p.transaction_reference}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {unallocated > 0 ? (
                          <span className="font-semibold text-amber-600">
                            ₹{unallocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Fully Allocated</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={p.status}>{p.status}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {unallocated > 0 && (
                          <button
                            onClick={() => openAllocateModal(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-midnight bg-solar-gold hover:bg-yellow-500 rounded-lg shadow-sm transition-all"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Allocate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-solar-gold" />
                Record Customer Payment
              </h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={recordCustomerId}
                  onChange={(e) => setRecordCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone_e164})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={recordMode}
                    onChange={(e) => setRecordMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    UTR / Reference # *
                  </label>
                  <input
                    type="text"
                    required
                    value={recordRef}
                    onChange={(e) => setRecordRef(e.target.value)}
                    placeholder="e.g. UTR123456789"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Remark
                </label>
                <textarea
                  rows="2"
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  placeholder="Remittance details, branch name, or payer remarks..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-bold rounded-lg text-sm"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Allocate Payment Modal */}
      {showAllocateModal && activePaymentForAlloc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-solar-gold" />
                Allocate Payment ({activePaymentForAlloc.payment_number})
              </h3>
              <button onClick={() => setShowAllocateModal(false)} className="text-slate-400 text-lg">
                &times;
              </button>
            </div>

            <div className="my-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
              Available Unallocated Amount: <strong>₹{Number(activePaymentForAlloc.unallocated_amount).toFixed(2)}</strong>
            </div>

            {invoices.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-sm">
                No open/unpaid milestone invoices found for this customer.
              </div>
            ) : (
              <form onSubmit={handleAllocateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Apply to Invoice *
                  </label>
                  <select
                    required
                    value={targetInvoiceId}
                    onChange={(e) => {
                      setTargetInvoiceId(e.target.value);
                      const inv = invoices.find((i) => i.id === e.target.value);
                      if (inv) {
                        const maxApplicable = Math.min(
                          Number(activePaymentForAlloc.unallocated_amount),
                          Number(inv.amount_due)
                        );
                        setAllocAmount(String(maxApplicable));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} ({inv.milestone_type}) — Balance Due: ₹{Number(inv.amount_due).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Allocation Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={Number(activePaymentForAlloc.unallocated_amount)}
                    step="0.01"
                    required
                    value={allocAmount}
                    onChange={(e) => setAllocAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAllocateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-bold rounded-lg text-sm"
                  >
                    {submitting ? 'Applying...' : 'Apply Allocation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentsListPage;
