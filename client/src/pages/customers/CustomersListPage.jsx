import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, Building, Phone, ChevronRight, Filter, X } from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

export function CustomersListPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone_e164: '',
    email: '',
    customer_type: 'RESIDENTIAL',
    gstin: '',
    address: {
      address_line1: '',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380001'
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCustomers = useCallback(async (searchQuery = search, type = typeFilter) => {
    setLoading(true);
    try {
      const query = { limit: 50 };
      if (searchQuery && searchQuery.trim()) query.search = searchQuery.trim();
      if (type) query.customer_type = type;

      const res = await api.get('/crm/customers', query);
      setCustomers(res?.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search, typeFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, typeFilter, fetchCustomers]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      await api.post('/crm/customers', formData);
      setShowCreateModal(false);
      setFormData({
        full_name: '',
        phone_e164: '',
        email: '',
        customer_type: 'RESIDENTIAL',
        gstin: '',
        address: { address_line1: '', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' }
      });
      fetchCustomers();
    } catch (err) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-midnight flex items-center gap-2">
            <Users className="w-6 h-6 text-solar-green" />
            Customer Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Master records across all solar project installations and ongoing warranties.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
          New Customer Record
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, code (CUST-2026-...), or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-midnight"
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

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-midnight outline-none w-full sm:w-auto bg-white"
          >
            <option value="">All Customer Types</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="HOUSING_SOCIETY">Housing Society</option>
            <option value="AGRICULTURAL">Agricultural</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Customer Code</th>
                <th className="py-3.5 px-4">Full Name</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">Registered Date</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No customer accounts found.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-midnight">
                      {cust.customer_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <Link to={`/customers/${cust.id}`} className="hover:text-solar-gold hover:underline">
                        {cust.full_name}
                      </Link>
                      {cust.email && <span className="block text-xs font-normal text-slate-400">{cust.email}</span>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {cust.phone_e164}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={cust.customer_type === 'COMMERCIAL' ? 'warning' : 'info'}>
                        {cust.customer_type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                      {cust.gstin || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {new Date(cust.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link to={`/customers/${cust.id}`}>
                        <Button variant="outline" size="sm" icon={ChevronRight}>
                          Profile
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

      {/* Create Customer Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Customer Record"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer / Company Name *</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ramesh Patel"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number (E.164) *</label>
              <input
                type="text"
                required
                value={formData.phone_e164}
                onChange={(e) => setFormData({ ...formData, phone_e164: e.target.value })}
                placeholder="9825012345"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@sunpower.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer Classification</label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="RESIDENTIAL">Residential Rooftop</option>
                <option value="COMMERCIAL">Commercial Entity</option>
                <option value="INDUSTRIAL">Industrial Solar</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Primary Site Address *</label>
            <input
              type="text"
              required
              value={formData.address.address_line1}
              onChange={(e) => setFormData({ ...formData, address: { ...formData.address, address_line1: e.target.value } })}
              placeholder="Building / Plot, Street"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                value={formData.address.pincode}
                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, pincode: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Save Customer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default CustomersListPage;
