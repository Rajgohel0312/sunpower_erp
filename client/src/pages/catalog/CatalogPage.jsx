import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, Plus, Search, Filter, Zap, CheckCircle2, 
  X, Tag, Shield, Cpu, Layers
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

export function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    category_id: '',
    sku: '',
    brand: '',
    model_name: '',
    rated_capacity_w: '',
    unit_code: 'NOS',
    standard_cost: '',
    tax_rate_pct: 12,
    hsn_code: '85414011',
    is_serial_tracked: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = { limit: 100 };
      if (selectedCategory !== 'ALL') query.category_code = selectedCategory;
      if (debouncedSearch && debouncedSearch.trim()) query.search = debouncedSearch.trim();

      const [prodsRes, catsRes] = await Promise.all([
        api.get('/catalog/products', query),
        api.get('/catalog/categories')
      ]);

      setProducts(prodsRes?.data || []);
      setCategories(catsRes?.data || []);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      await api.post('/catalog/products', {
        ...formData,
        sku: formData.sku.toUpperCase(),
        rated_capacity_w: formData.rated_capacity_w ? Number(formData.rated_capacity_w) : null,
        standard_cost: Number(formData.standard_cost),
        tax_rate_pct: Number(formData.tax_rate_pct)
      });

      setShowCreateModal(false);
      setFormData({
        category_id: '',
        sku: '',
        brand: '',
        model_name: '',
        rated_capacity_w: '',
        unit_code: 'NOS',
        standard_cost: '',
        tax_rate_pct: 12,
        hsn_code: '85414011',
        is_serial_tracked: false
      });
      fetchData(selectedCategory, search);
    } catch (err) {
      setFormError(err.message || 'Failed to create product.');
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
            <Package className="w-6 h-6 text-solar-gold" />
            Product Catalog & Components
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Master engineering catalog of PV panels, inverters, structures, cables, and distribution boxes.
          </p>
        </div>
        <Button variant="accent" icon={Plus} onClick={() => setShowCreateModal(true)}>
          Add Product SKU
        </Button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search catalog by SKU, brand name (e.g. Waaree, Growatt, Polycab), or model..."
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

        {/* Category Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg font-medium text-slate-700 focus:ring-2 focus:ring-midnight outline-none bg-white w-full sm:w-auto cursor-pointer"
          >
            <option value="ALL">All Component Categories</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">SKU / Code</th>
                <th className="py-3.5 px-4">Product & Model</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Rating / Specs</th>
                <th className="py-3.5 px-4">Standard Cost</th>
                <th className="py-3.5 px-4">Tax (GST)</th>
                <th className="py-3.5 px-4">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Loading component catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No components found matching current filters.
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-midnight">
                      {prod.sku}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{prod.model_name}</div>
                      <div className="text-xs text-slate-500 font-medium">{prod.brand}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {prod.category?.name || 'Component'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {prod.rated_capacity_w ? (
                        <span className="font-semibold text-midnight">
                          {Number(prod.rated_capacity_w) >= 1000 
                            ? `${(Number(prod.rated_capacity_w) / 1000).toFixed(1)} kW` 
                            : `${Number(prod.rated_capacity_w)} W`}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-midnight">
                      ₹{Number(prod.standard_cost).toLocaleString('en-IN')} <span className="text-[10px] text-slate-400 font-sans font-normal">/ {prod.unit_code}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {Number(prod.tax_rate_pct)}% <span className="text-[10px] text-slate-400">({prod.hsn_code || '8541'})</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {prod.is_serial_tracked ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-solar-green bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Serialized
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-sans">Batch/Bulk</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Product Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Product SKU to Catalog"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Product Category *</label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SKU Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. PNL-WAAREE-540W"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Brand / Manufacturer *</label>
              <input
                type="text"
                required
                placeholder="e.g. Waaree, Growatt, Polycab"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Model Name / Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Aditya 540W Mono Perc Half-Cut"
                value={formData.model_name}
                onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rated Capacity (Watts)</label>
              <input
                type="number"
                placeholder="e.g. 540 or 5000"
                value={formData.rated_capacity_w}
                onChange={(e) => setFormData({ ...formData, rated_capacity_w: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unit of Measure *</label>
              <select
                value={formData.unit_code}
                onChange={(e) => setFormData({ ...formData, unit_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="NOS">NOS (Numbers)</option>
                <option value="SET">SET (Kits / Pairs)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="LOT">LOT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Standard Cost (₹) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="e.g. 11500"
                value={formData.standard_cost}
                onChange={(e) => setFormData({ ...formData, standard_cost: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GST Tax Rate (%)</label>
              <select
                value={formData.tax_rate_pct}
                onChange={(e) => setFormData({ ...formData, tax_rate_pct: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono"
              >
                <option value="12">12% (Standard Solar PV)</option>
                <option value="18">18% (Structures, Cables, Inverters)</option>
                <option value="5">5%</option>
                <option value="0">0% (Exempt)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">HSN Code</label>
              <input
                type="text"
                placeholder="e.g. 85414011"
                value={formData.hsn_code}
                onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="is_serial_tracked"
              checked={formData.is_serial_tracked}
              onChange={(e) => setFormData({ ...formData, is_serial_tracked: e.target.checked })}
              className="rounded border-slate-300 text-midnight focus:ring-solar-gold"
            />
            <label htmlFor="is_serial_tracked" className="text-xs text-slate-700 cursor-pointer">
              Track item with individual serial numbers (Mandatory for PV Panels & Inverters)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save to Catalog
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
export default CatalogPage;
