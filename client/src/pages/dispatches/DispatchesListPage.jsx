import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Navigation,
  AlertTriangle,
  Building,
  Package,
  Barcode,
  Calendar,
  FileText,
  User,
  Phone,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

const DISPATCH_STATUSES = ['ALL', 'PREPARED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

export function DispatchesListPage() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters & Pagination
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Create Dispatch Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Dropdown reference datasets
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [availableSerials, setAvailableSerials] = useState([]);

  // Form State
  const [dispatchOrderId, setDispatchOrderId] = useState('');
  const [dispatchWarehouseId, setDispatchWarehouseId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [dispatchItems, setDispatchItems] = useState([
    { product_id: '', quantity: 1 }
  ]);
  const [serialsText, setSerialsText] = useState('');

  // Auto-fetch & Auto-fill State
  const [searchParams] = useSearchParams();
  const urlOrderId = searchParams.get('order_id');
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState('');

  // Auto-Fetch & Auto-Fill from Selected Sales Order
  const handleSelectOrder = async (orderId) => {
    setDispatchOrderId(orderId);
    if (!orderId) {
      setAutoFillMessage('');
      return;
    }

    setAutoFillLoading(true);
    setAutoFillMessage('');
    try {
      // 1. Fetch full order details
      const orderRes = await api.get(`/orders/${orderId}`);
      const order = orderRes?.data;

      // 2. Fetch reserved serial numbers specifically linked to this order
      const serialsRes = await api.get('/serials', { current_order_id: orderId, limit: 100 });
      const reservedSerials = serialsRes?.data || [];

      // 3. Extract components with cascade: snapshot_data.items -> quotations.quotation_items -> project_boms.project_bom_items
      let extractedItems = [];
      if (Array.isArray(order?.snapshot_data?.items) && order.snapshot_data.items.length > 0) {
        extractedItems = order.snapshot_data.items;
      } else if (Array.isArray(order?.quotations?.quotation_items) && order.quotations.quotation_items.length > 0) {
        extractedItems = order.quotations.quotation_items.map((qi) => ({
          product_id: qi.product_id,
          quantity: Number(qi.quantity) || 1,
          sku: qi.products?.sku,
          brand: qi.products?.brand,
          item_name: qi.item_name
        }));
      } else if (Array.isArray(order?.project_boms?.project_bom_items) && order.project_boms.project_bom_items.length > 0) {
        extractedItems = order.project_boms.project_bom_items.map((bi) => ({
          product_id: bi.product_id,
          quantity: Number(bi.quantity) || 1,
          sku: bi.products?.sku,
          brand: bi.products?.brand,
          item_name: bi.products?.model_name || bi.products?.sku
        }));
      }

      // Map to form rows
      let validMappedRows = [];
      if (extractedItems.length > 0) {
        validMappedRows = extractedItems
          .map((item) => {
            const resolvedProdId =
              item.product_id ||
              products.find((p) => p.sku === item.sku || p.name === item.item_name)?.id;
            return {
              product_id: resolvedProdId || '',
              quantity: Number(item.quantity) || 1
            };
          })
          .filter((row) => row.product_id);

        if (validMappedRows.length > 0) {
          setDispatchItems(validMappedRows);
        }
      }

      // 4. Resolve Origin Warehouse Depot
      if (reservedSerials.length > 0 && reservedSerials[0].warehouse_id) {
        setDispatchWarehouseId(reservedSerials[0].warehouse_id);
      } else if (availableSerials.length > 0 && availableSerials[0].warehouse_id) {
        setDispatchWarehouseId(availableSerials[0].warehouse_id);
      } else if (warehouses.length > 0) {
        setDispatchWarehouseId(warehouses[0].id);
      }

      // 5. Handle Serial Numbers
      if (reservedSerials.length > 0) {
        const serialsList = reservedSerials.map((s) => s.serial_number);
        setSerialsText(serialsList.join('\n'));
      } else if (availableSerials.length > 0) {
        // Auto-suggest needed serialized count from available inventory serials
        const serializedCountNeeded = validMappedRows.reduce((acc, row) => {
          const prod = products.find((p) => p.id === row.product_id);
          return acc + (prod?.is_serial_tracked ? row.quantity : 0);
        }, 0);

        if (serializedCountNeeded > 0) {
          const suggested = availableSerials.slice(0, serializedCountNeeded).map((s) => s.serial_number);
          if (suggested.length > 0) {
            setSerialsText(suggested.join('\n'));
          }
        }
      }

      // 6. Auto-fill delivery address / notes
      const customer = order?.customers || order?.snapshot_data?.customer;
      if (customer) {
        setDeliveryNotes(`Deliver to ${customer.full_name || customer.name || 'Customer'}. Phone: ${customer.phone_e164 || customer.phone || 'N/A'}`);
      }

      const itemCount = validMappedRows.length;
      const serialCount = reservedSerials.length || (availableSerials.length > 0 ? 1 : 0);
      if (itemCount > 0) {
        setAutoFillMessage(`Auto-filled ${itemCount} components and ${serialCount} serial numbers from ${order?.order_number || 'Order'}`);
      } else {
        setAutoFillMessage(`Order ${order?.order_number} selected. You can click '+ Auto-fill Standard 5kW Solar Kit' below or pick components manually.`);
      }
    } catch (err) {
      console.warn('Auto-fill warning:', err);
    } finally {
      setAutoFillLoading(false);
    }
  };

  // One-click helper: Quick add single serial number to textarea
  const handleAddSerial = (sn) => {
    const current = serialsText ? serialsText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    if (!current.includes(sn)) {
      setSerialsText([...current, sn].join('\n'));
    }
  };

  // One-click helper: Auto-insert all needed available serials
  const handleAutoFillAvailableSerials = () => {
    const neededCount = dispatchItems.reduce((acc, row) => {
      const prod = products.find((p) => p.id === row.product_id);
      return acc + (prod?.is_serial_tracked ? row.quantity : 0);
    }, 0) || 1;

    const toInsert = availableSerials.slice(0, neededCount).map((s) => s.serial_number);
    setSerialsText(toInsert.join('\n'));
  };

  // One-click helper: Auto-populate standard 5kW residential solar kit components
  const handleFillStandardKit = () => {
    const pnl = products.find((p) => p.sku?.includes('PNL') || p.category_id === 'panels') || products[0];
    const inv = products.find((p) => p.sku?.includes('INV') || p.is_serial_tracked) || products[1];
    const str = products.find((p) => p.sku?.includes('STR')) || products[2];
    const cbl = products.find((p) => p.sku?.includes('CBL')) || products[3];

    const standardRows = [];
    if (pnl) standardRows.push({ product_id: pnl.id, quantity: 10 });
    if (inv) standardRows.push({ product_id: inv.id, quantity: 1 });
    if (str) standardRows.push({ product_id: str.id, quantity: 5 });
    if (cbl) standardRows.push({ product_id: cbl.id, quantity: 50 });

    if (standardRows.length > 0) {
      setDispatchItems(standardRows);
      if (availableSerials.length > 0) {
        setSerialsText(availableSerials.slice(0, 1).map((s) => s.serial_number).join('\n'));
        if (availableSerials[0]?.warehouse_id) {
          setDispatchWarehouseId(availableSerials[0].warehouse_id);
        }
      }
      setAutoFillMessage('Loaded standard 5kW rooftop solar kit (10 PV modules, 1 inverter, mounting structures, cabling)');
    }
  };

  // Fetch Dispatches List
  const fetchDispatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await api.get('/dispatches', params);
      setDispatches(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch material dispatches');
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchDispatches();
  }, [fetchDispatches]);

  // Load Reference Datasets for Modal
  const loadReferenceData = async () => {
    try {
      const [ordersRes, whRes, prodRes, serRes] = await Promise.all([
        api.get('/orders', { limit: 100 }),
        api.get('/inventory/warehouses', { limit: 50 }),
        api.get('/catalog/products', { limit: 100 }),
        api.get('/serials', { status: 'AVAILABLE', limit: 50 })
      ]);
      setOrders(ordersRes?.data || []);
      setWarehouses(whRes?.data || []);
      setProducts(prodRes?.data || []);
      setAvailableSerials(serRes?.data || []);
    } catch (err) {
      console.error('Failed to load reference data for dispatch:', err);
    }
  };

  const handleOpenCreateModal = () => {
    loadReferenceData();
    setDispatchOrderId('');
    setDispatchWarehouseId('');
    setDriverName('');
    setDriverPhone('');
    setVehicleNumber('');
    setDeliveryNotes('');
    setDispatchItems([{ product_id: '', quantity: 1 }]);
    setSerialsText('');
    setFormError('');
    setAutoFillMessage('');
    setShowCreateModal(true);
  };

  useEffect(() => {
    if (urlOrderId) {
      loadReferenceData().then(() => {
        setShowCreateModal(true);
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
      badgeVariant: o.status === 'MATERIAL_RESERVED' ? 'success' : 'info',
      searchTerms: `${o.order_number} ${o.customers?.full_name}`
    }));
  }, [orders]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((w) => ({
      value: w.id,
      label: `${w.name} (${w.code})`,
      subtitle: `${w.city}, ${w.state}`,
      searchTerms: `${w.name} ${w.code} ${w.city}`
    }));
  }, [warehouses]);

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: `${p.brand} ${p.model_name || p.sku}`,
      subtitle: `SKU: ${p.sku} • ${p.is_serial_tracked ? 'SERIALIZED' : 'STANDARD'}`,
      badge: p.is_serial_tracked ? 'SERIAL REQUIRED' : undefined,
      badgeVariant: 'warning',
      searchTerms: `${p.sku} ${p.brand} ${p.model_name}`
    }));
  }, [products]);

  // Handle Form Item Rows
  const handleItemChange = (index, field, value) => {
    const updated = [...dispatchItems];
    updated[index][field] = value;
    setDispatchItems(updated);
  };

  const handleAddItemRow = () => {
    setDispatchItems([...dispatchItems, { product_id: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (dispatchItems.length <= 1) return;
    setDispatchItems(dispatchItems.filter((_, idx) => idx !== index));
  };

  // Submit Create Dispatch
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!dispatchOrderId) {
      setFormError('Please select a Sales Order for material dispatch');
      return;
    }
    if (!dispatchWarehouseId) {
      setFormError('Please select the Origin Depot / Warehouse');
      return;
    }

    const validItems = dispatchItems.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setFormError('Please add at least one line item with quantity > 0');
      return;
    }

    const serialNumbers = serialsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const payload = {
        sales_order_id: dispatchOrderId,
        warehouse_id: dispatchWarehouseId,
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle_number: vehicleNumber.toUpperCase(),
        delivery_notes: deliveryNotes,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity)
        })),
        serial_numbers: serialNumbers
      };

      const res = await api.post('/dispatches', payload);
      setSuccess(`Material Dispatch ${res.data.dispatch_number} prepared successfully!`);
      setShowCreateModal(false);
      fetchDispatches();
    } catch (err) {
      setFormError(err.message || 'Failed to create material dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Advancement Handler
  const handleUpdateStatus = async (dispatchId, targetStatus) => {
    try {
      await api.patch(`/dispatches/${dispatchId}/status`, { status: targetStatus });
      setSuccess(`Dispatch status updated to ${targetStatus}`);
      fetchDispatches();
    } catch (err) {
      setError(err.message || 'Failed to update dispatch status');
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'success';
      case 'IN_TRANSIT':
        return 'info';
      case 'PREPARED':
        return 'warning';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  // Calculate high-level KPIs
  const kpis = useMemo(() => {
    const total = pagination.total || dispatches.length;
    const inTransit = dispatches.filter((d) => d.status === 'IN_TRANSIT').length;
    const delivered = dispatches.filter((d) => d.status === 'DELIVERED').length;
    const prepared = dispatches.filter((d) => d.status === 'PREPARED').length;
    return { total, inTransit, delivered, prepared };
  }, [dispatches, pagination]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight tracking-tight">Material Dispatch & Logistics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch reserved solar modules, inverters, and BOS to customer rooftops with truck tracking and serial allocation.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreateModal}>
          Prepare Dispatch
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-midnight/5 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-midnight" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Shipments</div>
            <div className="text-xl font-bold font-mono text-slate-900">{kpis.total}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5 text-sky-600 animate-pulse" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">In Transit</div>
            <div className="text-xl font-bold font-mono text-sky-600">{kpis.inTransit}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Delivered to Site</div>
            <div className="text-xl font-bold font-mono text-emerald-600">{kpis.delivered}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Prepared for Truck</div>
            <div className="text-xl font-bold font-mono text-amber-600">{kpis.prepared}</div>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search DSP#, truck number, driver, order..."
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
            {DISPATCH_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st === 'ALL' ? 'All Delivery Statuses' : st.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dispatches Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Clock className="w-6 h-6 animate-spin text-midnight" />
            Loading material dispatches...
          </div>
        ) : dispatches.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No material dispatches found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Dispatch #</th>
                  <th className="px-4 py-3">Sales Order & Customer</th>
                  <th className="px-4 py-3">Origin Warehouse</th>
                  <th className="px-4 py-3">Vehicle & Driver</th>
                  <th className="px-4 py-3">Items / Serials</th>
                  <th className="px-4 py-3">Dispatch Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Dispatch # */}
                    <td className="px-4 py-3 font-mono font-bold text-midnight whitespace-nowrap">
                      {d.dispatch_number}
                    </td>

                    {/* Sales Order & Customer */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {d.sales_orders?.order_number}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {d.sales_orders?.customers?.full_name} ({d.sales_orders?.system_capacity_kw} kW)
                      </div>
                    </td>

                    {/* Warehouse */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{d.warehouses?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{d.warehouses?.code}</div>
                    </td>

                    {/* Vehicle & Driver */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        {d.vehicle_number || 'Truck Unassigned'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {d.driver_name} {d.driver_phone ? `• ${d.driver_phone}` : ''}
                      </div>
                    </td>

                    {/* Line Items & Serials */}
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-700">
                        {d.dispatch_items?.length || 0} line {d.dispatch_items?.length === 1 ? 'item' : 'items'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {d.dispatch_serials?.length > 0 ? (
                          <span className="text-amber-700 font-bold flex items-center gap-1">
                            <Barcode className="w-3 h-3" /> {d.dispatch_serials.length} serials
                          </span>
                        ) : (
                          'No serial items'
                        )}
                      </div>
                    </td>

                    {/* Dispatch Date */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                      {new Date(d.dispatch_date).toLocaleDateString('en-IN')}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(d.status)}>
                        {d.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Quick Status Action Buttons */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {d.status === 'PREPARED' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'IN_TRANSIT')}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors"
                        >
                          Dispatch Truck &rarr;
                        </button>
                      )}
                      {d.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'DELIVERED')}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          ✓ Mark Delivered
                        </button>
                      )}
                      {d.status === 'DELIVERED' && (
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                        </span>
                      )}
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
          entityLabel="dispatches"
        />
      </div>

      {/* Prepare Dispatch Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Prepare Material Dispatch for Rooftop Installation"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {formError}
            </div>
          )}

          {/* Section 1: Sales Order & Origin Depot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <SearchableSelect
                required
                label="Select Sales Order *"
                options={orderOptions}
                value={dispatchOrderId}
                onChange={(val) => handleSelectOrder(val)}
                placeholder="Choose confirmed solar order..."
                searchPlaceholder="Search order number or customer..."
              />
            </div>

            <div>
              <SearchableSelect
                required
                label="Origin Dispatch Warehouse *"
                options={warehouseOptions}
                value={dispatchWarehouseId}
                onChange={(val) => setDispatchWarehouseId(val)}
                placeholder="Select dispatch depot..."
                searchPlaceholder="Search warehouse..."
              />
            </div>
          </div>

          {/* Auto-fill Indicator Alert */}
          {autoFillLoading && (
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
              Auto-fetching order components and reserved serial numbers...
            </div>
          )}
          {autoFillMessage && !autoFillLoading && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{autoFillMessage}</span>
            </div>
          )}

          {/* Section 2: Logistics & Driver */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Registration # *</label>
              <input
                type="text"
                required
                placeholder="e.g. GJ-01-AB-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Driver Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patel"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Driver Phone *</label>
              <input
                type="tel"
                required
                placeholder="+919876543210"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-midnight"
              />
            </div>
          </div>

          {/* Section 3: Material Line Items */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Materials Loaded onto Vehicle ({dispatchItems.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillStandardKit}
                  className="text-[11px] font-semibold text-solar-gold bg-midnight hover:bg-midnight-light px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-solar-gold" /> Auto-fill Standard 5kW Kit
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-xs text-midnight font-bold hover:text-solar-gold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Component
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {dispatchItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="col-span-8">
                    <SearchableSelect
                      required
                      options={productOptions}
                      value={item.product_id}
                      onChange={(val) => handleItemChange(idx, 'product_id', val)}
                      placeholder="Select hardware component..."
                      searchPlaceholder="Search component by SKU or brand..."
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    {dispatchItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Serial Numbers Barcode Scanning & Available Inventory Helper */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Barcode className="w-4 h-4 text-amber-600" />
                <span>Serialized Hardware Barcode Scanner</span>
              </label>
              {availableSerials.length > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFillAvailableSerials}
                  className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Auto-Insert Needed Serials
                </button>
              )}
            </div>

            {/* In-Stock Available Serials Helper Panel */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  In-Stock Available Serials in Inventory ({availableSerials.length})
                </span>
                <Link
                  to="/inventory/serials"
                  target="_blank"
                  className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-medium"
                >
                  Serial Explorer <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {availableSerials.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  No available serial numbers found in stock. Inward serialized inventory via{' '}
                  <Link to="/procurement/orders" target="_blank" className="text-sky-600 underline font-medium">
                    Procurement Goods Receipt (GRN)
                  </Link>.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-slate-600">
                    Click any serial number below to append it to your truck loading manifest:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {availableSerials.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleAddSerial(s.serial_number)}
                        className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 border border-slate-300 hover:border-amber-400 text-[11px] font-mono text-slate-800 transition-colors flex items-center gap-1 shadow-sm"
                        title={`${s.products?.brand || ''} ${s.products?.model_name || s.products?.sku || ''}`}
                      >
                        <span className="text-emerald-600 font-bold">+</span>
                        <span>{s.serial_number}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              One unique serial number per line for each serialized hardware item (Inverters, PV Panels):
            </p>
            <textarea
              rows={3}
              placeholder="SN-GROWATT-2026-001&#10;SN-GROWATT-2026-002"
              value={serialsText}
              onChange={(e) => setSerialsText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white outline-none focus:ring-2 focus:ring-midnight"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Delivery / Handling Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Call customer 30 minutes before arrival"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-midnight"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Confirm Dispatch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default DispatchesListPage;
