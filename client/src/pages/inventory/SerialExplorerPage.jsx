import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Filter,
  X,
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Boxes,
  Zap,
  ShoppingBag,
  ExternalLink,
  QrCode,
  Layers,
  User
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Pagination from '../../components/common/Pagination.jsx';

const SERIAL_STATUSES = [
  'ALL',
  'AVAILABLE',
  'RESERVED',
  'DISPATCHED',
  'INSTALLED',
  'RETURNED',
  'UNDER_REPAIR',
  'REPLACED'
];

export function SerialExplorerPage() {
  const [serials, setSerials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Quick Trace Drawer / Card
  const [traceInput, setTraceInput] = useState('');
  const [tracedSerial, setTracedSerial] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState('');

  // Load warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await api.get('/inventory/warehouses');
        setWarehouses(res?.data || []);
      } catch (err) {
        console.error('Failed to load warehouses:', err);
      }
    }
    loadWarehouses();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedStatus, selectedWarehouse]);

  const fetchSerials = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (selectedStatus !== 'ALL') query.status = selectedStatus;
      if (selectedWarehouse) query.warehouse_id = selectedWarehouse;

      const res = await api.get('/serials', query);
      setSerials(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load serial numbers:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedStatus, selectedWarehouse]);

  useEffect(() => {
    fetchSerials();
  }, [fetchSerials]);

  const handleTraceSerial = async (serialToLookup = null) => {
    const s = serialToLookup || traceInput;
    if (!s || !s.trim()) return;

    setTraceLoading(true);
    setTraceError('');
    try {
      const res = await api.get(`/serials/${encodeURIComponent(s.trim())}`);
      setTracedSerial(res?.data || null);
    } catch (err) {
      setTraceError(err.message || 'Serial number not found in registry');
      setTracedSerial(null);
    } finally {
      setTraceLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge variant="success">Available in Stock</Badge>;
      case 'RESERVED':
        return <Badge variant="warning">Reserved for Order</Badge>;
      case 'DISPATCHED':
        return <Badge variant="info">Dispatched to Site</Badge>;
      case 'INSTALLED':
        return <Badge variant="success">Installed & Commissioned</Badge>;
      case 'RETURNED':
        return <Badge variant="neutral">Returned to Store</Badge>;
      case 'UNDER_REPAIR':
        return <Badge variant="danger">Under RMA / Repair</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const hasActiveFilters = Boolean(searchInput || selectedStatus !== 'ALL' || selectedWarehouse);

  const clearFilters = () => {
    setSearchInput('');
    setSelectedStatus('ALL');
    setSelectedWarehouse('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/inventory/stock">
            <Button variant="outline" size="sm" icon={ArrowLeft}>Back to Stock</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold font-mono text-midnight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-solar-gold" /> Serial Number Asset Explorer & Scanner
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Atomic barcode tracking for high-value solar modules and inverters from factory GRN to customer site.
            </p>
          </div>
        </div>
      </div>

      {/* Barcode Scanner / Instant Trace Search Box */}
      <div className="bg-gradient-to-r from-midnight to-slate-800 p-5 rounded-xl text-white shadow-md">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-solar-gold mb-2">
          <QrCode className="w-4 h-4" /> Barcode Scanner / Quick Serial Trace Lookup
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTraceSerial();
          }}
          className="flex flex-col sm:flex-row gap-3 items-center"
        >
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Scan or paste serial number (e.g. SN-INV-AHM-01)..."
              value={traceInput}
              onChange={(e) => setTraceInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-mono text-slate-900 bg-white border border-slate-300 outline-none focus:ring-2 focus:ring-solar-gold"
            />
          </div>
          <Button variant="accent" type="submit" loading={traceLoading} icon={Search} className="w-full sm:w-auto">
            Trace Asset Lifecycle
          </Button>
        </form>

        {traceError && (
          <div className="mt-3 p-2.5 bg-rose-500/20 border border-rose-400 rounded-lg text-xs text-rose-200">
            {traceError}
          </div>
        )}
      </div>

      {/* Traced Asset Detail Card (if searched) */}
      {tracedSerial && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-mono font-bold text-base text-midnight">{tracedSerial.serial_number}</h3>
            </div>
            {getStatusBadge(tracedSerial.status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10px] block">Equipment Details</span>
              <span className="font-bold font-mono text-slate-900 block">{tracedSerial.products?.sku}</span>
              <span className="text-slate-600">{tracedSerial.products?.brand} — {tracedSerial.products?.model_name}</span>
              {tracedSerial.products?.rated_capacity_w && (
                <span className="text-[11px] font-mono text-sky-700 block">
                  Capacity: {Number(tracedSerial.products.rated_capacity_w)} W
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10px] block">Current Depot</span>
              <span className="font-bold text-slate-900 block">{tracedSerial.warehouses?.name || 'In Transit / On Site'}</span>
              <span className="font-mono text-slate-500">{tracedSerial.warehouses?.code}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10px] block">Allocated Project Order</span>
              {tracedSerial.sales_orders ? (
                <Link to={`/orders/${tracedSerial.sales_orders.id}`} className="font-mono font-bold text-sky-600 hover:underline flex items-center gap-1">
                  {tracedSerial.sales_orders.order_number} <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <span className="text-slate-400">Unallocated (Available)</span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
              <span className="text-slate-400 uppercase font-semibold text-[10px] block">Registered Customer</span>
              {tracedSerial.customers ? (
                <div>
                  <span className="font-bold text-slate-900 block">{tracedSerial.customers.full_name}</span>
                  <span className="font-mono text-slate-500 text-[11px]">{tracedSerial.customers.phone_e164}</span>
                </div>
              ) : (
                <span className="text-slate-400">None</span>
              )}
            </div>
          </div>

          {/* Movement History Timeline */}
          {Array.isArray(tracedSerial.serial_movements) && tracedSerial.serial_movements.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-midnight uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-solar-gold" /> Asset Custody & Movement Timeline
              </h4>
              <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {tracedSerial.serial_movements.map((mov) => (
                  <div key={mov.id} className="relative text-xs space-y-0.5">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-solar-gold border-2 border-white" />
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{mov.to_status}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(mov.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                        {mov.reference_type}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{mov.notes || 'Status updated'}</p>
                    <p className="text-slate-400 font-mono text-[10px]">Recorded by: {mov.users?.full_name || 'System'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search serial number, brand, model..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-midnight"
          >
            {SERIAL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-midnight"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
            Reset
          </Button>
        )}
      </div>

      {/* Serial Numbers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Hardware Component</th>
                <th className="py-3 px-4">Warehouse Depot</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Linked Order</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying serial numbers registry...
                  </td>
                </tr>
              ) : serials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No serialized assets found matching criteria.
                  </td>
                </tr>
              ) : (
                serials.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-midnight">
                      {s.serial_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 font-mono">{s.products?.sku}</div>
                      <div className="text-[11px] text-slate-500">
                        {s.products?.brand} — {s.products?.model_name}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{s.warehouses?.name || 'In Transit'}</span>
                      <span className="text-[10px] block font-mono text-slate-400">{s.warehouses?.code}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(s.status)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {s.sales_orders ? (
                        <Link to={`/orders/${s.sales_orders.id}`} className="text-sky-600 hover:underline font-bold">
                          {s.sales_orders.order_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {s.customers ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">{s.customers.full_name}</span>
                          <span className="font-mono text-[11px] text-slate-500">{s.customers.phone_e164}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={Search}
                        onClick={() => {
                          setTraceInput(s.serial_number);
                          handleTraceSerial(s.serial_number);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Trace
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}

export default SerialExplorerPage;
