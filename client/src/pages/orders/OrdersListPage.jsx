import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  ChevronRight,
  Filter,
  X,
  Zap,
  Building,
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
  AlertCircle
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Pagination from '../../components/common/Pagination.jsx';

const ORDER_STATUSES = [
  'ALL',
  'CONFIRMED',
  'IN_ENGINEERING',
  'MATERIAL_RESERVED',
  'DISPATCHED',
  'INSTALLATION_IN_PROGRESS',
  'COMMISSIONED',
  'CANCELLED'
];

export function OrdersListPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const query = { page, limit };
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (statusFilter !== 'ALL') query.status = statusFilter;

      const res = await api.get('/orders', query);
      setOrders(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getExecutionBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="info">Confirmed</Badge>;
      case 'IN_ENGINEERING':
        return <Badge variant="neutral">Engineering</Badge>;
      case 'MATERIAL_RESERVED':
        return <Badge variant="warning">Materials Reserved</Badge>;
      case 'DISPATCHED':
        return <Badge variant="info">Dispatched</Badge>;
      case 'INSTALLATION_IN_PROGRESS':
        return <Badge variant="warning">Installation in Progress</Badge>;
      case 'COMMISSIONED':
        return <Badge variant="success">Commissioned</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'FULLY_PAID':
        return <Badge variant="success">Fully Paid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning">Partially Paid</Badge>;
      default:
        return <Badge variant="danger">Payment Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-solar-gold" />
            Confirmed Sales Orders
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Operationally confirmed EPC projects, immutable commercial snapshots, payment milestones, and fulfillment tracking.
          </p>
        </div>
      </div>

      {/* Standard Single-Row Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Full-width Search Input with Clear Button */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders by SO number, customer name, code, or mobile..."
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
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st === 'ALL' ? 'All Order Statuses' : st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Order #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Capacity</th>
                <th className="py-3.5 px-4">Net Contract Value</th>
                <th className="py-3.5 px-4">Advance Received</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4">Fulfillment Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    Loading sales orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No sales orders found matching current filters.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-midnight">
                      {ord.order_number}
                      <span className="block text-[10px] text-slate-400 font-sans font-normal">
                        QT: {ord.quotations?.quotation_number}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{ord.customers.full_name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {ord.customers.customer_code} • {ord.customers.phone_e164}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-midnight">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-solar-gold" />
                        {Number(ord.system_capacity_kw)} kW
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-midnight">
                      ₹{Number(ord.net_customer_payable).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-600 font-semibold">
                      ₹{Number(ord.advance_payment_received).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      {getPaymentBadge(ord.payment_status)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getExecutionBadge(ord.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link to={`/orders/${ord.id}`}>
                        <Button variant="outline" size="sm" icon={ChevronRight}>
                          Track Project
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
          entityLabel="orders"
          pageSizes={[10, 20, 50, 100]}
        />
      </div>
    </div>
  );
}
export default OrdersListPage;
