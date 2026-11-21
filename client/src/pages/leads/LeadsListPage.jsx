import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Phone,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Zap,
  Building,
  X
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

const STAGES = [
  'ALL',
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SURVEY_SCHEDULED',
  'SURVEY_APPROVED',
  'QUOTATION_SENT',
  'NEGOTIATION',
  'WON',
  'LOST'
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

export function LeadsListPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Direct Schedule Survey Modal State
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [selectedLeadForSurvey, setSelectedLeadForSurvey] = useState(null);
  const [engineers, setEngineers] = useState([]);
  const [surveyFormData, setSurveyFormData] = useState({
    assigned_engineer_id: '',
    scheduled_at: '',
    notes: ''
  });
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyError, setSurveyError] = useState('');
  const [surveySuccess, setSurveySuccess] = useState('');

  // Form State for Create Lead
  const [formData, setFormData] = useState({
    full_name: '',
    phone_e164: '',
    email: '',
    source: 'MANUAL',
    monthly_electricity_bill: '',
    requested_capacity_kw: '',
    system_type: 'ON_GRID',
    site_address: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380001',
    notes: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const query = {
        page,
        limit,
        sort_by: 'created_at',
        sort_order: 'DESC'
      };
      if (selectedStage !== 'ALL') query.stage = selectedStage;
      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();

      const res = await api.get('/crm/leads', query);
      setLeads(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedStage, debouncedSearch]);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedStage]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Live duplicate check on phone input
  const handlePhoneBlur = async () => {
    const phone = formData.phone_e164.trim();
    if (phone.length >= 10) {
      try {
        const res = await api.get('/crm/leads/duplicates/check', { phone });
        if (res?.data?.has_duplicates) {
          setDuplicateWarning(res.data);
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        setDuplicateWarning(null);
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const payload = {
        ...formData,
        monthly_electricity_bill: formData.monthly_electricity_bill ? Number(formData.monthly_electricity_bill) : undefined,
        requested_capacity_kw: formData.requested_capacity_kw ? Number(formData.requested_capacity_kw) : undefined
      };

      await api.post('/crm/leads', payload);
      setShowCreateModal(false);
      // Reset form
      setFormData({
        full_name: '',
        phone_e164: '',
        email: '',
        source: 'MANUAL',
        monthly_electricity_bill: '',
        requested_capacity_kw: '',
        system_type: 'ON_GRID',
        site_address: '',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380001',
        notes: ''
      });
      setDuplicateWarning(null);
      fetchLeads();
    } catch (err) {
      setFormError(err.message || 'Failed to create lead.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Direct Schedule Survey Modal for Lead
  const handleOpenSurveyModal = async (lead) => {
    setSelectedLeadForSurvey(lead);
    setSurveyFormData({
      assigned_engineer_id: lead.assigned_to || '',
      scheduled_at: '',
      notes: lead.site_address ? `Site Address: ${lead.site_address}` : ''
    });
    setSurveyError('');
    setShowSurveyModal(true);

    if (engineers.length === 0) {
      try {
        const res = await api.get('/users', { limit: 100 });
        setEngineers(res?.data || []);
      } catch (err) {
        console.error('Failed to load engineers:', err);
      }
    }
  };

  // Submit Direct Schedule Survey
  const handleScheduleSurveySubmit = async (e) => {
    e.preventDefault();
    setSurveyError('');

    if (new Date(surveyFormData.scheduled_at).getTime() < Date.now() - 5 * 60 * 1000) {
      setSurveyError('Survey scheduled date and time cannot be in the past. Please select today or a future date.');
      return;
    }

    setSurveySubmitting(true);
    try {
      await api.post('/surveys', {
        lead_id: selectedLeadForSurvey.id,
        assigned_engineer_id: surveyFormData.assigned_engineer_id,
        scheduled_at: new Date(surveyFormData.scheduled_at).toISOString(),
        notes: surveyFormData.notes
      });

      setShowSurveyModal(false);
      setSurveySuccess(`Site survey scheduled successfully for ${selectedLeadForSurvey.full_name} (${selectedLeadForSurvey.lead_number})!`);
      setTimeout(() => setSurveySuccess(''), 6000);
      fetchLeads();
    } catch (err) {
      setSurveyError(err.message || 'Failed to schedule site survey.');
    } finally {
      setSurveySubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {surveySuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{surveySuccess}</span>
          </div>
          <button
            onClick={() => setSurveySuccess('')}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
            <Layers className="w-6 h-6 text-solar-gold" />
            CRM & Lead Pipeline
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Capture, qualify, schedule surveys, and convert rooftop solar enquiries.
          </p>
        </div>
        <Button variant="accent" icon={Plus} onClick={() => setShowCreateModal(true)}>
          New Lead Enquiry
        </Button>
      </div>

      {/* Search & Pipeline Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads by customer name, phone number (+91), or lead number (LEAD-2026-...)..."
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

        {/* Pipeline Stage Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedStage}
            onChange={(e) => {
              setSelectedStage(e.target.value);
              setPage(1);
            }}
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 focus:ring-2 focus:ring-midnight outline-none bg-white w-full sm:w-auto cursor-pointer"
          >
            <option value="ALL">All Pipeline Stages</option>
            <option value="NEW">New Enquiries</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="SURVEY_SCHEDULED">Survey Scheduled</option>
            <option value="SURVEY_APPROVED">Survey Approved</option>
            <option value="QUOTATION_SENT">Quotation Sent</option>
            <option value="NEGOTIATION">Under Negotiation</option>
            <option value="WON">Won (Order Confirmed)</option>
            <option value="LOST">Lost / Disqualified</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Lead #</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Phone / City</th>
                <th className="py-3.5 px-4">Capacity (kW)</th>
                <th className="py-3.5 px-4">Monthly Bill</th>
                <th className="py-3.5 px-4">Stage</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Loading leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-xs text-midnight">
                      {lead.lead_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <Link to={`/leads/${lead.id}`} className="hover:text-solar-gold hover:underline">
                        {lead.full_name}
                      </Link>
                      <span className="block text-[11px] text-slate-400 font-normal">
                        Source: {lead.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      <div>{lead.phone_e164}</div>
                      <div className="text-[11px] text-slate-400 font-sans">{lead.city || 'Gujarat'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-midnight">
                      {lead.requested_capacity_kw ? `${lead.requested_capacity_kw} kW` : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {lead.monthly_electricity_bill ? `₹${Number(lead.monthly_electricity_bill).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={lead.stage}>{lead.stage}</Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="accent"
                          size="sm"
                          icon={Calendar}
                          onClick={() => handleOpenSurveyModal(lead)}
                          className="text-xs font-semibold whitespace-nowrap shadow-none"
                        >
                          Schedule Survey
                        </Button>
                        <Link to={`/leads/${lead.id}`}>
                          <Button variant="outline" size="sm" icon={ChevronRight} className="text-xs">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Robust Pagination Controls Bar */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <strong className="text-slate-900 font-semibold font-mono">
                {pagination.total === 0 ? 0 : (page - 1) * limit + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900 font-semibold font-mono">
                {Math.min(page * limit, pagination.total)}
              </strong>{' '}
              of{' '}
              <strong className="text-slate-900 font-semibold font-mono">{pagination.total}</strong> leads
            </span>

            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
              <span className="text-slate-500">Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-0.5 border border-slate-300 rounded bg-white text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-midnight"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="px-2.5 py-1 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(5, pagination.totalPages || 1) }, (_, i) => {
                let pageNum = i + 1;
                if (pagination.totalPages > 5) {
                  if (page > 3 && page < pagination.totalPages - 1) {
                    pageNum = page - 2 + i;
                  } else if (page >= pagination.totalPages - 1) {
                    pageNum = pagination.totalPages - 4 + i;
                  }
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 rounded-md font-mono text-xs font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-midnight text-white font-bold'
                        : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))}
              className="px-2.5 py-1 text-xs"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create Lead Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Capture New Solar Lead"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice: Existing record detected with this phone number</p>
                <p className="mt-0.5 text-amber-700">
                  {duplicateWarning.existing_customer
                    ? `Matches existing customer account ${duplicateWarning.existing_customer.customer_code} (${duplicateWarning.existing_customer.full_name}).`
                    : `Found ${duplicateWarning.matching_leads.length} existing lead(s) with this number.`}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ramesh Patel"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mobile Number (E.164) *
              </label>
              <input
                type="text"
                required
                value={formData.phone_e164}
                onChange={(e) => setFormData({ ...formData, phone_e164: e.target.value })}
                onBlur={handlePhoneBlur}
                placeholder="9825012345 or +919825012345"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Acquisition Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none bg-white"
              >
                <option value="WEBSITE">Website Enquiry</option>
                <option value="WHATSAPP">WhatsApp Inbound</option>
                <option value="PHONE">Phone Call</option>
                <option value="WALK_IN">Walk In</option>
                <option value="REFERRAL">Customer Referral</option>
                <option value="MANUAL">Manual Entry</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Requested Capacity (kW)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={formData.requested_capacity_kw}
                onChange={(e) => setFormData({ ...formData, requested_capacity_kw: e.target.value })}
                placeholder="5.0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Monthly Electricity Bill (₹)
              </label>
              <input
                type="number"
                min="0"
                value={formData.monthly_electricity_bill}
                onChange={(e) => setFormData({ ...formData, monthly_electricity_bill: e.target.value })}
                placeholder="4500"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                System Type
              </label>
              <select
                value={formData.system_type}
                onChange={(e) => setFormData({ ...formData, system_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none bg-white"
              >
                <option value="ON_GRID">On-Grid (Subsidy)</option>
                <option value="OFF_GRID">Off-Grid (Battery)</option>
                <option value="HYBRID">Hybrid System</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Rooftop Site Address
            </label>
            <input
              type="text"
              value={formData.site_address}
              onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
              placeholder="House/Plot number, Society/Road name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Preferences</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Inquired about PM Surya Ghar 3kW rooftop scheme"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={formSubmitting}>
              Save Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* Direct Schedule Site Survey Modal */}
      <Modal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        title="Schedule Rooftop Site Survey"
        maxWidth="max-w-xl"
      >
        {selectedLeadForSurvey && (
          <form onSubmit={handleScheduleSurveySubmit} className="space-y-4">
            {/* Selected Lead Summary Header */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm">{selectedLeadForSurvey.full_name}</span>
                <span className="font-mono text-midnight bg-slate-200/70 px-2 py-0.5 rounded font-semibold text-[11px]">
                  {selectedLeadForSurvey.lead_number}
                </span>
              </div>
              <div className="text-slate-500 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                <span>📞 {selectedLeadForSurvey.phone_e164}</span>
                {selectedLeadForSurvey.city && <span>📍 {selectedLeadForSurvey.city}</span>}
                {selectedLeadForSurvey.requested_capacity_kw && (
                  <span>⚡ {selectedLeadForSurvey.requested_capacity_kw} kW ({selectedLeadForSurvey.system_type})</span>
                )}
              </div>
              {selectedLeadForSurvey.site_address && (
                <div className="text-slate-600 font-sans border-t border-slate-200/60 pt-1.5 mt-1 text-[11px]">
                  <span className="text-slate-400 font-medium">Site Address:</span> {selectedLeadForSurvey.site_address}
                </div>
              )}
            </div>

            {surveyError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {surveyError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assign Field Engineer *
              </label>
              <select
                required
                value={surveyFormData.assigned_engineer_id}
                onChange={(e) => setSurveyFormData({ ...surveyFormData, assigned_engineer_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-midnight focus:outline-none"
              >
                <option value="">Select Field Engineer...</option>
                {engineers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.roles?.join(', ') || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scheduled Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                min={getMinDateTimeLocal()}
                value={surveyFormData.scheduled_at}
                onChange={(e) => setSurveyFormData({ ...surveyFormData, scheduled_at: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Site Access & Special Instructions
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Terrace access via internal stairs. Customer available 10 AM - 1 PM. Ladder required..."
                value={surveyFormData.notes}
                onChange={(e) => setSurveyFormData({ ...surveyFormData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-midnight focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={() => setShowSurveyModal(false)}>
                Cancel
              </Button>
              <Button variant="accent" type="submit" loading={surveySubmitting}>
                Confirm & Schedule Survey
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default LeadsListPage;
