import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Zap,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Printer,
  ShoppingBag,
  DollarSign,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  FileCheck2
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

export function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [advancePayment, setAdvancePayment] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [convertError, setConvertError] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchQuotation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/quotations/${id}`);
      setQuotation(res?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  const handleSubmitForApproval = async () => {
    setActionLoading(true);
    try {
      await api.post(`/quotations/${id}/submit`);
      fetchQuotation();
    } catch (err) {
      alert(err.message || 'Failed to submit quotation for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (decision) => {
    setActionLoading(true);
    try {
      await api.post(`/quotations/${id}/review`, {
        decision,
        comments: decision === 'APPROVE' ? 'Approved by manager' : 'Rejected'
      });
      fetchQuotation();
    } catch (err) {
      alert(err.message || `Failed to ${decision.toLowerCase()} quotation`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    setActionLoading(true);
    try {
      await api.post(`/quotations/${id}/send`, { channel: 'WHATSAPP' });
      fetchQuotation();
    } catch (err) {
      alert(err.message || 'Failed to dispatch quotation to customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await api.post(`/quotations/${id}/accept`, {
        accepted_by_name: quotation.customers?.full_name || quotation.leads?.full_name || 'Customer'
      });
      fetchQuotation();
    } catch (err) {
      alert(err.message || 'Failed to record quotation acceptance');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToOrder = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setConvertError('');
    try {
      const res = await api.post('/orders', {
        quotation_id: quotation.id,
        advance_payment_received: Number(advancePayment) || 0,
        installation_target_date: targetDate || undefined,
        notes: orderNotes || undefined
      });
      setShowConvertModal(false);
      navigate(`/orders/${res.data.id}`);
    } catch (err) {
      setConvertError(err.message || 'Failed to convert quotation to sales order');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 mt-3 font-mono">Loading commercial proposal...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800">Quotation Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">{error || 'The requested quotation could not be loaded.'}</p>
        <Link to="/quotations" className="mt-4 inline-block">
          <Button variant="outline" size="sm" icon={ArrowLeft}>Back to Quotations</Button>
        </Link>
      </div>
    );
  }

  const stages = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'CONVERTED'];
  const currentStageIdx = stages.indexOf(quotation.status);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/quotations">
            <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-midnight">{quotation.quotation_number}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                v{quotation.version}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(quotation.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Action Buttons based on Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>
            Print / PDF
          </Button>

          {quotation.status === 'DRAFT' && (
            <Button variant="accent" size="sm" icon={Clock} loading={actionLoading} onClick={handleSubmitForApproval}>
              Submit for Manager Review
            </Button>
          )}

          {quotation.status === 'PENDING_APPROVAL' && (
            <>
              <Button variant="danger" size="sm" icon={X} loading={actionLoading} onClick={() => handleReview('REJECT')}>
                Reject
              </Button>
              <Button variant="accent" size="sm" icon={Check} loading={actionLoading} onClick={() => handleReview('APPROVE')}>
                Approve Quotation
              </Button>
            </>
          )}

          {quotation.status === 'APPROVED' && (
            <Button variant="accent" size="sm" icon={Send} loading={actionLoading} onClick={handleSend}>
              Dispatch Proposal (WhatsApp)
            </Button>
          )}

          {quotation.status === 'SENT' && (
            <Button variant="accent" size="sm" icon={CheckCircle2} loading={actionLoading} onClick={handleAccept}>
              Mark Customer Accepted
            </Button>
          )}

          {quotation.status === 'ACCEPTED' && (
            <Button variant="accent" size="sm" icon={ShoppingBag} onClick={() => setShowConvertModal(true)}>
              Convert to Sales Order
            </Button>
          )}
        </div>
      </div>

      {/* Commercial Workflow Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
          <span>Quotation Lifecycle Status</span>
          <span className="font-mono text-midnight uppercase tracking-wider">{quotation.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {stages.map((st, i) => {
            const isCompleted = currentStageIdx >= i && quotation.status !== 'REJECTED';
            const isCurrent = quotation.status === st;
            return (
              <div key={st} className="flex flex-col gap-1.5">
                <div className={`h-2 rounded-full transition-colors ${
                  isCurrent ? 'bg-solar-gold' : isCompleted ? 'bg-solar-green' : 'bg-slate-200'
                }`} />
                <span className={`text-[10px] text-center font-mono ${
                  isCurrent ? 'text-midnight font-bold' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  {st.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Customer & Site Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-midnight uppercase tracking-wider">
            <Building className="w-4 h-4 text-solar-gold" /> Customer & Site Profile
          </div>
          <div className="text-sm space-y-1">
            <p className="font-bold text-slate-900">
              {quotation.customers?.full_name || quotation.leads?.full_name || 'Prospect'}
            </p>
            <p className="font-mono text-xs text-slate-600">
              {quotation.customers?.phone_e164 || quotation.leads?.phone_e164}
            </p>
            {quotation.customers?.email && (
              <p className="text-xs text-slate-500">{quotation.customers.email}</p>
            )}
            {quotation.customers && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Customer Code:</span>
                <span className="font-mono font-bold text-midnight">{quotation.customers.customer_code}</span>
              </div>
            )}
          </div>
        </div>

        {/* System Engineering Parameters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-midnight uppercase tracking-wider">
            <Zap className="w-4 h-4 text-solar-gold" /> System Specifications
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase">DC Capacity</span>
              <span className="font-mono font-bold text-midnight text-base">{Number(quotation.system_capacity_kw)} kW</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 block uppercase">BOM Reference</span>
              <span className="font-mono font-bold text-midnight text-xs">{quotation.project_boms?.bom_number}</span>
            </div>
          </div>
          {quotation.surveys && (
            <div className="pt-1 text-xs text-slate-500 flex justify-between">
              <span>Roof Substrate:</span>
              <span className="font-semibold text-slate-800">{quotation.surveys.roof_type?.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        {/* Commercial Proposal Summary */}
        <div className="bg-midnight text-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-solar-gold">
            <span>Net Customer Payable</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-solar-gold">
              ₹{Number(quotation.net_payable).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-300 mt-1 flex justify-between">
              <span>Gross Project Value:</span>
              <span className="font-mono">₹{Number(quotation.grand_total).toLocaleString('en-IN')}</span>
            </div>
            {Number(quotation.subsidy_amount) > 0 && (
              <div className="text-[11px] text-emerald-400 flex justify-between font-medium">
                <span>PM Surya Ghar Subsidy:</span>
                <span className="font-mono">- ₹{Number(quotation.subsidy_amount).toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-midnight uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-solar-gold" /> Commercial Cost & Tax Rollup (Indian Solar Standard)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Hardware Components Subtotal</span>
            <span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
              ₹{Number(quotation.hardware_subtotal).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Installation, Structure & Civil</span>
            <span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
              ₹{Number(quotation.installation_charges).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Transportation & Logistics</span>
            <span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
              ₹{Number(quotation.transport_charges).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Commercial Discount</span>
            <span className="text-sm font-bold font-mono text-rose-600 mt-1 block">
              - ₹{Number(quotation.discount_amount).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* GST 70:30 Split Container */}
        <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-lg text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-bold text-amber-950 block">Indian Solar Composite GST (70% Goods @ 12% + 30% Services @ 18% = 13.8%)</span>
            <span className="text-amber-800 text-[11px]">
              Goods Portion: ₹{Number(quotation.tax_goods_amount).toLocaleString('en-IN')} (12%) | Services Portion: ₹{Number(quotation.tax_services_amount).toLocaleString('en-IN')} (18%)
            </span>
          </div>
          <div className="text-right font-mono font-bold text-sm text-midnight">
            ₹{Number(quotation.tax_total).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Bill of Materials Line Items */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-bold text-midnight uppercase tracking-wider">
            Bill of Materials Line Items ({quotation.quotation_items.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Item & Specification</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">GST Rate</th>
                <th className="py-3 px-4 text-right">Total Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotation.quotation_items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.item_name}</div>
                    {item.description && (
                      <div className="text-[11px] text-slate-500 font-mono">{item.description}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{item.item_type}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">
                    {Number(item.quantity)} {item.unit_code}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    ₹{Number(item.unit_price).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{Number(item.tax_rate_pct)}%</td>
                  <td className="py-3 px-4 font-mono font-bold text-midnight text-right">
                    ₹{Number(item.total_price).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Milestone Terms */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-solar-gold" /> Payment Milestones & Schedule
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {quotation.payment_terms && quotation.payment_terms.map((m, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
              <div className="flex items-center justify-between font-bold text-midnight">
                <span>{m.name || m.milestone}</span>
                <span className="font-mono text-solar-gold bg-midnight px-1.5 py-0.5 rounded text-[10px]">
                  {m.percentage}%
                </span>
              </div>
              <div className="text-base font-bold font-mono text-midnight pt-1">
                ₹{Number(m.amount).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">{m.condition}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Convert to Sales Order Modal */}
      <Modal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        title="Convert Proposal to Confirmed Sales Order"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConvertToOrder} className="space-y-4">
          {convertError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {convertError}
            </div>
          )}

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <span className="font-bold block">Quotation Acceptance Confirmed</span>
            Converting this quotation captures an immutable commercial snapshot and advances the customer lead to <strong>WON</strong>.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Advance Payment Received (₹)
            </label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 25000"
              value={advancePayment}
              onChange={(e) => setAdvancePayment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Installation Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Order Notes / Execution Instructions
            </label>
            <textarea
              rows={2}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Customer requested priority structure mounting..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setShowConvertModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" type="submit" loading={actionLoading} icon={FileCheck2}>
              Confirm Sales Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
export default QuotationDetailPage;
