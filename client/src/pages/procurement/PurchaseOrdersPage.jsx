import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  Filter,
  X,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  PackagePlus,
  Building,
  DollarSign,
  Boxes,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import Modal from '../../components/common/Modal.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

const PO_STATUSES = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
];

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
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

  // Create PO Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poWarehouseId, setPoWarehouseId] = useState('');
  const [poDeliveryDate, setPoDeliveryDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState([
    { product_id: '', quantity_ordered: 1, unit_price: '', tax_rate_pct: 12 }
  ]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Record GRN Modal
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [grnPoId, setGrnPoId] = useState('');
  const [grnSupplierId, setGrnSupplierId] = useState('');
  const [grnWarehouseId, setGrnWarehouseId] = useState('');
  const [grnChallanNo, setGrnChallanNo] = useState('');
  const [grnChallanDate, setGrnChallanDate] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnItems, setGrnItems] = useState([]);
  const [grnSerials, setGrnSerials] = useState(''); // Multiline serials text
  const [grnSubmitting, setGrnSubmitting] = useState(false);
  const [grnError, setGrnError] = useState('');

  // Load baseline master data
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [supRes, whRes, catRes] = await Promise.all([
          api.get('/procurement/suppliers', { limit: 100 }),
          api.get('/inventory/warehouses'),
          api.get('/catalog/products', { limit: 100 })
        ]);
        setSuppliers(supRes?.data || []);
        setWarehouses(whRes?.data || []);
        setCatalogProducts(catRes?.data || []);
      } catch (err) {
        console.error('Failed to load procurement master data:', err);
      }
    }
    loadMasterData();
  }, []);

  const supplierOptions = React.useMemo(() => {
    return suppliers.map((s) => ({
      value: s.id,
      label: s.name,
      subtitle: `${s.supplier_code} • ${s.phone_e164 || ''}`,
      badge: s.gstin ? `GST: ${s.gstin}` : null,
      searchTerms: `${s.name} ${s.supplier_code} ${s.city || ''}`
    }));
  }, [suppliers]);

  const warehouseOptions = React.useMemo(() => {
    return warehouses.map((wh) => ({
      value: wh.id,
      label: wh.name,
      subtitle: `${wh.code} • ${wh.city}`,
      searchTerms: `${wh.name} ${wh.code} ${wh.city}`
    }));
  }, [warehouses]);

  const productOptions = React.useMemo(() => {
    return catalogProducts.map((p) => ({
      value: p.id,
      label: `${p.sku} — ${p.brand}`,
      subtitle: `${p.model_name} (${p.unit_code})`,
      badge: p.is_serial_tracked ? 'Serial Tracked' : null,
      searchTerms: `${p.sku} ${p.brand} ${p.model_name}`
    }));
  }, [catalogProducts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedStatus, selectedWarehouse]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (selectedStatus !== 'ALL') query.status = selectedStatus;
      if (selectedWarehouse) query.warehouse_id = selectedWarehouse;

      const res = await api.get('/procurement/purchase-orders', query);
      setOrders(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedStatus, selectedWarehouse]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprovePO = async (poId) => {
    if (!window.confirm('Are you sure you want to approve this Purchase Order for vendor issuance?')) return;
    try {
      await api.post(`/procurement/purchase-orders/${poId}/approve`);
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to approve purchase order');
    }
  };

  // Add line item to draft PO
  const handleAddPoItem = () => {
    setPoItems([...poItems, { product_id: '', quantity_ordered: 1, unit_price: '', tax_rate_pct: 12 }]);
  };

  const handleRemovePoItem = (index) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handlePoItemChange = (index, field, value) => {
    const updated = [...poItems];
    updated[index][field] = value;

    if (field === 'product_id') {
      const prod = catalogProducts.find((p) => p.id === value);
      if (prod) {
        updated[index].unit_price = Number(prod.standard_cost) || '';
        updated[index].tax_rate_pct = Number(prod.tax_rate_pct) || 12;
      }
    }
    setPoItems(updated);
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (!poSupplierId || !poWarehouseId) {
      setCreateError('Supplier and destination warehouse are required.');
      return;
    }

    const validItems = poItems.filter((it) => it.product_id && Number(it.quantity_ordered) > 0 && Number(it.unit_price) >= 0);
    if (validItems.length === 0) {
      setCreateError('Please configure at least one valid line item with quantity and price.');
      return;
    }

    setCreateSubmitting(true);
    setCreateError('');
    try {
      await api.post('/procurement/purchase-orders', {
        supplier_id: poSupplierId,
        warehouse_id: poWarehouseId,
        expected_delivery_date: poDeliveryDate || undefined,
        notes: poNotes || undefined,
        items: validItems.map((it) => ({
          product_id: it.product_id,
          quantity_ordered: Number(it.quantity_ordered),
          unit_price: Number(it.unit_price),
          tax_rate_pct: Number(it.tax_rate_pct)
        }))
      });
      setCreateModalOpen(false);
      setPoItems([{ product_id: '', quantity_ordered: 1, unit_price: '', tax_rate_pct: 12 }]);
      setPoDeliveryDate('');
      setPoNotes('');
      fetchOrders();
    } catch (err) {
      setCreateError(err.message || 'Failed to create purchase order');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open GRN Modal pre-filled with a PO
  const handleOpenGRNModal = (po = null) => {
    if (po) {
      setGrnPoId(po.id);
      setGrnSupplierId(po.supplier_id);
      setGrnWarehouseId(po.warehouse_id);
      setGrnItems(
        po.purchase_order_items.map((it) => {
          const remainingToReceive = Math.max(0, Number(it.quantity_ordered) - Number(it.quantity_received));
          return {
            po_item_id: it.id,
            product_id: it.product_id,
            sku: it.products?.sku,
            brand: it.products?.brand,
            is_serial_tracked: it.products?.is_serial_tracked,
            quantity_received: remainingToReceive,
            quantity_accepted: remainingToReceive,
            quantity_rejected: 0,
            unit_cost: Number(it.unit_price)
          };
        })
      );
    } else {
      setGrnPoId('');
      setGrnSupplierId(suppliers[0]?.id || '');
      setGrnWarehouseId(warehouses[0]?.id || '');
      setGrnItems([]);
    }
    setGrnChallanNo('');
    setGrnChallanDate(new Date().toISOString().split('T')[0]);
    setGrnNotes('');
    setGrnSerials('');
    setGrnError('');
    setGrnModalOpen(true);
  };

  const handleExecuteGRN = async (e) => {
    e.preventDefault();
    if (!grnSupplierId || !grnWarehouseId) {
      setGrnError('Supplier and warehouse are required.');
      return;
    }
    if (grnItems.length === 0) {
      setGrnError('Please add at least one line item to receive.');
      return;
    }

    // Parse serials
    const serialLines = grnSerials
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Group serials for serialized items
    const parsedSerials = [];
    const serializedItems = grnItems.filter((it) => it.is_serial_tracked && Number(it.quantity_accepted) > 0);
    
    if (serializedItems.length > 0) {
      const totalSerialsNeeded = serializedItems.reduce((sum, it) => sum + Number(it.quantity_accepted), 0);
      if (serialLines.length !== totalSerialsNeeded) {
        setGrnError(
          `Total serialized items accepted is ${totalSerialsNeeded}, but ${serialLines.length} serial numbers were provided. Please enter one serial per line.`
        );
        return;
      }

      let lineIdx = 0;
      for (const item of serializedItems) {
        const count = Number(item.quantity_accepted);
        for (let i = 0; i < count; i++) {
          parsedSerials.push({
            product_id: item.product_id,
            serial_number: serialLines[lineIdx++]
          });
        }
      }
    }

    setGrnSubmitting(true);
    setGrnError('');
    try {
      await api.post('/procurement/goods-receipts', {
        po_id: grnPoId || undefined,
        supplier_id: grnSupplierId,
        warehouse_id: grnWarehouseId,
        invoice_challan_number: grnChallanNo || undefined,
        invoice_challan_date: grnChallanDate || undefined,
        notes: grnNotes || undefined,
        items: grnItems.map((it) => ({
          po_item_id: it.po_item_id || undefined,
          product_id: it.product_id,
          quantity_received: Number(it.quantity_received),
          quantity_accepted: Number(it.quantity_accepted),
          quantity_rejected: Number(it.quantity_rejected || 0),
          unit_cost: Number(it.unit_cost)
        })),
        serials: parsedSerials
      });
      setGrnModalOpen(false);
      fetchOrders();
    } catch (err) {
      setGrnError(err.message || 'Failed to record Goods Receipt');
    } finally {
      setGrnSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral">Draft</Badge>;
      case 'SUBMITTED':
        return <Badge variant="warning">Submitted</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Approved</Badge>;
      case 'PARTIALLY_RECEIVED':
        return <Badge variant="warning">Partially Received</Badge>;
      case 'RECEIVED':
        return <Badge variant="success">Fully Received</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
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
        <div>
          <h1 className="text-xl font-bold font-mono text-midnight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-solar-gold" /> Equipment Procurement & Purchase Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Issue vendor purchase orders for solar modules, inverters, and electrical BOS, with automated GRN inwards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={PackagePlus} onClick={() => handleOpenGRNModal(null)}>
            Direct Goods Receipt (GRN)
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreateModalOpen(true)}>
            Draft Purchase Order
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by PO number or supplier name..."
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
            {PO_STATUSES.map((st) => (
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

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Destination Depot</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Order Value (₹)</th>
                <th className="py-3 px-4">Expected Delivery</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading procurement orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No purchase orders found matching criteria.
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const total = Number(po.total_amount);
                  const isDraft = po.status === 'DRAFT' || po.status === 'SUBMITTED';
                  const canReceive = po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED';

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-midnight">
                        {po.po_number}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {new Date(po.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{po.suppliers?.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{po.suppliers?.supplier_code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{po.warehouses?.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{po.warehouses?.code}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {po.purchase_order_items?.length || 0} lines
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{total.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {po.expected_delivery_date
                          ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {isDraft && (
                          <Button
                            variant="accent"
                            size="xs"
                            icon={CheckCircle2}
                            onClick={() => handleApprovePO(po.id)}
                          >
                            Approve
                          </Button>
                        )}
                        {canReceive && (
                          <Button
                            variant="outline"
                            size="xs"
                            icon={Truck}
                            onClick={() => handleOpenGRNModal(po)}
                          >
                            Receive GRN
                          </Button>
                        )}
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

      {/* Draft Purchase Order Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Draft Equipment Purchase Order"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <SearchableSelect
                required
                label="Supplier *"
                options={supplierOptions}
                value={poSupplierId}
                onChange={(val) => setPoSupplierId(val)}
                placeholder="Search supplier..."
                searchPlaceholder="Type supplier name or code..."
              />
            </div>

            <div>
              <SearchableSelect
                required
                label="Destination Warehouse *"
                options={warehouseOptions}
                value={poWarehouseId}
                onChange={(val) => setPoWarehouseId(val)}
                placeholder="Search warehouse..."
                searchPlaceholder="Type warehouse name or city..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={poDeliveryDate}
                onChange={(e) => setPoDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-midnight uppercase tracking-wider">Purchase Order Items</span>
              <Button variant="ghost" size="xs" icon={Plus} type="button" onClick={handleAddPoItem}>
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {poItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                  <div className="col-span-5">
                    <SearchableSelect
                      required
                      options={productOptions}
                      value={item.product_id}
                      onChange={(val) => handlePoItemChange(idx, 'product_id', val)}
                      placeholder="Select Component..."
                      searchPlaceholder="Search SKU, brand, model..."
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      required
                      value={item.quantity_ordered}
                      onChange={(e) => handlePoItemChange(idx, 'quantity_ordered', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Unit Price"
                      required
                      value={item.unit_price}
                      onChange={(e) => handlePoItemChange(idx, 'unit_price', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-xs text-slate-800">
                    ₹{((Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0)).toLocaleString('en-IN')}
                  </div>
                  <div className="col-span-1 text-center">
                    {poItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePoItem(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Procurement Notes / Terms</label>
            <textarea
              rows={2}
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="e.g. Include test flash report and manufacturer warranty certificates..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-midnight"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={createSubmitting}>
              Create Purchase Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Goods Receipt (GRN) Modal */}
      <Modal
        isOpen={grnModalOpen}
        onClose={() => setGrnModalOpen(false)}
        title="Record Goods Receipt Note (GRN)"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleExecuteGRN} className="space-y-4">
          {grnError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {grnError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <SearchableSelect
                disabled={Boolean(grnPoId)}
                label="Supplier"
                options={supplierOptions}
                value={grnSupplierId}
                onChange={(val) => setGrnSupplierId(val)}
                placeholder="Select Supplier..."
                searchPlaceholder="Search suppliers..."
              />
            </div>

            <div>
              <SearchableSelect
                disabled={Boolean(grnPoId)}
                label="Warehouse"
                options={warehouseOptions}
                value={grnWarehouseId}
                onChange={(val) => setGrnWarehouseId(val)}
                placeholder="Select Warehouse..."
                searchPlaceholder="Search warehouses..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vendor Invoice / Challan #</label>
              <input
                type="text"
                placeholder="INV-VEND-84920"
                value={grnChallanNo}
                onChange={(e) => setGrnChallanNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>
          </div>

          {/* Line items to inwards */}
          <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
            <span className="text-xs font-bold text-midnight uppercase tracking-wider block">
              Inward Items Verification
            </span>
            <div className="space-y-2">
              {grnItems.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 font-mono">
                    <span className="font-bold text-slate-900 block">{item.sku}</span>
                    <span className="text-[11px] text-slate-500">{item.brand}</span>
                    {item.is_serial_tracked && (
                      <span className="text-[10px] text-sky-700 font-semibold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 inline-block mt-0.5">
                        Serial Required
                      </span>
                    )}
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-400">Accepted Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={item.quantity_accepted}
                      onChange={(e) => {
                        const upd = [...grnItems];
                        upd[idx].quantity_accepted = e.target.value;
                        setGrnItems(upd);
                      }}
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400">Rejected Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={item.quantity_rejected}
                      onChange={(e) => {
                        const upd = [...grnItems];
                        upd[idx].quantity_rejected = e.target.value;
                        setGrnItems(upd);
                      }}
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400">Unit Cost (₹)</label>
                    <input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) => {
                        const upd = [...grnItems];
                        upd[idx].unit_cost = e.target.value;
                        setGrnItems(upd);
                      }}
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Serial Number Scanner / Input */}
          {grnItems.some((it) => it.is_serial_tracked && Number(it.quantity_accepted) > 0) && (
            <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>Barcode Scanner / Serial Number Capture</span>
              </div>
              <p className="text-[11px] text-sky-700">
                Enter or scan one unique serial number per line matching total accepted serialized items:
              </p>
              <textarea
                rows={4}
                required
                value={grnSerials}
                onChange={(e) => setGrnSerials(e.target.value)}
                placeholder="SN-INV-202611-001&#10;SN-INV-202611-002&#10;SN-INV-202611-003"
                className="w-full px-3 py-2 border border-sky-300 rounded-lg text-xs font-mono bg-white outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setGrnModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" type="submit" loading={grnSubmitting} icon={PackagePlus}>
              Confirm & Inward Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PurchaseOrdersPage;
