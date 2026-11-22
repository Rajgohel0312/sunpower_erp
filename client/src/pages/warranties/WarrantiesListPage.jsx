import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Sparkles,
  ExternalLink,
  Calendar,
  User,
  Package,
  Barcode,
  Printer,
  Plus,
  RefreshCw,
  LifeBuoy,
  FileText,
  X
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';

export function WarrantiesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Selected Warranty for Certificate View Modal
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);

  // Manual Warranty Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    customer_id: '',
    sales_order_id: '',
    product_id: '',
    serial_number_id: '',
    policy_code: 'POL-INVERTER-5Y',
    duration_months: 60
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Fetch warranties
  const fetchWarranties = useCallback(async () => {
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

      const res = await api.get(`/warranties?${params.toString()}`);
      if (res.data) {
        setWarranties(res.data);
        if (res.meta?.pagination) {
          setPagination(res.meta.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load warranties:', err);
      setError(err.message || 'Failed to load warranty registry');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchWarranties();
  }, [fetchWarranties]);

  // Sync state to URL
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (page > 1) nextParams.set('page', page.toString());
    if (debouncedSearch) nextParams.set('search', debouncedSearch);
    if (statusFilter !== 'ALL') nextParams.set('status', statusFilter);
    setSearchParams(nextParams, { replace: true });
  }, [page, debouncedSearch, statusFilter, setSearchParams]);

  // Helper for computing remaining duration
  const getRemainingTime = (endDateStr) => {
    const end = new Date(endDateStr).getTime();
    const now = Date.now();
    const diffMs = end - now;
    if (diffMs <= 0) return { expired: true, text: 'Expired' };

    const totalDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);

    if (years > 0) {
      return { expired: false, text: `${years}y ${months}m left` };
    }
    return { expired: false, text: `${totalDays} days left` };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'EXPIRED':
        return <Badge variant="neutral">Expired</Badge>;
      case 'CLAIMED':
        return <Badge variant="warning">Claimed</Badge>;
      case 'VOID':
        return <Badge variant="danger">Voided</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'PERFORMANCE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">25Y Linear</span>;
      case 'REPLACEMENT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Equipment Swap</span>;
      case 'WORKMANSHIP':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Workmanship</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-solar-gold/10 text-midnight border border-solar-gold/20">
              <ShieldCheck className="w-6 h-6 text-midnight" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-midnight tracking-tight">Warranties & AMC Registry</h1>
              <p className="text-sm text-slate-500">
                Certified equipment warranties, immutable manufacturer policy snapshots & validity tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchWarranties}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Link to="/tickets">
            <Button variant="accent" className="flex items-center gap-2">
              <LifeBuoy className="w-4 h-4" />
              Service Tickets Desk
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Active Certificates</div>
            <div className="text-2xl font-bold font-mono text-midnight mt-0.5">
              {warranties.filter((w) => w.status === 'ACTIVE').length}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">PV Modules (25-Yr)</div>
            <div className="text-2xl font-bold font-mono text-midnight mt-0.5">
              {warranties.filter((w) => w.policy_snapshot?.warranty_type === 'PERFORMANCE').length}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Inverter / BOS (5-Yr)</div>
            <div className="text-2xl font-bold font-mono text-midnight mt-0.5">
              {warranties.filter((w) => w.policy_snapshot?.warranty_type === 'REPLACEMENT').length}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Workmanship (10-Yr)</div>
            <div className="text-2xl font-bold font-mono text-midnight mt-0.5">
              {warranties.filter((w) => w.policy_snapshot?.warranty_type === 'WORKMANSHIP').length}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-midnight text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Cert #, Customer, Serial..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40 focus:border-solar-gold transition-all"
            />
          </div>
        </div>
      </div>

      {/* 4. Warranties Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading warranty certificates...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : warranties.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No Warranty Certificates Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Warranties are automatically generated and linked to exact equipment serials once an installation job is commissioned with customer sign-off.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Certificate #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Equipment & Serial</th>
                  <th className="py-3 px-4">Coverage Type</th>
                  <th className="py-3 px-4">Validity & Remaining</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {warranties.map((w) => {
                  const remaining = getRemainingTime(w.end_date);
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Certificate # */}
                      <td className="py-3 px-4 font-mono font-semibold text-midnight">
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-solar-gold" />
                          <span>{w.warranty_certificate_number}</span>
                        </div>
                        {w.sales_orders && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            SO: {w.sales_orders.order_number}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {w.customers?.full_name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {w.customers?.phone_e164 || ''}
                        </div>
                      </td>

                      {/* Equipment & Serial */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {w.products?.model_name || w.products?.brand || w.policy_snapshot?.policy_name || 'Solar Hardware'}
                        </div>
                        {w.serial_numbers ? (
                          <Link
                            to={`/inventory/serials?search=${w.serial_numbers.serial_number}`}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-600 hover:text-sky-700 hover:underline mt-0.5"
                          >
                            <Barcode className="w-3 h-3 text-slate-400" />
                            {w.serial_numbers.serial_number}
                          </Link>
                        ) : (
                          <span className="text-[10px] text-slate-400">Plant-wide System</span>
                        )}
                      </td>

                      {/* Coverage Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {getTypeBadge(w.policy_snapshot?.warranty_type)}
                          <span className="text-[11px] text-slate-500 font-medium">
                            {w.policy_snapshot?.duration_months} mos
                          </span>
                        </div>
                      </td>

                      {/* Validity & Remaining */}
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-700 font-medium">
                          {new Date(w.start_date).toLocaleDateString()} — {new Date(w.end_date).toLocaleDateString()}
                        </div>
                        <div className="mt-0.5">
                          {remaining.expired ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                              <AlertTriangle className="w-3 h-3" /> Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" /> {remaining.text}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(w.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedWarranty(w);
                              setIsCertificateModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 text-midnight hover:bg-slate-100 transition-colors flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-solar-gold" />
                            Certificate
                          </button>

                          <Link
                            to={`/tickets?customer_id=${w.customer_id}${w.serial_numbers ? `&serial_number=${w.serial_numbers.serial_number}` : ''}`}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-midnight/5 text-midnight hover:bg-midnight hover:text-white transition-colors flex items-center gap-1"
                          >
                            <LifeBuoy className="w-3 h-3" />
                            Log Ticket
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing {warranties.length} of {pagination.total} warranty certificates
            </span>
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* 5. Official Warranty Certificate Modal */}
      {isCertificateModalOpen && selectedWarranty && (
        <Modal
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          title="Digital Warranty Certificate"
          maxWidth="max-w-2xl"
        >
          <div className="p-6 bg-white space-y-6">
            {/* Certificate Header Banner */}
            <div className="p-6 bg-gradient-to-r from-midnight to-midnight-dark text-white rounded-xl border border-solar-gold/30 shadow relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-solar-gold/10 skew-x-12 transform pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-solar-gold flex items-center justify-center text-midnight font-bold">
                    <ShieldCheck className="w-6 h-6 fill-midnight" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Official Warranty Certificate</h2>
                    <p className="text-xs text-solar-gold font-mono">SunPower Clean Energy Infrastructure</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-300 uppercase tracking-widest font-semibold">Certificate Number</div>
                  <div className="text-sm font-bold font-mono text-solar-gold">
                    {selectedWarranty.warranty_certificate_number}
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate Body Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Beneficiary Customer</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {selectedWarranty.customers?.full_name}
                </span>
                <span className="block text-slate-500 text-[11px] mt-0.5">
                  {selectedWarranty.customers?.phone_e164}
                </span>
              </div>

              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Sales Order / Project</span>
                <span className="font-semibold font-mono text-slate-800 text-sm">
                  {selectedWarranty.sales_orders?.order_number || 'N/A'}
                </span>
                <span className="block text-slate-500 text-[11px] mt-0.5">
                  Capacity: {selectedWarranty.sales_orders?.system_capacity_kw || '5.0'} kWp
                </span>
              </div>

              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Covered Equipment</span>
                <span className="font-semibold text-slate-800">
                  {selectedWarranty.products?.model_name || selectedWarranty.products?.brand || 'Solar Equipment'}
                </span>
                {selectedWarranty.serial_numbers && (
                  <span className="block font-mono text-sky-600 font-semibold text-[11px] mt-0.5">
                    SN: {selectedWarranty.serial_numbers.serial_number}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">Coverage Horizon</span>
                <span className="font-semibold text-slate-800">
                  {new Date(selectedWarranty.start_date).toLocaleDateString()} to {new Date(selectedWarranty.end_date).toLocaleDateString()}
                </span>
                <span className="block text-emerald-600 font-medium text-[11px] mt-0.5">
                  Duration: {selectedWarranty.policy_snapshot?.duration_months} Months ({selectedWarranty.policy_snapshot?.warranty_type})
                </span>
              </div>
            </div>

            {/* Frozen Policy Terms */}
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-semibold">
                <Award className="w-4 h-4 text-amber-600" />
                <span>{selectedWarranty.policy_snapshot?.policy_name}</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {selectedWarranty.policy_snapshot?.terms_and_conditions}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Link
                to={`/tickets?customer_id=${selectedWarranty.customer_id}${selectedWarranty.serial_numbers ? `&serial_number=${selectedWarranty.serial_numbers.serial_number}` : ''}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                <LifeBuoy className="w-4 h-4" />
                Open Support Ticket with this Warranty
              </Link>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print Certificate
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsCertificateModalOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default WarrantiesListPage;
