import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Search,
  Filter,
  X,
  AlertTriangle,
  ArrowRightLeft,
  SlidersHorizontal,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Building,
  RefreshCw
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import Modal from '../../components/common/Modal.jsx';

export function InventoryStockPage() {
  const [stockBalances, setStockBalances] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Adjustment Modal
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('CYCLE_COUNT');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState('');

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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedWarehouse, lowStockOnly]);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (selectedWarehouse) query.warehouse_id = selectedWarehouse;
      if (lowStockOnly) query.low_stock = true;

      const res = await api.get('/inventory/stock', query);
      setStockBalances(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load stock balances:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedWarehouse, lowStockOnly]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleOpenAdjustment = (balance) => {
    setSelectedBalance(balance);
    setAdjustmentDelta('');
    setAdjustmentReason('CYCLE_COUNT');
    setAdjustmentNotes('');
    setAdjustmentError('');
    setAdjustmentModalOpen(true);
  };

  const handleExecuteAdjustment = async (e) => {
    e.preventDefault();
    const deltaNum = Number(adjustmentDelta);
    if (!deltaNum || isNaN(deltaNum)) {
      setAdjustmentError('Please enter a non-zero quantity delta.');
      return;
    }

    setSubmittingAdjustment(true);
    setAdjustmentError('');
    try {
      await api.post('/inventory/adjustments', {
        product_id: selectedBalance.product_id,
        warehouse_id: selectedBalance.warehouse_id,
        quantity_delta: deltaNum,
        reason: adjustmentReason,
        notes: adjustmentNotes || undefined
      });
      setAdjustmentModalOpen(false);
      fetchStock();
    } catch (err) {
      setAdjustmentError(err.message || 'Failed to execute stock adjustment');
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const hasActiveFilters = Boolean(searchInput || selectedWarehouse || lowStockOnly);

  const clearFilters = () => {
    setSearchInput('');
    setSelectedWarehouse('');
    setLowStockOnly(false);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-midnight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-solar-gold" /> Multi-Warehouse Stock Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time physical inventory balances, reservations, and serialized equipment across central warehouses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/inventory/movements">
            <Button variant="outline" size="sm" icon={Layers}>
              Physical Movement Ledger
            </Button>
          </Link>
          <Link to="/inventory/serials">
            <Button variant="accent" size="sm" icon={ShieldCheck}>
              Serial Asset Explorer
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by SKU, brand, model name (e.g. GROWATT, POLYCAB)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
            />
          </div>

          {/* Warehouse Dropdown */}
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

          {/* Low Stock Toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none whitespace-nowrap px-2 py-1 rounded hover:bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-midnight focus:ring-midnight"
            />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Low Stock Reorder Alert</span>
          </label>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
            Reset Filters
          </Button>
        )}
      </div>

      {/* Stock Balances Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Hardware Component / SKU</th>
                <th className="py-3 px-4">Warehouse Depot</th>
                <th className="py-3 px-4 text-center">Tracking Mode</th>
                <th className="py-3 px-4 text-right">Physical On Hand</th>
                <th className="py-3 px-4 text-right">Reserved (Committed)</th>
                <th className="py-3 px-4 text-right">Available for Sale</th>
                <th className="py-3 px-4 text-center">Reorder Threshold</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying multi-warehouse stock ledger...
                  </td>
                </tr>
              ) : stockBalances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No stock records matching your criteria.
                  </td>
                </tr>
              ) : (
                stockBalances.map((bal) => {
                  const onHand = Number(bal.quantity_on_hand);
                  const reserved = Number(bal.quantity_reserved);
                  const available = Number(bal.quantity_available);
                  const reorder = Number(bal.reorder_level);
                  const isLow = available <= reorder;

                  return (
                    <tr key={bal.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">{bal.products?.sku}</div>
                        <div className="text-[11px] text-slate-500">
                          {bal.products?.brand} — {bal.products?.model_name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{bal.warehouses?.name}</span>
                        <span className="text-[10px] block text-slate-400 font-mono">{bal.warehouses?.code} • {bal.warehouses?.city}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {bal.products?.is_serial_tracked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <ShieldCheck className="w-3 h-3 text-sky-600" /> Serial Tracked
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] text-slate-600 bg-slate-100 border border-slate-200">
                            Standard
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 text-right">
                        {onHand.toLocaleString('en-IN')} {bal.products?.unit_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-700 text-right">
                        {reserved > 0 ? (
                          <span className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                            {reserved.toLocaleString('en-IN')} {bal.products?.unit_code}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-right font-bold">
                        <span
                          className={`px-2.5 py-1 rounded-md border text-xs ${
                            available <= 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {available.toLocaleString('en-IN')} {bal.products?.unit_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {reorder.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={SlidersHorizontal}
                          onClick={() => handleOpenAdjustment(bal)}
                        >
                          Adjust
                        </Button>
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

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        title="Physical Inventory Adjustment"
        maxWidth="max-w-md"
      >
        {selectedBalance && (
          <form onSubmit={handleExecuteAdjustment} className="space-y-4">
            {adjustmentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {adjustmentError}
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="font-bold font-mono text-slate-900">{selectedBalance.products?.sku}</div>
              <div className="text-slate-500">{selectedBalance.products?.brand} — {selectedBalance.products?.model_name}</div>
              <div className="text-slate-500 font-mono">
                Warehouse: <span className="font-bold text-midnight">{selectedBalance.warehouses?.name}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-mono">
                <span>Current On Hand: <strong className="text-slate-800">{Number(selectedBalance.quantity_on_hand)}</strong></span>
                <span>Current Available: <strong className="text-emerald-700">{Number(selectedBalance.quantity_available)}</strong></span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantity Delta (+ to increase, - to write off) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={adjustmentDelta}
                onChange={(e) => setAdjustmentDelta(e.target.value)}
                placeholder="e.g. +10 or -2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-midnight outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Positive values record stock surplus; negative values record scrap/loss.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adjustment Reason *
              </label>
              <select
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-midnight outline-none"
              >
                <option value="CYCLE_COUNT">Physical Cycle Count Correction</option>
                <option value="TRANSIT_DAMAGE">Transit / Handling Damage</option>
                <option value="SCRAP_DEFECT">Factory Defect / Scrap</option>
                <option value="OPENING_BALANCE">Opening Balance Reconciliation</option>
                <option value="INTERNAL_USE">Internal Demo / Tool Kit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Audit Notes & Reference
              </label>
              <textarea
                rows={2}
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="Verified by store supervisor during monthly count..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-midnight outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <Button variant="ghost" type="button" onClick={() => setAdjustmentModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="accent" type="submit" loading={submittingAdjustment}>
                Execute Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default InventoryStockPage;
