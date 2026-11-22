import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LifeBuoy,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  Barcode,
  Calendar,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Wrench,
  Sparkles,
  Zap,
  Phone
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';

export function ServiceTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ totalOpen: 0, criticalHigh: 0, waitingParts: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'ALL');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // "Log Ticket" Modal state
  const [isLogModalOpen, setIsLogModalOpen] = useState(Boolean(searchParams.get('customer_id')));
  const [customers, setCustomers] = useState([]);
  const [newTicketForm, setNewTicketForm] = useState({
    customer_id: searchParams.get('customer_id') || '',
    serial_number: searchParams.get('serial_number') || '',
    category: 'INVERTER_FAULT',
    priority: 'MEDIUM',
    reported_issue: '',
    source: 'WEB'
  });
  const [claimVerification, setClaimVerification] = useState(null);
  const [verifyingClaim, setVerifyingClaim] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [formError, setFormError] = useState(null);

  // Fetch tickets and stats
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '10');

      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      if (priorityFilter !== 'ALL') {
        params.set('priority', priorityFilter);
      }

      const [ticketsRes, statsRes] = await Promise.all([
        api.get(`/tickets?${params.toString()}`),
        api.get('/tickets/stats').catch(() => ({ data: stats }))
      ]);

      if (ticketsRes.data) {
        setTickets(ticketsRes.data);
        if (ticketsRes.meta?.pagination) {
          setPagination(ticketsRes.meta.pagination);
        }
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Failed to load service tickets:', err);
      setError(err.message || 'Failed to load service tickets');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Load customer options for modal
  useEffect(() => {
    if (isLogModalOpen && customers.length === 0) {
      api.get('/customers?limit=100').then((res) => {
        if (res.data) setCustomers(res.data);
      }).catch(console.error);
    }
  }, [isLogModalOpen, customers.length]);

  // Sync state to URL
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (page > 1) nextParams.set('page', page.toString());
    if (debouncedSearch) nextParams.set('search', debouncedSearch);
    if (statusFilter !== 'ALL') nextParams.set('status', statusFilter);
    if (priorityFilter !== 'ALL') nextParams.set('priority', priorityFilter);
    setSearchParams(nextParams, { replace: true });
  }, [page, debouncedSearch, statusFilter, priorityFilter, setSearchParams]);

  // Instant Warranty Claim Verification Handler
  const handleVerifyClaim = async () => {
    if (!newTicketForm.serial_number.trim()) return;
    try {
      setVerifyingClaim(true);
      setClaimVerification(null);
      const res = await api.post('/warranties/verify-claim', {
        serial_number: newTicketForm.serial_number.trim(),
        customer_id: newTicketForm.customer_id || undefined
      });
      setClaimVerification(res.data);
      if (res?.data?.serial?.serial_number && res.data.serial.serial_number !== newTicketForm.serial_number.trim()) {
        setNewTicketForm((prev) => ({ ...prev, serial_number: res.data.serial.serial_number }));
      }
    } catch (err) {
      setClaimVerification({
        is_valid: false,
        message: err.message || 'Error checking warranty validity'
      });
    } finally {
      setVerifyingClaim(false);
    }
  };

  // Submit New Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!newTicketForm.customer_id) {
      setFormError('Please select a customer');
      return;
    }
    if (!newTicketForm.reported_issue || newTicketForm.reported_issue.trim().length < 5) {
      setFormError('Reported issue must be at least 5 characters');
      return;
    }

    try {
      setSubmittingTicket(true);
      await api.post('/tickets', newTicketForm);
      setIsLogModalOpen(false);
      setNewTicketForm({
        customer_id: '',
        serial_number: '',
        category: 'INVERTER_FAULT',
        priority: 'MEDIUM',
        reported_issue: '',
        source: 'WEB'
      });
      setClaimVerification(null);
      fetchTickets();
    } catch (err) {
      console.error('Failed to log service ticket:', err);
      setFormError(err.message || 'Failed to create service ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // UI Helpers
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">CRITICAL</span>;
      case 'HIGH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">HIGH</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">MEDIUM</span>;
      case 'LOW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">LOW</span>;
      default:
        return <Badge variant="neutral">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="warning">Open</Badge>;
      case 'ASSIGNED':
        return <Badge variant="info">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">In Progress</span>;
      case 'WAITING_PARTS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Waiting Parts</span>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">Closed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getSlaStatus = (slaDueDate, status) => {
    if (!slaDueDate) return null;
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(status)) {
      return <span className="text-[10px] text-slate-400">Resolved within SLA</span>;
    }

    const due = new Date(slaDueDate).getTime();
    const diffHours = Math.round((due - Date.now()) / (60 * 60 * 1000));

    if (diffHours < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600">
          <AlertTriangle className="w-3 h-3" /> SLA Breached ({Math.abs(diffHours)}h ago)
        </span>
      );
    }
    if (diffHours <= 12) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
          <Clock className="w-3 h-3" /> {diffHours}h remaining
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <Clock className="w-3 h-3" /> Due in {Math.round(diffHours / 24)} days
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-solar-gold/10 text-midnight border border-solar-gold/20">
              <LifeBuoy className="w-6 h-6 text-midnight" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-midnight tracking-tight">After-Sales Service & Tickets Desk</h1>
              <p className="text-sm text-slate-500">
                Customer plant diagnostics, SLA countdowns, technician dispatch & serialized RMA equipment swaps
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchTickets}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsLogModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Log Service Ticket
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Active Open Tickets</div>
            <div className="text-2xl font-bold font-mono text-midnight mt-0.5">{stats.totalOpen}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Critical / High Priority</div>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-0.5">{stats.criticalHigh}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Waiting For RMA Parts</div>
            <div className="text-2xl font-bold font-mono text-midnight mt-0.5">{stats.waitingParts}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Resolved Tickets</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-0.5">{stats.resolved}</div>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-midnight text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Priority Selector */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket #, issue, customer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40 focus:border-solar-gold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading support tickets...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <LifeBuoy className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No Service Tickets Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No tickets match your filters. Click "Log Service Ticket" to create a support incident with automatic SLA assignment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Customer & Plant</th>
                  <th className="py-3 px-4">Reported Issue</th>
                  <th className="py-3 px-4">Equipment & Warranty</th>
                  <th className="py-3 px-4">Status & SLA</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Ticket # */}
                    <td className="py-3 px-4 font-mono font-semibold text-midnight">
                      <Link
                        to={`/tickets/${t.id}`}
                        className="text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1.5"
                      >
                        <LifeBuoy className="w-3.5 h-3.5 text-solar-gold" />
                        <span>{t.ticket_number}</span>
                      </Link>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4">
                      {getPriorityBadge(t.priority)}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {t.customers?.full_name || 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.customers?.phone_e164 || ''}
                      </div>
                    </td>

                    {/* Reported Issue */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="line-clamp-2 text-slate-700">
                        {t.reported_issue}
                      </div>
                      <span className="inline-block mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        {t.category.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Equipment & Warranty */}
                    <td className="py-3 px-4">
                      {t.serial_numbers ? (
                        <div>
                          <div className="font-mono text-[11px] font-semibold text-midnight">
                            {t.serial_numbers.serial_number}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {t.serial_numbers.products?.model_name || t.serial_numbers.products?.brand || 'Solar Hardware'}
                          </div>
                          {t.warranties && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 mt-0.5">
                              <ShieldCheck className="w-3 h-3" /> Active Warranty
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">General Solar Plant</span>
                      )}
                    </td>

                    {/* Status & SLA */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(t.status)}
                      </div>
                      <div className="mt-1">
                        {getSlaStatus(t.sla_due_date, t.status)}
                      </div>
                    </td>

                    {/* Technician */}
                    <td className="py-3 px-4">
                      {t.users_service_tickets_assigned_technician_idTousers ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">
                            {t.users_service_tickets_assigned_technician_idTousers.full_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-medium">Unassigned</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 text-midnight hover:bg-slate-100 transition-colors"
                      >
                        <span>Manage</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing {tickets.length} of {pagination.total} service tickets
            </span>
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* 5. "Log Service Ticket" Modal */}
      {isLogModalOpen && (
        <Modal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          title="Log Customer Service Incident"
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleCreateTicket} className="p-6 space-y-4 text-xs">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Customer Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Customer <span className="text-rose-500">*</span>
              </label>
              <select
                value={newTicketForm.customer_id}
                onChange={(e) => {
                  setNewTicketForm({ ...newTicketForm, customer_id: e.target.value });
                  setClaimVerification(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
                required
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone_e164}) — {c.customer_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Serial Number & Instant Warranty Verification */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Equipment Serial Number (Optional, for Inverter/Module breakdown)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. SN-INV-AHM-250488-01 or Product SKU (e.g. INV-GROWATT-5KW-1P)"
                    value={newTicketForm.serial_number}
                    onChange={(e) => {
                      setNewTicketForm({ ...newTicketForm, serial_number: e.target.value });
                      setClaimVerification(null);
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40 font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerifyClaim}
                  disabled={!newTicketForm.serial_number.trim() || verifyingClaim}
                  className="whitespace-nowrap flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {verifyingClaim ? 'Checking...' : 'Check Warranty'}
                </Button>
              </div>

              {/* Instant Claim Verification Pill / Alert */}
              {claimVerification && (
                <div className={`mt-2 p-3 rounded-lg border ${
                  claimVerification.is_valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {claimVerification.is_valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{claimVerification.message}</div>
                      {claimVerification.warranty && (
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          Certificate: <span className="font-mono font-bold">{claimVerification.warranty.warranty_certificate_number}</span> (Expires {new Date(claimVerification.warranty.end_date).toLocaleDateString()})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Category & Priority Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Category</label>
                <select
                  value={newTicketForm.category}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
                >
                  <option value="INVERTER_FAULT">Inverter Fault / Error Code</option>
                  <option value="LOW_GENERATION">Low Generation / Shading</option>
                  <option value="GRID_TRIP">Grid Trip / Sync Failure</option>
                  <option value="PHYSICAL_DAMAGE">Physical Damage / Storm</option>
                  <option value="ROUTINE_AMC">Routine AMC Maintenance</option>
                  <option value="WIRING_ISSUE">Wiring & Earthing Issue</option>
                  <option value="OTHER">Other Query</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Priority / SLA Target</label>
                <select
                  value={newTicketForm.priority}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
                >
                  <option value="CRITICAL">Critical (24h SLA — Complete Outage)</option>
                  <option value="HIGH">High (48h SLA — Major Performance Loss)</option>
                  <option value="MEDIUM">Medium (72h SLA — Standard)</option>
                  <option value="LOW">Low (7 Days — Cosmetic / Query)</option>
                </select>
              </div>
            </div>

            {/* Reported Issue */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reported Issue Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Describe fault symptoms, inverter error codes, generation deficit, or customer remarks..."
                value={newTicketForm.reported_issue}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, reported_issue: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40 text-xs"
                required
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLogModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submittingTicket}
                className="flex items-center gap-1.5"
              >
                <LifeBuoy className="w-4 h-4" />
                {submittingTicket ? 'Logging Ticket...' : 'Create Ticket'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default ServiceTicketsPage;
