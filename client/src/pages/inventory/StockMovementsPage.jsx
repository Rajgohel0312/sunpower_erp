import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Search,
  Filter,
  X,
  ArrowLeft,
  Calendar,
  Building,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  User,
  Boxes
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Pagination from '../../components/common/Pagination.jsx';

const MOVEMENT_TYPES = [
  'ALL',
  'PURCHASE_RECEIPT',
  'ORDER_RESERVATION',
  'RESERVATION_RELEASE',
  'DISPATCH',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'RETURN',
  'ADJUSTMENT'
];

export function StockMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Fetch warehouses
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
  }, [selectedWarehouse, selectedType]);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (selectedWarehouse) query.warehouse_id = selectedWarehouse;
      if (selectedType !== 'ALL') query.movement_type = selectedType;

      const res = await api.get('/inventory/movements', query);
      setMovements(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedWarehouse, selectedType]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const getMovementBadge = (type) => {
    switch (type) {
      case 'PURCHASE_RECEIPT':
        return <Badge variant="success">Purchase Receipt (GRN)</Badge>;
      case 'ORDER_RESERVATION':
        return <Badge variant="warning">Order Reservation</Badge>;
      case 'RESERVATION_RELEASE':
        return <Badge variant="info">Reservation Release</Badge>;
      case 'DISPATCH':
        return <Badge variant="danger">Dispatched</Badge>;
      case 'TRANSFER_IN':
        return <Badge variant="success">Transfer In</Badge>;
      case 'TRANSFER_OUT':
        return <Badge variant="warning">Transfer Out</Badge>;
      case 'ADJUSTMENT':
        return <Badge variant="neutral">Stock Adjustment</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const hasActiveFilters = Boolean(selectedWarehouse || selectedType !== 'ALL');

  const clearFilters = () => {
    setSelectedWarehouse('');
    setSelectedType('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/inventory/stock">
            <Button variant="outline" size="sm" icon={ArrowLeft}>
              Back to Stock
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold font-mono text-midnight flex items-center gap-2">
              <Layers className="w-5 h-5 text-solar-gold" /> Physical Stock Movement Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only audit trail recording every goods receipt, reservation, transfer, and adjustment.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
          {/* Warehouse Dropdown */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full sm:w-60 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-midnight"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} — {wh.name}
              </option>
            ))}
          </select>

          {/* Movement Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-midnight"
          >
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
            Reset Filters
          </Button>
        )}
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Movement #</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Product Component</th>
                <th className="py-3 px-4">Warehouse Depot</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4 text-right">Quantity Delta</th>
                <th className="py-3 px-4 text-center">On-Hand Before $\to$ After</th>
                <th className="py-3 px-4">Reference & Notes</th>
                <th className="py-3 px-4">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading physical movement ledger...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No movements recorded matching your criteria.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const qty = Number(m.quantity);
                  const isPositive = qty > 0;
                  const isZero = qty === 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-midnight">
                        {m.movement_number}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">{m.products?.sku}</div>
                        <div className="text-[11px] text-slate-500">
                          {m.products?.brand} — {m.products?.model_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {m.warehouses?.code}
                      </td>
                      <td className="py-3 px-4">
                        {getMovementBadge(m.movement_type)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={
                            isPositive
                              ? 'text-emerald-700'
                              : isZero
                              ? 'text-slate-500'
                              : 'text-rose-600'
                          }
                        >
                          {isPositive ? `+${qty}` : qty} {m.products?.unit_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        <span className="text-slate-500">{Number(m.quantity_on_hand_before)}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-bold text-midnight">{Number(m.quantity_on_hand_after)}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={m.notes || ''}>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded mr-1">
                          {m.reference_type}
                        </span>
                        <span>{m.notes || '—'}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {m.users?.full_name || 'System'}
                      </td>
                    </tr>
                  );
                })
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

export default StockMovementsPage;
