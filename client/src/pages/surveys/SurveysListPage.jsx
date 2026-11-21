import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardCheck, Plus, Search, Calendar, User, 
  ChevronRight, MapPin, Zap, CheckCircle2, AlertCircle, X, Filter
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

const SURVEY_STATUSES = [
  'ALL',
  'SCHEDULED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REVISION_REQUIRED'
];

const getMinDateTimeLocal = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function SurveysListPage() {
  const [surveys, setSurveys] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [formData, setFormData] = useState({
    lead_id: '',
    assigned_engineer_id: '',
    scheduled_at: '',
    notes: ''
  });

  const leadOptions = useMemo(() => {
    return leads.map((l) => ({
      value: l.id,
      label: l.full_name,
      subtitle: `${l.phone_e164} • ${l.lead_number}${l.site_address ? ` • ${l.site_address}` : ''}`,
      badge: l.stage,
      badgeVariant: l.stage === 'QUALIFIED' ? 'success' : 'neutral',
      searchTerms: `${l.full_name} ${l.phone_e164} ${l.lead_number} ${l.stage} ${l.site_address || ''}`
    }));
  }, [leads]);

  const engineerOptions = useMemo(() => {
    return engineers.map((u) => ({
      value: u.id,
      label: u.full_name,
      subtitle: u.email || '',
      badge: u.roles?.join(', ') || 'Staff',
      badgeVariant: 'info',
      searchTerms: `${u.full_name} ${u.email || ''} ${u.roles?.join(' ') || ''}`
    }));
  }, [engineers]);

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (statusFilter !== 'ALL') query.status = statusFilter;
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();

      const res = await api.get('/surveys', query);
      setSurveys(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load surveys:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, debouncedSearch]);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  // Load leads and engineers for modal
  const handleOpenScheduleModal = async () => {
    setShowScheduleModal(true);
    setFormError('');
    try {
      const [leadsRes, usersRes] = await Promise.all([
        api.get('/crm/leads', { limit: 100 }),
        api.get('/users', { limit: 100 })
      ]);
      setLeads(leadsRes?.data || []);
      setEngineers(usersRes?.data || []);
    } catch (err) {
      console.error('Failed to load modal options:', err);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (new Date(formData.scheduled_at).getTime() < Date.now() - 5 * 60 * 1000) {
      setFormError('Survey scheduled date and time cannot be in the past. Please select today or a future date.');
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/surveys', {
        lead_id: formData.lead_id,
        assigned_engineer_id: formData.assigned_engineer_id,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
        notes: formData.notes
      });

      setShowScheduleModal(false);
      setFormData({
        lead_id: '',
        assigned_engineer_id: '',
        scheduled_at: '',
        notes: ''
      });
      fetchSurveys(statusFilter, search);
    } catch (err) {
      setFormError(err.message || 'Failed to schedule survey.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">APPROVED</Badge>;
      case 'SUBMITTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">SUBMITTED</span>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">IN PROGRESS</Badge>;
      case 'REVISION_REQUIRED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">REVISION</span>;
      default:
        return <Badge variant="info">SCHEDULED</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-solar-gold" />
            Site Surveys & Rooftop Engineering
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Assign engineers, capture rooftop measurements, review feasibility, and size engineering BOMs.
          </p>
        </div>
        <Button variant="accent" icon={Plus} onClick={handleOpenScheduleModal}>
          Schedule Site Survey
        </Button>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search surveys by survey number (SRV-2026-...), customer name, or phone (+91)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-midnight bg-slate-50/50 focus:bg-white transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 focus:ring-2 focus:ring-midnight outline-none bg-white w-full sm:w-auto cursor-pointer"
          >
            <option value="ALL">All Survey Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted for Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REVISION_REQUIRED">Revision Required</option>
          </select>
        </div>
      </div>

      {/* Surveys Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Survey ID</th>
                <th className="py-3.5 px-4">Linked Lead / Prospect</th>
                <th className="py-3.5 px-4">Assigned Engineer</th>
                <th className="py-3.5 px-4">Proposed System</th>
                <th className="py-3.5 px-4">Scheduled Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Loading site surveys...
                  </td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No site surveys found matching current criteria.
                  </td>
                </tr>
              ) : (
                surveys.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-midnight">
                      {srv.survey_number}
                    </td>
                    <td className="py-3.5 px-4">
                      {srv.leads ? (
                        <div>
                          <div className="font-semibold text-slate-900">{srv.leads.full_name}</div>
                          <div className="font-mono text-xs text-slate-500">{srv.leads.phone_e164}</div>
                        </div>
                      ) : srv.customers ? (
                        <div>
                          <div className="font-semibold text-slate-900">{srv.customers.full_name}</div>
                          <div className="font-mono text-xs text-slate-500">{srv.customers.customer_code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned entity</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {srv.engineer?.full_name || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {srv.proposed_capacity_kw ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-midnight">{srv.proposed_capacity_kw} kW</span>
                            {srv.boms_count > 0 ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                BOM Sized
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100">
                                Pending BOM
                              </span>
                            )}
                          </div>
                          <span className="block text-[11px] text-slate-500 font-sans mt-0.5">{srv.roof_type?.replace(/_/g, ' ') || 'Roof TBD'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Specs pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {new Date(srv.scheduled_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(srv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link to={`/surveys/${srv.id}`}>
                        <Button variant={srv.boms_count > 0 ? 'accent' : 'outline'} size="sm" icon={ChevronRight}>
                          {srv.boms_count > 0 ? 'Survey & BOM' : 'Start Sizing'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Surveys Pagination Controls */}
        <Pagination
          page={page}
          limit={limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          entityLabel="surveys"
        />
      </div>

      {/* Schedule Survey Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Rooftop Site Survey"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <SearchableSelect
              required
              label="Select Lead / Prospect *"
              options={leadOptions}
              value={formData.lead_id}
              onChange={(val) => setFormData((prev) => ({ ...prev, lead_id: val }))}
              placeholder="Search by name, phone, or lead number..."
              searchPlaceholder="Filter leads by name, phone, lead ID, stage..."
              emptyMessage="No matching leads found"
            />
          </div>

          <div>
            <SearchableSelect
              required
              label="Assign Survey Engineer *"
              options={engineerOptions}
              value={formData.assigned_engineer_id}
              onChange={(val) => setFormData((prev) => ({ ...prev, assigned_engineer_id: val }))}
              placeholder="Search field engineers..."
              searchPlaceholder="Filter engineers by name or role..."
              emptyMessage="No matching engineers found"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              required
              min={getMinDateTimeLocal()}
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Site Access Notes & Instructions</label>
            <textarea
              rows={3}
              placeholder="e.g. Roof access via internal stairs. Customer available between 11 AM - 1 PM..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Schedule Survey
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
export default SurveysListPage;
