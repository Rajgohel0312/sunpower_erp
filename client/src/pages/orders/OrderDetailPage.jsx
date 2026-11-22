import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  Zap,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Truck,
  Wrench,
  AlertCircle,
  FileCheck2,
  Receipt,
  ExternalLink,
  Barcode,
  PackageCheck,
  LifeBuoy
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

const EXECUTION_STEPS = [
  'CONFIRMED',
  'MATERIAL_RESERVED',
  'DISPATCHED',
  'INSTALLATION_IN_PROGRESS',
  'COMMISSIONED'
];

export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Record Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('NEFT');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Update Status Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState('MATERIAL_RESERVED');
  const [statusNotes, setStatusNotes] = useState('');

  // Linked Operations Modules
  const [dispatches, setDispatches] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [serials, setSerials] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [tickets, setTickets] = useState([]);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res?.data || null);

      // Concurrently fetch linked operations modules
      try {
        const [dispRes, instRes, serRes, warRes, tckRes] = await Promise.all([
          api.get('/dispatches', { sales_order_id: id }),
          api.get('/installations', { sales_order_id: id }),
          api.get('/inventory/serials', { current_order_id: id, limit: 50 }),
          api.get('/warranties', { sales_order_id: id }).catch(() => ({ data: [] })),
          api.get('/tickets', { customer_id: res?.data?.customer_id }).catch(() => ({ data: [] }))
        ]);
        setDispatches(dispRes?.data || []);
        setInstallations(instRes?.data || []);
        setSerials(serRes?.data || []);
        setWarranties(warRes?.data || []);
        setTickets(tckRes?.data || []);
      } catch (opErr) {
        console.warn('Failed to fetch linked operations data:', opErr);
      }
    } catch (err) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }
    if (amountNum > remainingDue) {
      setPaymentError(`Payment amount (₹${amountNum.toLocaleString('en-IN')}) cannot exceed remaining balance of ₹${remainingDue.toLocaleString('en-IN')}.`);
      return;
    }

    setActionLoading(true);
    setPaymentError('');
    try {
      await api.post(`/orders/${id}/payments`, {
        amount: amountNum,
        payment_method: paymentMethod,
        reference_id: paymentRef || undefined,
        notes: paymentNotes || undefined
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      fetchOrder();
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.patch(`/orders/${id}/status`, {
        status: targetStatus,
        notes: statusNotes || undefined
      });
      setShowStatusModal(false);
      fetchOrder();
    } catch (err) {
      alert(err.message || 'Failed to update order fulfillment status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 mt-3 font-mono">Loading sales order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800">Sales Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">{error || 'The requested order could not be loaded.'}</p>
        <Link to="/orders" className="mt-4 inline-block">
          <Button variant="outline" size="sm" icon={ArrowLeft}>Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const netPayable = Number(order.net_customer_payable);
  const advanceReceived = Number(order.advance_payment_received);
  const remainingDue = Math.max(0, Number((netPayable - advanceReceived).toFixed(2)));
  const isFullyPaid = remainingDue <= 0 || order.payment_status === 'FULLY_PAID';
  const paymentPct = netPayable > 0 ? Math.min(100, Math.round((advanceReceived / netPayable) * 100)) : 100;
  const currentStepIdx = EXECUTION_STEPS.indexOf(order.status);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/orders">
            <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-midnight">{order.order_number}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirmed on {new Date(order.confirmed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Module Connections */}
          <Link to={`/dispatches?order_id=${order.id}`}>
            <Button variant="outline" size="sm" icon={Truck}>
              Prepare Dispatch
            </Button>
          </Link>
          <Link to={`/installations?order_id=${order.id}`}>
            <Button variant="outline" size="sm" icon={Wrench}>
              Schedule Job
            </Button>
          </Link>

          {isFullyPaid ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Fully Settled (₹0 Due)
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              icon={CreditCard}
              onClick={() => {
                setPaymentAmount(String(remainingDue));
                setPaymentError('');
                setShowPaymentModal(true);
              }}
            >
              Record Payment
            </Button>
          )}
          <Button variant="accent" size="sm" icon={Wrench} onClick={() => setShowStatusModal(true)}>
            Update Project Status
          </Button>
        </div>
      </div>

      {/* Fulfillment Status Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
          <span>Project Fulfillment & Execution Pipeline</span>
          <span className="font-mono text-midnight uppercase tracking-wider">{order.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {EXECUTION_STEPS.map((step, idx) => {
            const isCompleted = currentStepIdx >= idx;
            const isCurrent = order.status === step;
            return (
              <div key={step} className="flex flex-col gap-1.5">
                <div className={`h-2 rounded-full transition-colors ${
                  isCurrent ? 'bg-solar-gold' : isCompleted ? 'bg-solar-green' : 'bg-slate-200'
                }`} />
                <span className={`text-[10px] text-center font-mono ${
                  isCurrent ? 'text-midnight font-bold' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  {step.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial & Payment Milestone Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-solar-gold" /> Payment Reconciliation & Financial Progress
          </h3>
          <span className="font-mono font-bold text-xs text-midnight">{paymentPct}% Received</span>
        </div>

        {/* Progress meter */}
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
          <div
            className="bg-solar-green h-full rounded-full transition-all duration-500"
            style={{ width: `${paymentPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase">Net Contract Value</span>
            <span className="font-mono font-bold text-sm text-midnight mt-0.5 block">
              ₹{netPayable.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Total Payments Received</span>
            <span className="font-mono font-bold text-sm text-emerald-800 mt-0.5 block">
              ₹{advanceReceived.toLocaleString('en-IN')}
            </span>
          </div>
          {isFullyPaid ? (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Outstanding Balance</span>
              <span className="font-mono font-bold text-sm text-emerald-800 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline shrink-0" />
                ₹0 (Fully Settled)
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-800 block text-[10px] uppercase font-semibold">Outstanding Balance</span>
              <span className="font-mono font-bold text-sm text-amber-900 mt-0.5 block">
                ₹{remainingDue.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Customer Profile */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-midnight uppercase tracking-wider">
            <Building className="w-4 h-4 text-solar-gold" /> Customer Profile
          </div>
          <div className="text-xs space-y-1.5">
            <p className="font-bold text-sm text-slate-900">{order.customers.full_name}</p>
            <p className="font-mono text-slate-600">{order.customers.phone_e164}</p>
            {order.customers.email && <p className="text-slate-500">{order.customers.email}</p>}
            <div className="pt-2 border-t border-slate-100 flex justify-between">
              <span className="text-slate-500">Customer Code:</span>
              <span className="font-mono font-bold text-midnight">{order.customers.customer_code}</span>
            </div>
            {order.customers.gstin && (
              <div className="flex justify-between">
                <span className="text-slate-500">GSTIN:</span>
                <span className="font-mono text-slate-700">{order.customers.gstin}</span>
              </div>
            )}
          </div>
        </div>

        {/* Project Technical Scope */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-midnight uppercase tracking-wider">
            <Zap className="w-4 h-4 text-solar-gold" /> Technical System Specifications
          </div>
          <div className="text-xs space-y-2">
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">System Capacity:</span>
              <span className="font-mono font-bold text-midnight">{Number(order.system_capacity_kw)} kW</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Linked Proposal:</span>
              <Link to={`/quotations/${order.quotation_id}`} className="font-mono font-bold text-sky-600 hover:underline">
                {order.quotations?.quotation_number}
              </Link>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Engineering BOM:</span>
              <span className="font-mono font-bold text-slate-800">{order.project_boms?.bom_number}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Operations: Material Dispatches & Field Installations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Material Dispatches */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-solar-gold" /> Material Dispatches ({dispatches.length})
            </h3>
            <Link to={`/dispatches?order_id=${order.id}`}>
              <Button variant="outline" size="sm" icon={Truck}>
                {dispatches.length > 0 ? '+ New Dispatch' : 'Prepare Dispatch'}
              </Button>
            </Link>
          </div>

          {dispatches.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
              <p className="text-xs text-slate-500">No material dispatches prepared yet for this order.</p>
              <Link to={`/dispatches?order_id=${order.id}`} className="mt-2 inline-block">
                <span className="text-xs font-semibold text-sky-600 hover:underline">Click here to auto-fill items and dispatch &rarr;</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {dispatches.map((d) => (
                <div key={d.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-midnight">{d.dispatch_number}</span>
                      <Badge variant={d.status === 'DELIVERED' ? 'success' : d.status === 'IN_TRANSIT' ? 'warning' : 'neutral'}>
                        {d.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Driver: <strong className="text-slate-700">{d.driver_name}</strong> ({d.vehicle_number || 'Truck'}) • {d.dispatch_items?.length || 0} items
                    </p>
                  </div>
                  <Link to="/dispatches" className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-medium">
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Field Installation Jobs */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-solar-gold" /> Installation & Commissioning ({installations.length})
            </h3>
            <Link to={`/installations?order_id=${order.id}`}>
              <Button variant="outline" size="sm" icon={Wrench}>
                {installations.length > 0 ? '+ Schedule Job' : 'Schedule Installation'}
              </Button>
            </Link>
          </div>

          {installations.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
              <p className="text-xs text-slate-500">No field installation job scheduled yet.</p>
              <Link to={`/installations?order_id=${order.id}`} className="mt-2 inline-block">
                <span className="text-xs font-semibold text-sky-600 hover:underline">Click here to schedule crew & checklist &rarr;</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {installations.map((job) => (
                <div key={job.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-midnight">{job.job_number}</span>
                      <Badge variant={job.status === 'COMMISSIONED' ? 'success' : 'info'}>
                        {job.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Lead: <strong className="text-slate-700">{job.users_installation_jobs_team_lead_idTousers?.full_name || 'Assigned'}</strong>
                      {job.installation_signoffs?.[0]?.certificate_number && (
                        <span className="ml-2 font-mono text-emerald-700 font-semibold">
                          • Cert: {job.installation_signoffs[0].certificate_number}
                        </span>
                      )}
                    </p>
                  </div>
                  <Link to={`/installations/${job.id}`}>
                    <Button variant="accent" size="sm" icon={Wrench}>
                      Console
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Serialized Hardware Tracking Asset List */}
      {serials.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-solar-gold" />
              Assigned Hardware Equipment & Serial Numbers ({serials.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Tracked live in <Link to="/inventory/serials" className="text-sky-600 hover:underline font-medium">Serial Explorer</Link>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Serial Number</th>
                  <th className="py-2.5 px-4">Product / SKU</th>
                  <th className="py-2.5 px-4">Depot / Warehouse</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serials.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-midnight">{s.serial_number}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-800">{s.products?.brand} {s.products?.model_name || s.products?.sku}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{s.warehouses?.name || 'Depot'}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant={s.status === 'INSTALLED' ? 'success' : s.status === 'DISPATCHED' ? 'warning' : 'info'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link to={`/inventory/serials?search=${s.serial_number}`} className="text-sky-600 hover:underline text-[11px] font-medium">
                        Trace &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Registered Warranties & After-Sales Service */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Warranties & After-Sales Service ({warranties.length} Warranties, {tickets.length} Tickets)
          </h3>
          <div className="flex items-center gap-2">
            <Link to={`/warranties?sales_order_id=${order.id}`}>
              <Button variant="outline" size="sm" icon={ShieldCheck}>
                View All Warranties
              </Button>
            </Link>
            <Link to={`/tickets?customer_id=${order.customer_id}`}>
              <Button variant="accent" size="sm" icon={LifeBuoy}>
                + Log Ticket
              </Button>
            </Link>
          </div>
        </div>

        {warranties.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 bg-slate-50/30">
            Warranties will be automatically registered once the installation is commissioned with customer digital sign-off.
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {warranties.map((w) => (
              <div key={w.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-midnight">{w.warranty_certificate_number}</span>
                  <Badge variant={w.status === 'ACTIVE' ? 'success' : 'neutral'}>{w.status}</Badge>
                </div>
                <div className="font-semibold text-slate-700">
                  {w.products?.model_name || w.policy_snapshot?.policy_name || 'System Hardware'}
                </div>
                {w.serial_numbers && (
                  <div className="text-[11px] font-mono text-sky-600">
                    SN: {w.serial_numbers.serial_number}
                  </div>
                )}
                <div className="text-[10px] text-slate-400">
                  Expires: {new Date(w.end_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recorded Payment History Ledger */}
      {Array.isArray(order.snapshot_data?.recorded_payments) && order.snapshot_data.recorded_payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-midnight uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              Recorded Payment Transactions ({order.snapshot_data.recorded_payments.length})
            </h3>
            <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Total Settled: ₹{advanceReceived.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Reference / UTR</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4">Recorded By</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.snapshot_data.recorded_payments.map((pmt, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {pmt.recorded_at ? new Date(pmt.recorded_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">
                        {pmt.payment_method || 'NEFT'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">{pmt.reference_id || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{pmt.notes || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{pmt.recorded_by || 'User'}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-700 text-right">
                      +₹{Number(pmt.amount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Immutable Snapshot Line Items */}
      {order.snapshot_data?.items && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-midnight uppercase tracking-wider">
              Frozen Commercial Hardware BOM Snapshot ({order.snapshot_data.items.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Component & Specification</th>
                  <th className="py-3 px-4">Brand / SKU</th>
                  <th className="py-3 px-4">Qty</th>
                  <th className="py-3 px-4">Frozen Unit Price</th>
                  <th className="py-3 px-4 text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.snapshot_data.items.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.item_name}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{item.sku || item.brand || '—'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {Number(item.quantity)} {item.unit_code}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      ₹{Number(item.unit_price).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-midnight text-right">
                      ₹{Number(item.total_price).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Customer Payment"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {paymentError}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">
                Payment Amount (₹) *
              </label>
              <button
                type="button"
                onClick={() => {
                  setPaymentAmount(String(remainingDue));
                  setPaymentError('');
                }}
                className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
              >
                Pay Full (₹{remainingDue.toLocaleString('en-IN')})
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingDue}
              required
              value={paymentAmount}
              onChange={(e) => {
                setPaymentAmount(e.target.value);
                setPaymentError('');
              }}
              placeholder={`Max: ₹${remainingDue.toLocaleString('en-IN')}`}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight outline-none"
            />
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
              <span>Outstanding Balance:</span>
              <span className="font-mono font-bold text-amber-800">₹{remainingDue.toLocaleString('en-IN')}</span>
            </div>
            {Number(paymentAmount) > remainingDue && (
              <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Amount exceeds outstanding balance of ₹{remainingDue.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-midnight outline-none"
            >
              <option value="UPI">UPI / QR Code</option>
              <option value="NEFT">NEFT / RTGS</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Payment Gateway</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bank UTR / Transaction Reference ID
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="UTR202611220938"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Payment Notes
            </label>
            <textarea
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Advance payment for material procurement..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              type="submit"
              loading={actionLoading}
              disabled={actionLoading || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > remainingDue}
              icon={Receipt}
            >
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Project Execution Status"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select New Execution Stage *
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-midnight outline-none font-medium text-slate-800"
            >
              {EXECUTION_STEPS.map((st) => (
                <option key={st} value={st}>
                  {st.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Fulfillment Log Notes
            </label>
            <textarea
              rows={3}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="Material picked from central store and loaded on transport..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setShowStatusModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Update Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
export default OrderDetailPage;
