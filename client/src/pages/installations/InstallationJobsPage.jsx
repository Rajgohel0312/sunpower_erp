import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Users,
  Building,
  Zap,
  ArrowRight,
  ShieldCheck,
  MapPin,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

const JOB_STATUSES = [
  'ALL',
  'ASSIGNED',
  'EN_ROUTE',
  'ON_SITE',
  'STRUCTURE_COMPLETE',
  'PANELS_MOUNTED',
  'WIRING_COMPLETE',
  'TESTING_IN_PROGRESS',
  'COMMISSIONED',
  'BLOCKED'
];

export function InstallationJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Pagination
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Schedule Job Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Reference Datasets
  const [orders, setOrders] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedDispatchId, setSelectedDispatchId] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  // Auto-fetch & Auto-fill State
  const [searchParams] = useSearchParams();
  const urlOrderId = searchParams.get('order_id');
  const [autoFillMessage, setAutoFillMessage] = useState('');

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setAutoFillMessage('');
      return;
    }

    // 1. Auto-connect with linked dispatch if already created
    const matchedDispatch = dispatches.find(
      (d) => d.sales_orders?.id === orderId || d.sales_order_id === orderId
    );
    if (matchedDispatch) {
      setSelectedDispatchId(matchedDispatch.id);
    }

    // 2. Auto-initialize schedule window if empty (tomorrow 09:00 to 18:00)
    if (!scheduledStart) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      setScheduledStart(`${dateStr}T09:00`);
      setScheduledEnd(`${dateStr}T18:00`);
    }

    // 3. Pre-select first field engineer/technician if available and empty
    if (!teamLeadId && staffUsers.length > 0) {
      setTeamLeadId(staffUsers[0].id);
    }

    const matchedOrder = orders.find((o) => o.id === orderId);
    setAutoFillMessage(
      matchedDispatch
        ? `Connected with ${matchedOrder?.order_number || 'Order'} and linked Dispatch ${matchedDispatch.dispatch_number}`
        : `Connected with ${matchedOrder?.order_number || 'Order'} • Initialized 9:00 AM installation schedule`
    );
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await api.get('/installations', params);
      setJobs(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res?.meta?.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch installation jobs');
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const loadReferenceData = async () => {
    try {
      const [ordersRes, dispRes, usersRes] = await Promise.all([
        api.get('/orders', { limit: 100 }),
        api.get('/dispatches', { limit: 100 }),
        api.get('/users', { limit: 100 })
      ]);
      setOrders(ordersRes?.data || []);
      setDispatches(dispRes?.data || []);
      setStaffUsers(usersRes?.data || []);
    } catch (err) {
      console.error('Failed to load reference datasets:', err);
    }
  };

  const handleOpenScheduleModal = () => {
    loadReferenceData();
    setSelectedOrderId('');
    setSelectedDispatchId('');
    setTeamLeadId('');
    setScheduledStart('');
    setScheduledEnd('');
    setFormError('');
    setAutoFillMessage('');
    setShowScheduleModal(true);
  };

  useEffect(() => {
    if (urlOrderId) {
      loadReferenceData().then(() => {
        setShowScheduleModal(true);
        handleSelectOrder(urlOrderId);
      });
    }
  }, [urlOrderId]);

  // Formatted Options for SearchableSelect
  const orderOptions = useMemo(() => {
    return orders.map((o) => ({
      value: o.id,
      label: `${o.order_number} — ${o.customers?.full_name || 'Customer'}`,
      subtitle: `${o.system_capacity_kw} kW • Status: ${o.status}`,
      badge: o.status,
      badgeVariant: o.status === 'DISPATCHED' ? 'success' : 'info',
      searchTerms: `${o.order_number} ${o.customers?.full_name}`
    }));
  }, [orders]);

  const dispatchOptions = useMemo(() => {
    return [
      { value: '', label: 'None (Direct / Self Logistics)' },
      ...dispatches.map((d) => ({
        value: d.id,
        label: `${d.dispatch_number} (${d.vehicle_number || 'Truck'})`,
        subtitle: `Order: ${d.sales_orders?.order_number || ''} • Status: ${d.status}`,
        badge: d.status,
        badgeVariant: d.status === 'DELIVERED' ? 'success' : 'warning',
        searchTerms: `${d.dispatch_number} ${d.vehicle_number}`
      }))
    ];
  }, [dispatches]);

  const teamLeadOptions = useMemo(() => {
    return staffUsers.map((u) => ({
      value: u.id,
      label: u.full_name,
      subtitle: `Roles: ${u.roles?.join(', ') || 'Staff'} • ${u.phone_e164 || ''}`,
      searchTerms: `${u.full_name} ${u.email || ''}`
    }));
  }, [staffUsers]);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedOrderId) {
      setFormError('Please select a confirmed Sales Order');
      return;
    }
    if (!scheduledStart) {
      setFormError('Please choose scheduled start date and time');
      return;
    }

    const startTime = new Date(scheduledStart).getTime();
    if (isNaN(startTime) || startTime < Date.now() - 5 * 60 * 1000) {
      setFormError('Scheduled start date and time cannot be in the past. Please select today or a future date/time.');
      return;
    }

    if (scheduledEnd && new Date(scheduledEnd).getTime() < startTime) {
      setFormError('Target completion date/time must be after or equal to the scheduled start date/time.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sales_order_id: selectedOrderId,
        dispatch_id: selectedDispatchId || undefined,
        team_lead_id: teamLeadId || undefined,
        scheduled_start: new Date(scheduledStart).toISOString(),
        scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
        technicians: teamLeadId
          ? [{ technician_id: teamLeadId, role_in_team: 'TEAM_LEAD' }]
          : []
      };

      const res = await api.post('/installations', payload);
      setSuccess(`Installation Job ${res.data.job_number} scheduled successfully with 8-step verification checklist!`);
      setShowScheduleModal(false);
      fetchJobs();
    } catch (err) {
      setFormError(err.message || 'Failed to schedule installation job');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'COMMISSIONED':
        return 'success';
      case 'ON_SITE':
      case 'STRUCTURE_COMPLETE':
      case 'PANELS_MOUNTED':
      case 'WIRING_COMPLETE':
      case 'TESTING_IN_PROGRESS':
        return 'info';
      case 'ASSIGNED':
      case 'EN_ROUTE':
        return 'warning';
      case 'BLOCKED':
      case 'CANCELLED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const kpis = useMemo(() => {
    const total = pagination.total || jobs.length;
    const active = jobs.filter((j) => !['COMMISSIONED', 'CANCELLED'].includes(j.status)).length;
    const commissioned = jobs.filter((j) => j.status === 'COMMISSIONED').length;
    const blocked = jobs.filter((j) => j.status === 'BLOCKED').length;
    return { total, active, commissioned, blocked };
  }, [jobs, pagination]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight tracking-tight">Installation Jobs & Field Commissioning</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch installation crews, verify mandatory technical checklists, inspect geotagged evidence, and capture customer digital sign-off.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenScheduleModal}>
          Schedule Job
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-midnight/5 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-midnight" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Installations</div>
            <div className="text-xl font-bold font-mono text-slate-900">{kpis.total}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-sky-600 animate-pulse" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">In Progress</div>
            <div className="text-xl font-bold font-mono text-sky-600">{kpis.active}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Commissioned</div>
            <div className="text-xl font-bold font-mono text-emerald-600">{kpis.commissioned}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Blocked / Escalated</div>
            <div className="text-xl font-bold font-mono text-rose-600">{kpis.blocked}</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-2">✕</button>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search JOB#, customer, order, team lead..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-midnight outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none font-medium text-slate-700"
          >
            {JOB_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st === 'ALL' ? 'All Installation Stages' : st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Installation Jobs List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Clock className="w-6 h-6 animate-spin text-midnight" />
            Loading installation jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No installation jobs found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Job #</th>
                  <th className="px-4 py-3">Sales Order & Customer</th>
                  <th className="px-4 py-3">System Size</th>
                  <th className="px-4 py-3">Field Team Lead</th>
                  <th className="px-4 py-3">Scheduled Date</th>
                  <th className="px-4 py-3">Execution Stage</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Job # */}
                    <td className="px-4 py-3 font-mono font-bold text-midnight whitespace-nowrap">
                      <Link
                        to={`/installations/${j.id}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        <Wrench className="w-3.5 h-3.5 text-solar-gold" />
                        {j.job_number}
                      </Link>
                    </td>

                    {/* Sales Order & Customer */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {j.sales_orders?.customers?.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {j.sales_orders?.order_number}
                      </div>
                    </td>

                    {/* System Size */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      ⚡ {j.sales_orders?.system_capacity_kw} kW
                    </td>

                    {/* Team Lead */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {j.users?.full_name || 'Unassigned'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {j.installation_technicians?.length || 0} crew assigned
                      </div>
                    </td>

                    {/* Scheduled Date */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                      {new Date(j.scheduled_start).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(j.status)}>
                        {j.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>

                    {/* Action Link */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to={`/installations/${j.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-midnight hover:text-solar-gold transition-colors"
                      >
                        Inspect & Execute &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <Pagination
          page={page}
          limit={limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
          entityLabel="jobs"
        />
      </div>

      {/* Schedule Installation Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Rooftop Solar Installation Crew"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <SearchableSelect
              required
              label="Select Confirmed Sales Order *"
              options={orderOptions}
              value={selectedOrderId}
              onChange={(val) => handleSelectOrder(val)}
              placeholder="Search sales order..."
              searchPlaceholder="Filter orders by order number or customer..."
            />
          </div>

          {autoFillMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{autoFillMessage}</span>
            </div>
          )}

          <div>
            <SearchableSelect
              label="Linked Material Dispatch (Optional)"
              options={dispatchOptions}
              value={selectedDispatchId}
              onChange={(val) => setSelectedDispatchId(val)}
              placeholder="Select delivery dispatch..."
              searchPlaceholder="Filter dispatches by truck or number..."
            />
          </div>

          <div>
            <SearchableSelect
              required
              label="Assign Field Team Lead / Lead Electrician *"
              options={teamLeadOptions}
              value={teamLeadId}
              onChange={(val) => setTeamLeadId(val)}
              placeholder="Choose team lead..."
              searchPlaceholder="Search staff by name or role..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Start Date & Time *</label>
              <input
                type="datetime-local"
                required
                min={new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 16)}
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Completion Date & Time</label>
              <input
                type="datetime-local"
                min={scheduledStart || new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 16)}
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <span className="font-semibold flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-amber-600" />
              Automated 8-Step Technical Verification Checklist
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Upon job creation, the engineering engine automatically initializes mandatory checks (structure torque, cold Voc, dual chemical earthing, inverter phase sync, and net meter test) required for commissioning sign-off.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Schedule Job & Team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default InstallationJobsPage;
