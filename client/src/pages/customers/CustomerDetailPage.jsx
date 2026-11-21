import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Building2, MapPin, Phone, Mail, FileText, 
  Plus, CheckCircle, Clock, Calendar, ShieldCheck, Tag
} from 'lucide-react';
import { api } from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

export const CustomerDetailPage = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [submittingAddress, setSubmittingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    address_type: 'SITE',
    address_line1: '',
    address_line2: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '',
    is_primary: false
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [custRes, timelineRes] = await Promise.all([
        api.get(`/crm/customers/${id}`),
        api.get(`/crm/customers/${id}/timeline`)
      ]);
      setCustomer(custRes.data);
      setTimeline(timelineRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAddress(true);
      await api.post(`/crm/customers/${id}/addresses`, addressForm);
      setShowAddressModal(false);
      setAddressForm({
        address_type: 'SITE',
        address_line1: '',
        address_line2: '',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '',
        is_primary: false
      });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to add address');
    } finally {
      setSubmittingAddress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
        <p className="font-semibold">{error || 'Customer not found'}</p>
        <Link to="/customers" className="mt-4 inline-block text-midnight underline font-medium">
          Back to Customers Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link to="/customers" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-midnight">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customers
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-midnight font-display">{customer.full_name}</h1>
              <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700">
                {customer.customer_code}
              </span>
              <Badge variant="warning">{customer.customer_type}</Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
              <span className="flex items-center">
                <Phone className="w-4 h-4 mr-1.5 text-slate-400" />
                <a href={`tel:${customer.phone_e164}`} className="hover:underline font-mono">{customer.phone_e164}</a>
              </span>
              {customer.email && (
                <span className="flex items-center">
                  <Mail className="w-4 h-4 mr-1.5 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                </span>
              )}
              {customer.gstin && (
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-slate-400" />
                  GSTIN: <span className="font-mono ml-1 font-semibold">{customer.gstin}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" onClick={() => setShowAddressModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Address
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Addresses & Contact Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-midnight font-display flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-solar-green" /> Addresses
              </h2>
              <span className="text-xs text-slate-500">{customer.addresses?.length || 0} registered</span>
            </div>

            {(!customer.addresses || customer.addresses.length === 0) ? (
              <p className="text-sm text-slate-400 italic">No addresses registered yet.</p>
            ) : (
              <div className="space-y-3">
                {customer.addresses.map((addr) => (
                  <div key={addr.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {addr.address_type}
                      </span>
                      {addr.is_primary && (
                        <span className="text-xs text-solar-green font-semibold flex items-center">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-800">{addr.address_line1}</p>
                    {addr.address_line2 && <p className="text-xs text-slate-500">{addr.address_line2}</p>}
                    <p className="text-xs text-slate-600 mt-1">
                      {addr.city}, {addr.state} - <span className="font-mono font-medium">{addr.pincode}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: 360-Degree Unified Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked Leads */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-midnight font-display mb-4 flex items-center">
              <Tag className="w-5 h-5 mr-2 text-solar-gold" /> Linked Leads & Inquiries
            </h2>

            {(!timeline?.leads || timeline.leads.length === 0) ? (
              <p className="text-sm text-slate-400 italic">No previous lead records linked to this customer.</p>
            ) : (
              <div className="space-y-3">
                {timeline.leads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Link to={`/leads/${lead.id}`} className="font-semibold text-midnight hover:text-solar-gold transition-colors">
                          {lead.lead_number}
                        </Link>
                        <Badge variant="primary">{lead.stage}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center space-x-4">
                        <span>Source: <strong className="text-slate-700">{lead.source}</strong></span>
                        {lead.requested_capacity_kw && (
                          <span>Capacity: <strong className="text-slate-700 font-mono">{lead.requested_capacity_kw} kW</strong></span>
                        )}
                        <span>Created: {new Date(lead.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link to={`/leads/${lead.id}`}>
                      <Button variant="ghost" size="sm">View Lead</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quotations / Orders / Installations Placeholder Feed */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-midnight font-display mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-midnight" /> Project Timeline & Milestones
            </h2>
            
            <div className="border-l-2 border-slate-200 pl-4 space-y-6 ml-2 my-2">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-solar-green ring-4 ring-white"></div>
                <p className="text-sm font-semibold text-slate-800">Customer Onboarded</p>
                <p className="text-xs text-slate-500">
                  Registered into SunPower ERP on {new Date(customer.created_at).toLocaleDateString()}
                </p>
              </div>

              {timeline?.leads?.map((l) => (
                <div key={l.id} className="relative">
                  <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-solar-gold ring-4 ring-white"></div>
                  <p className="text-sm font-semibold text-slate-800">Lead Converted ({l.lead_number})</p>
                  <p className="text-xs text-slate-500">
                    Lead converted to customer account. Stage: {l.stage}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      <Modal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Add Customer Address"
      >
        <form onSubmit={handleAddAddress} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address Type</label>
            <select
              value={addressForm.address_type}
              onChange={(e) => setAddressForm({ ...addressForm, address_type: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
            >
              <option value="SITE">Installation Site</option>
              <option value="BILLING">Billing Address</option>
              <option value="RESIDENTIAL">Residential Address</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 1 *</label>
            <input
              type="text"
              required
              placeholder="Building, Street, Landmark"
              value={addressForm.address_line1}
              onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 2 (Optional)</label>
            <input
              type="text"
              placeholder="Area, Sector"
              value={addressForm.address_line2}
              onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={addressForm.state}
                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode *</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="380001"
                value={addressForm.pincode}
                onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-solar-gold outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={addressForm.is_primary}
              onChange={(e) => setAddressForm({ ...addressForm, is_primary: e.target.checked })}
              className="rounded border-slate-300 text-midnight focus:ring-solar-gold"
            />
            <label htmlFor="is_primary" className="text-sm text-slate-700 cursor-pointer">
              Set as primary address
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setShowAddressModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAddress}>
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
