import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Search, ShieldCheck, Mail, Phone, 
  CheckCircle, XCircle, KeyRound, Filter, X
} from 'lucide-react';
import { api } from '../../api/client';
import { useDebounce } from '../../hooks/useDebounce';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination.jsx';

const AVAILABLE_ROLES = [
  { code: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Full system control' },
  { code: 'SALES_MANAGER', label: 'Sales Manager', desc: 'Sales team & quotation oversight' },
  { code: 'SALES_REP', label: 'Sales Representative', desc: 'Leads, CRM & Quotations' },
  { code: 'SURVEY_ENGINEER', label: 'Survey Engineer', desc: 'Site surveys & feasibility reports' },
  { code: 'INVENTORY_MANAGER', label: 'Inventory Manager', desc: 'Warehouse inventory & dispatch' },
  { code: 'ACCOUNTANT', label: 'Accountant', desc: 'Invoices, payments & financial accounting' },
  { code: 'TECHNICIAN', label: 'Field Technician', desc: 'Field installations, maintenance & tickets' },
  { code: 'CUSTOMER', label: 'Customer', desc: 'Self-service client portal access' }
];

export const UsersListPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Reset page to 1 whenever search or role changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_e164: '+91',
    password: '',
    role_codes: ['SALES_REP']
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit };
      if (debouncedSearch && debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (roleFilter) params.role = roleFilter;

      const res = await api.get('/users', { params });
      setUsers(res.data || []);
      if (res.meta?.pagination) {
        setPagination(res.meta.pagination);
      } else {
        setPagination({
          page,
          limit,
          total: res.data?.length || 0,
          totalPages: Math.ceil((res.data?.length || 0) / limit) || 1
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleClearSearch = () => {
    setSearchInput('');
  };

  const handleRoleToggle = (code) => {
    setFormData((prev) => {
      const exists = prev.role_codes.includes(code);
      if (exists) {
        if (prev.role_codes.length === 1) return prev; // Keep at least one
        return { ...prev, role_codes: prev.role_codes.filter((r) => r !== code) };
      } else {
        return { ...prev, role_codes: [...prev.role_codes, code] };
      }
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.phone_e164.startsWith('+91') || formData.phone_e164.length < 13) {
      setFormError('Please enter a valid E.164 phone number (e.g. +919876543210)');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/users', formData);
      setShowCreateModal(false);
      setFormData({
        full_name: '',
        email: '',
        phone_e164: '+91',
        password: '',
        role_codes: ['SALES_REP']
      });
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} user "${user.full_name}"?`)) {
      return;
    }

    try {
      await api.put(`/users/${user.id}`, {
        is_active: !user.is_active
      });
      fetchUsers();
    } catch (err) {
      alert(err.message || `Failed to ${action} user`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-midnight font-display">User & Role Management</h1>
          <p className="text-sm text-slate-500">Manage internal employees, roles, and platform access</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Create User
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full text-sm pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none w-full sm:w-auto"
          >
            <option value="">All Roles</option>
            {AVAILABLE_ROLES.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-700">No users found</p>
            <p className="text-sm">Create a new user or adjust your search filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Contact</th>
                  <th className="px-6 py-3.5">Assigned Roles</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Created</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-midnight/10 text-midnight flex items-center justify-center font-bold text-sm">
                          {u.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.full_name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {u.phone_e164}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles?.map((r) => (
                          <span
                            key={r}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              r === 'SUPER_ADMIN'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center text-xs font-semibold text-solar-green">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-semibold text-red-500">
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant={u.is_active ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Users Pagination */}
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
          entityLabel="users"
          pageSizes={[10, 20, 50, 100]}
        />
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="name@sunpower.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (E.164) *</label>
              <input
                type="text"
                required
                placeholder="+919876543210"
                value={formData.phone_e164}
                onChange={(e) => setFormData({ ...formData, phone_e164: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Assign Roles *</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {AVAILABLE_ROLES.map((r) => {
                const checked = formData.role_codes.includes(r.code);
                return (
                  <label
                    key={r.code}
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      checked ? 'bg-amber-50/60 border-solar-gold' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleRoleToggle(r.code)}
                      className="mt-0.5 rounded border-slate-300 text-midnight focus:ring-solar-gold"
                    />
                    <div className="ml-2.5">
                      <p className="text-xs font-semibold text-slate-800">{r.label}</p>
                      <p className="text-[11px] text-slate-500">{r.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
