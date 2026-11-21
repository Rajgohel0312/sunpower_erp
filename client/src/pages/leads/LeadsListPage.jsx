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
  Zap,
  Building,
  X
} from 'lucide-react';
import { api } from '../../api/client.js';
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

export function LeadsListPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const fetchLeads = useCallback(async (stage = selectedStage, searchQuery = search) => {
    setLoading(true);
    try {
      const query = {
        limit: 50,
        sort_by: 'created_at',
        sort_order: 'DESC'
      };
      if (stage !== 'ALL') query.stage = stage;
      if (searchQuery && searchQuery.trim()) query.search = searchQuery.trim();

      const res = await api.get('/crm/leads', query);
      setLeads(res?.data || []);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStage, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads(selectedStage, search);
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedStage, search, fetchLeads]);

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

  return (
    <div className="space-y-6">
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

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        {/* Stage Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {STAGES.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStage(st)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedStage === st
                  ? 'bg-midnight text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads by customer name, phone number (+91), or lead number (LEAD-2026-...)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-midnight"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
                <th className="py-3.5 px-4 text-right">Action</th>
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
                      <Link to={`/leads/${lead.id}`}>
                        <Button variant="outline" size="sm" icon={ChevronRight}>
                          Manage
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    </div>
  );
}

export default LeadsListPage;
