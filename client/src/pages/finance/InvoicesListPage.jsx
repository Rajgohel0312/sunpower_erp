import React, { useState, useEffect, useTransition } from 'react';
import {
  FileText,
  Search,
  Plus,
  Filter,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  Eye,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import Badge from '../../components/common/Badge.jsx';

export function InvoicesListPage() {
  const [invoices, setInvoices] = useState([]);
  const [aging, setAging] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Create Form State
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [milestoneType, setMilestoneType] = useState('ADVANCE');
  const [milestonePercentage, setMilestonePercentage] = useState(20);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInvoices();
    loadAgingSummary();
    loadOrdersList();
  }, [page, statusFilter, milestoneFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '10'
      });
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (milestoneFilter) params.append('milestone_type', milestoneFilter);

      const res = await apiRequest(`/finance/invoices?${params.toString()}`);
      setInvoices(res.data || []);
      if (res.meta?.pagination) {
        setTotalPages(res.meta.pagination.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadAgingSummary = async () => {
    try {
      const res = await apiRequest('/finance/aging');
      setAging(res.data || null);
    } catch (err) {
      console.warn('Could not load AR aging summary', err);
    }
  };

  const loadOrdersList = async () => {
    try {
      const res = await apiRequest('/orders?limit=100');
      setOrders(res.data || []);
    } catch (err) {
      console.warn('Could not load sales orders', err);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    startTransition(() => {
      // triggers debounced search effect
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadInvoices();
  };

  // Milestone preset changes
  const handleMilestoneChange = (type) => {
    setMilestoneType(type);
    if (type === 'ADVANCE') setMilestonePercentage(20);
    else if (type === 'DELIVERY') setMilestonePercentage(60);
    else if (type === 'INSTALLATION_COMPLETE') setMilestonePercentage(15);
    else if (type === 'NET_METERING' || type === 'FINAL_SETTLEMENT') setMilestonePercentage(5);
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const orderContractValue = selectedOrder
    ? Number(selectedOrder.net_customer_payable || selectedOrder.total_amount || 0)
    : 0;

  // Real-time calculation preview
  const previewBase = (orderContractValue * Number(milestonePercentage)) / 100;
  const previewGoodsTaxable = previewBase * 0.70;
  const previewGoodsTax = previewGoodsTaxable * 0.12;
  const previewServicesTaxable = previewBase * 0.30;
  const previewServicesTax = previewServicesTaxable * 0.18;
  const previewTotalTax = previewGoodsTax + previewServicesTax;
  const previewGrandTotal = previewBase + previewTotalTax;

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!selectedOrderId) {
      alert('Please select a confirmed Sales Order');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          sales_order_id: selectedOrderId,
          milestone_type: milestoneType,
          milestone_percentage: Number(milestonePercentage),
          due_date: dueDate,
          notes
        })
      });

      setShowCreateModal(false);
      setSelectedOrderId('');
      setNotes('');
      loadInvoices();
      loadAgingSummary();
    } catch (err) {
      alert(err.message || 'Failed to create milestone invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const openViewInvoice = async (invoice) => {
    try {
      const res = await apiRequest(`/finance/invoices/${invoice.id}`);
      setSelectedInvoice(res.data);
      setShowViewModal(true);
    } catch (err) {
      setSelectedInvoice(invoice);
      setShowViewModal(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Compute KPI statistics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-2">
            <FileText className="w-7 h-7 text-solar-gold" />
            Milestone Tax Invoices & Billing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Statutory 70:30 Solar EPC Invoicing (12% Goods / 18% Services), GST Schedule & Collections
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-solar-gold hover:bg-yellow-500 text-midnight font-semibold rounded-lg shadow-sm transition-all text-sm shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Generate Milestone Invoice
          </button>
        </div>
      </div>

      {/* 2. Financial KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Invoiced (Page)</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{totalInvoiced.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <p className="text-xs text-slate-500 mt-1">Across issued milestone bills</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Cash Received</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled & Allocated
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Receivables Due</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            <p className="text-xs text-amber-600 font-medium mt-1">Awaiting client payment</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Overdue (AR Aging)</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">
              ₹{(aging ? aging.overdue_31_60 + aging.overdue_61_90 + aging.overdue_90_plus : 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-xs text-rose-600 font-medium mt-1">&gt;30 Days Past Due</p>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice number, customer name, or order number..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
          >
            <option value="">All Statuses</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={milestoneFilter}
            onChange={(e) => {
              setMilestoneFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
          >
            <option value="">All Milestones</option>
            <option value="ADVANCE">Advance (Booking)</option>
            <option value="DELIVERY">Material Delivery</option>
            <option value="INSTALLATION_COMPLETE">Installation Complete</option>
            <option value="NET_METERING">Net Metering</option>
            <option value="FINAL_SETTLEMENT">Final Settlement</option>
          </select>
        </div>
      </div>

      {/* 4. Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-sm">Loading tax invoices...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">No Tax Invoices Found</h3>
            <p className="text-sm mt-1">Generate a milestone invoice for a confirmed sales order above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice # & Date</th>
                  <th className="py-3 px-4">Customer & Project</th>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4 text-right">Taxable Amt</th>
                  <th className="py-3 px-4 text-right">GST (12/18%)</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Paid / Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {invoices.map((inv) => {
                  const invDate = new Date(inv.invoice_date).toLocaleDateString('en-IN');
                  const dueDate = new Date(inv.due_date).toLocaleDateString('en-IN');
                  const grandTotal = Number(inv.grand_total);
                  const paid = Number(inv.amount_paid);
                  const due = Number(inv.amount_due);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-slate-900">{inv.invoice_number}</div>
                        <div className="text-xs text-slate-400">Issued: {invDate}</div>
                        <div className="text-[11px] text-amber-600">Due: {dueDate}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{inv.customers?.full_name || 'Customer'}</div>
                        <div className="text-xs text-slate-500">{inv.customers?.phone_e164}</div>
                        <div className="text-[11px] font-mono text-indigo-600 font-medium">
                          {inv.sales_orders?.order_number}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {inv.milestone_type?.replace('_', ' ')} ({Number(inv.milestone_percentage)}%)
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">HSN: {inv.hsn_sac_code || '995465'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        ₹{Number(inv.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                        <div>Goods: ₹{Number(inv.tax_goods_amount).toFixed(2)}</div>
                        <div>Services: ₹{Number(inv.tax_services_amount).toFixed(2)}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="text-xs text-emerald-600 font-medium">Paid: ₹{paid.toFixed(2)}</div>
                        <div className="text-xs text-rose-600 font-semibold">Due: ₹{due.toFixed(2)}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={inv.status}>{inv.status}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openViewInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Tax Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Create Milestone Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-solar-gold" />
                <h3 className="text-lg font-bold text-slate-900 font-display">Generate Milestone Tax Invoice</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-5 mt-5">
              {/* Select Sales Order */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmed Sales Order *
                </label>
                <select
                  required
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
                >
                  <option value="">-- Choose Sales Order --</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customers?.full_name || 'Customer'} (₹{Number(o.net_customer_payable || o.total_amount).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
                {selectedOrder && (
                  <p className="text-xs text-indigo-600 mt-1 font-medium">
                    Order Value: ₹{orderContractValue.toLocaleString('en-IN')} | Customer: {selectedOrder.customers?.full_name}
                  </p>
                )}
              </div>

              {/* Milestone Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Milestone Stage *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'ADVANCE', label: 'Advance (20%)', pct: 20 },
                    { type: 'DELIVERY', label: 'Delivery (60%)', pct: 60 },
                    { type: 'INSTALLATION_COMPLETE', label: 'Install (15%)', pct: 15 },
                    { type: 'NET_METERING', label: 'Commission (5%)', pct: 5 }
                  ].map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => handleMilestoneChange(m.type)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        milestoneType === m.type
                          ? 'bg-solar-gold/20 border-solar-gold text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Milestone Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={milestonePercentage}
                    onChange={(e) => setMilestonePercentage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
                  />
                </div>
              </div>

              {/* Statutory 70:30 Solar GST Calculation Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Statutory Solar EPC Split (70:30 Rule):</span>
                  <span className="font-mono text-slate-900">Milestone Base: ₹{previewBase.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                  <div>
                    <span className="text-slate-500">70% Equipment (12% GST):</span>
                    <div className="font-mono text-slate-800">
                      ₹{previewGoodsTaxable.toFixed(2)} + ₹{previewGoodsTax.toFixed(2)} tax
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">30% Services (18% GST):</span>
                    <div className="font-mono text-slate-800">
                      ₹{previewServicesTaxable.toFixed(2)} + ₹{previewServicesTax.toFixed(2)} tax
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-sm font-bold text-slate-900">
                  <span>Grand Total (Incl. GST):</span>
                  <span className="font-mono text-emerald-600">₹{previewGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Internal Notes / Terms
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment milestone terms, bank transfer notes, or reference remarks..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/50"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-bold rounded-lg text-sm shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Generating Invoice...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. GST Tax Invoice Modal (Printable Official Document) */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Official Commercial Tax Invoice View
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold ml-2"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Official GST Invoice Sheet */}
            <div className="mt-6 space-y-6 text-slate-900 font-sans" id="printable-tax-invoice">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight font-display">
                    SUNPOWER SOLAR TECHNOLOGIES PVT LTD
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Solar Rooftop EPC, Commercial & Industrial Solar Installations
                  </p>
                  <p className="text-xs text-slate-600">
                    Plot 42, GIDC Phase II, Ahmedabad, Gujarat - 382445
                  </p>
                  <p className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
                    GSTIN: 24AAACS1234F1Z5 | PAN: AAACS1234F | State: 24-Gujarat
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-midnight text-white text-xs font-mono font-bold rounded uppercase tracking-widest inline-block">
                    TAX INVOICE
                  </span>
                  <div className="text-lg font-mono font-bold text-slate-900 mt-2">
                    {selectedInvoice.invoice_number}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Date: {new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN')}
                  </div>
                  <div className="text-xs text-amber-700 font-medium">
                    Due: {new Date(selectedInvoice.due_date).toLocaleDateString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Billed To / Shipped To */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                    Customer & Billed To:
                  </span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedInvoice.customers?.full_name || selectedInvoice.snapshot_data?.customer_name}
                  </div>
                  <div className="text-slate-600">{selectedInvoice.customers?.phone_e164 || selectedInvoice.snapshot_data?.customer_phone}</div>
                  <div className="text-slate-600 font-mono mt-0.5">
                    GSTIN: {selectedInvoice.customers?.gstin || selectedInvoice.snapshot_data?.customer_gstin || 'Unregistered Consumer'}
                  </div>
                </div>

                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                    Sales Order & Milestone Reference:
                  </span>
                  <div className="font-bold text-indigo-700 font-mono text-sm mt-0.5">
                    {selectedInvoice.sales_orders?.order_number || selectedInvoice.snapshot_data?.sales_order_number}
                  </div>
                  <div className="text-slate-600 font-medium">
                    Milestone: {selectedInvoice.milestone_type?.replace('_', ' ')} ({Number(selectedInvoice.milestone_percentage)}%)
                  </div>
                  <div className="text-slate-500">
                    Status: <strong className="text-slate-800">{selectedInvoice.status}</strong>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5 border-b border-slate-200">Description</th>
                    <th className="p-2.5 border-b border-slate-200 text-center">HSN/SAC</th>
                    <th className="p-2.5 border-b border-slate-200 text-center">Qty</th>
                    <th className="p-2.5 border-b border-slate-200 text-right">Unit Rate</th>
                    <th className="p-2.5 border-b border-slate-200 text-right">Taxable (₹)</th>
                    <th className="p-2.5 border-b border-slate-200 text-center">GST %</th>
                    <th className="p-2.5 border-b border-slate-200 text-right">Tax (₹)</th>
                    <th className="p-2.5 border-b border-slate-200 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {(selectedInvoice.invoice_items || selectedInvoice.snapshot_data?.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-sans font-medium text-slate-800">{item.description}</td>
                      <td className="p-2.5 text-center text-slate-600">{item.hsn_sac_code || '995465'}</td>
                      <td className="p-2.5 text-center">{Number(item.quantity)} {item.unit_code}</td>
                      <td className="p-2.5 text-right">₹{Number(item.unit_price).toFixed(2)}</td>
                      <td className="p-2.5 text-right">₹{Number(item.taxable_amount).toFixed(2)}</td>
                      <td className="p-2.5 text-center">{Number(item.tax_rate_pct)}%</td>
                      <td className="p-2.5 text-right">₹{Number(item.tax_amount).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">₹{Number(item.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span className="font-mono font-medium">₹{Number(selectedInvoice.taxable_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Goods GST (12%):</span>
                    <span className="font-mono text-slate-600">₹{Number(selectedInvoice.tax_goods_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Services GST (18%):</span>
                    <span className="font-mono text-slate-600">₹{Number(selectedInvoice.tax_services_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
                    <span>Invoice Total:</span>
                    <span className="font-mono text-emerald-700">₹{Number(selectedInvoice.grand_total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-600 pt-1">
                    <span>Amount Paid:</span>
                    <span className="font-mono">₹{Number(selectedInvoice.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-rose-600 font-bold">
                    <span>Balance Due:</span>
                    <span className="font-mono">₹{Number(selectedInvoice.amount_due).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Bank & Remittance Instructions */}
              <div className="border-t border-slate-200 pt-4 grid grid-cols-2 gap-4 text-xs text-slate-600">
                <div>
                  <span className="font-bold text-slate-800 uppercase text-[10px]">Bank Remittance Details:</span>
                  <div className="mt-1">Beneficiary: <strong>SunPower Solar Technologies Pvt Ltd</strong></div>
                  <div>Bank: <strong>ICICI Bank Ltd</strong></div>
                  <div>Account No: <strong>000405012345</strong> (Current A/C)</div>
                  <div>IFSC Code: <strong>ICIC0000004</strong></div>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <div className="h-12 border-b border-dashed border-slate-400 w-48 ml-auto"></div>
                  <div className="text-[11px] font-semibold text-slate-700 mt-1">Authorized Signatory</div>
                  <div className="text-[10px] text-slate-400">SunPower Solar Technologies Pvt Ltd</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoicesListPage;
