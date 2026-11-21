import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  ChevronRight,
  Filter,
  X,
  Zap,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

const QUOTATION_STATUSES = [
  'ALL',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED'
];

export function QuotationsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quotations, setQuotations] = useState([]);
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBoms, setLoadingBoms] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Create Quotation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    bom_id: '',
    discount_amount: 0,
    commercial_terms: 'Standard 25-Year Performance Warranty on PV Modules, 5-Year Comprehensive Inverter Warranty.'
  });

  const bomOptions = useMemo(() => {
    return boms.map((b) => {
      const clientName = b.leads?.full_name || b.customers?.full_name || 'Rooftop Site Survey';
      const capacity = Number(b.system_capacity_kw) || 0;
      const cost = Number(b.total_cost || 0).toLocaleString('en-IN');
      const leadNum = b.leads?.lead_number || b.customers?.customer_code || '';
      return {
        value: b.id,
        label: `${b.bom_number} — ${clientName}`,
        subtitle: `${capacity} kWp System • ₹${cost}${leadNum ? ` • ${leadNum}` : ''}`,
        badge: b.status,
        badgeVariant: b.status === 'APPROVED' ? 'success' : 'neutral',
        searchTerms: `${b.bom_number} ${clientName} ${capacity} ${cost} ${leadNum} ${b.status}`
      };
    });
  }, [boms]);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (statusFilter !== 'ALL') query.status = statusFilter;

      const res = await api.get('/quotations', query);
      setQuotations(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // Load eligible BOMs when modal opens
  const handleOpenCreateModal = useCallback(async (preferredBomId = null) => {
    setFormError('');
    setShowCreateModal(true);
    setLoadingBoms(true);
    try {
      const res = await api.get('/boms');
      const bomList = res?.data || [];
      setBoms(bomList);
      if (bomList.length > 0) {
        const found = preferredBomId ? bomList.find(b => b.id === preferredBomId) : null;
        setFormData((prev) => ({
          ...prev,
          bom_id: found ? found.id : (preferredBomId || bomList[0].id)
        }));
      }
    } catch (e) {
      console.warn('Could not load BOMs for quotation generation:', e.message);
      setFormError('Failed to load eligible BOMs. Please ensure you have generated an engineering BOM.');
    } finally {
      setLoadingBoms(false);
    }
  }, []);

  const handleCloseModal = () => {
    setShowCreateModal(false);
    if (searchParams.get('create') || searchParams.get('bom_id')) {
      setSearchParams({}, { replace: true });
    }
  };

  // Handle URL query parameters (e.g. ?create=true&bom_id=...)
  useEffect(() => {
    const bomIdFromUrl = searchParams.get('bom_id');
    const createRequested = searchParams.get('create') === 'true' || Boolean(bomIdFromUrl);
    if (createRequested && !showCreateModal) {
      handleOpenCreateModal(bomIdFromUrl);
    }
  }, [searchParams, handleOpenCreateModal, showCreateModal]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bom_id) {
      setFormError('Please select an Engineering BOM to generate quotation');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const selectedBom = boms.find((b) => b.id === formData.bom_id);
      await api.post('/quotations', {
        bom_id: formData.bom_id,
        lead_id: selectedBom?.lead_id || undefined,
        customer_id: selectedBom?.customer_id || undefined,
        survey_id: selectedBom?.survey_id || undefined,
        discount_amount: Number(formData.discount_amount) || 0,
        commercial_terms: formData.commercial_terms
      });
      setShowCreateModal(false);
      fetchQuotations();
    } catch (err) {
      setFormError(err.message || 'Failed to generate quotation proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral">Draft</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Approved</Badge>;
      case 'SENT':
        return <Badge variant="info">Proposal Sent</Badge>;
      case 'ACCEPTED':
        return <Badge variant="success">Accepted</Badge>;
      case 'CONVERTED':
        return <Badge variant="success">Converted to Order</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'EXPIRED':
        return <Badge variant="neutral">Expired</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
            <FileText className="w-6 h-6 text-solar-gold" />
            Quotations & Proposals
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Commercial solar proposals, 70:30 GST calculations, PM Surya Ghar central subsidies, and customer contracts.
          </p>
        </div>
        <Button variant="accent" icon={Plus} onClick={handleOpenCreateModal}>
          Generate Quotation
        </Button>
      </div>

      {/* Standard Single-Row Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Full-width Search Input with Clear Button */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotations by QT number, customer name, phone, or code..."
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

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 focus:ring-2 focus:ring-midnight outline-none bg-white w-full sm:w-auto cursor-pointer"
          >
            {QUOTATION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st === 'ALL' ? 'All Proposal Statuses' : st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Quotation #</th>
                <th className="py-3.5 px-4">Customer / Prospect</th>
                <th className="py-3.5 px-4">Capacity</th>
                <th className="py-3.5 px-4">Gross Value</th>
                <th className="py-3.5 px-4">PM Surya Ghar Subsidy</th>
                <th className="py-3.5 px-4">Net Customer Payable</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    Loading commercial quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No quotations found matching current filters.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-midnight">
                      {q.quotation_number}
                      <span className="block text-[10px] text-slate-400 font-sans font-normal">v{q.version}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {q.customers ? (
                        <div>
                          <div className="font-semibold text-slate-900">{q.customers.full_name}</div>
                          <div className="font-mono text-xs text-slate-500">{q.customers.phone_e164}</div>
                        </div>
                      ) : q.leads ? (
                        <div>
                          <div className="font-semibold text-slate-900">{q.leads.full_name}</div>
                          <div className="font-mono text-xs text-slate-500">{q.leads.phone_e164}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-midnight">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-solar-gold" />
                        {Number(q.system_capacity_kw)} kW
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      ₹{Number(q.grand_total).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-600 font-medium">
                      {Number(q.subsidy_amount) > 0 ? (
                        <span>- ₹{Number(q.subsidy_amount).toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-midnight">
                      ₹{Number(q.net_payable).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link to={`/quotations/${q.id}`}>
                        <Button variant={q.status === 'ACCEPTED' ? 'accent' : 'outline'} size="sm" icon={ChevronRight}>
                          {q.status === 'ACCEPTED' ? 'Convert Order' : 'View Proposal'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination Controls Bar */}
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
          entityLabel="quotations"
          pageSizes={[10, 20, 50, 100]}
        />
      </div>

      {/* Generate Quotation Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        title="Generate Commercial Solar Quotation"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Approved Engineering BOM *
            </label>
            {loadingBoms ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin text-midnight" />
                Loading eligible engineering BOMs...
              </div>
            ) : boms.length === 0 ? (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  No Engineering BOMs Found
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Quotations require an engineering Bill of Materials to automatically calculate hardware costs, 70:30 solar GST, and PM Surya Ghar subsidies.
                </p>
                <div className="pt-1">
                  <Link
                    to="/surveys"
                    onClick={handleCloseModal}
                    className="inline-flex items-center gap-1 text-midnight font-bold underline hover:text-solar-gold"
                  >
                    Go to Site Surveys to conduct survey and generate BOM &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <SearchableSelect
                required
                options={bomOptions}
                value={formData.bom_id}
                onChange={(val) => setFormData((prev) => ({ ...prev, bom_id: val }))}
                placeholder="Search and select an Engineering BOM..."
                searchPlaceholder="Filter by BOM number, customer, capacity kW, or cost..."
                emptyMessage="No matching Engineering BOMs found"
              />
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Pricing engine automatically pulls all hardware line items and sizes the 70:30 solar GST and PM Surya Ghar central subsidy.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Special Commercial Discount (₹)
            </label>
            <input
              type="number"
              min="0"
              value={formData.discount_amount}
              onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Commercial & Warranty Terms
            </label>
            <textarea
              rows={3}
              value={formData.commercial_terms}
              onChange={(e) => setFormData({ ...formData, commercial_terms: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting} disabled={loadingBoms || boms.length === 0}>
              Generate Proposal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
export default QuotationsListPage;
