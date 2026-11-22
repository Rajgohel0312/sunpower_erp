import React, { useState, useEffect } from 'react';
import {
  Sun,
  ShieldCheck,
  FileText,
  LifeBuoy,
  Plus,
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
  AlertCircle,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Download,
  KeyRound
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import Badge from '../../components/common/Badge.jsx';
import ChangePasswordModal from '../../components/common/ChangePasswordModal.jsx';

export function CustomerPortalPage() {
  const [activeTab, setActiveTab] = useState('tracker');
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // New Ticket Modal
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketCategory, setTicketCategory] = useState('INVERTER_FAULT');
  const [ticketPriority, setTicketPriority] = useState('MEDIUM');
  const [ticketIssue, setTicketIssue] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    try {
      setLoading(true);
      const [profRes, projRes, invRes, warRes, tckRes] = await Promise.all([
        apiRequest('/portal/profile'),
        apiRequest('/portal/projects'),
        apiRequest('/portal/invoices'),
        apiRequest('/portal/warranties'),
        apiRequest('/portal/tickets')
      ]);

      setProfile(profRes.data);
      setProjects(projRes.data || []);
      setInvoices(invRes.data || []);
      setWarranties(warRes.data || []);
      setTickets(tckRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load customer portal data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!ticketIssue) {
      alert('Please describe your issue');
      return;
    }

    try {
      setSubmittingTicket(true);
      await apiRequest('/portal/tickets', {
        method: 'POST',
        body: JSON.stringify({
          category: ticketCategory,
          priority: ticketPriority,
          reported_issue: ticketIssue,
          sales_order_id: projects[0]?.id || null
        })
      });

      setShowTicketModal(false);
      setTicketIssue('');
      // Reload tickets
      const tckRes = await apiRequest('/portal/tickets');
      setTickets(tckRes.data || []);
      alert('Your service request has been logged. Our solar technician will review it within 24-48 hours.');
    } catch (err) {
      alert(err.message || 'Failed to submit service ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium">Opening your SunPower Customer Portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center text-rose-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-2" />
        <p className="text-base font-semibold">{error}</p>
      </div>
    );
  }

  const customer = profile?.customer;
  const activeProject = projects[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Customer Welcome Header */}
      <div className="bg-gradient-to-r from-midnight to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-midnight-dark">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-solar-gold text-xs font-semibold uppercase tracking-widest">
              <Sun className="w-4 h-4 fill-solar-gold" />
              Customer Self-Service Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight mt-1 text-white">
              Welcome, {customer?.full_name || 'Valued Customer'}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Registered Phone: {customer?.phone_e164} | Customer Code: {customer?.customer_code}
            </p>
            <div className="mt-3">
              <button
                onClick={() => setShowChangePassword(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5 text-solar-gold" />
                Change Password
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10">
              <span className="block text-xl font-bold text-white">{profile?.stats?.total_projects || 0}</span>
              <span className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Active Plants</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10">
              <span className="block text-xl font-bold text-solar-gold">{profile?.stats?.active_warranties || 0}</span>
              <span className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Warranties</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10">
              <span className="block text-xl font-bold text-emerald-400">{profile?.stats?.open_tickets || 0}</span>
              <span className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Open Tickets</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'tracker', label: 'My Solar Plant Tracker', icon: Sun },
          { id: 'invoices', label: 'Invoices & Billing', icon: FileText },
          { id: 'warranties', label: 'Equipment Warranties', icon: ShieldCheck },
          { id: 'tickets', label: 'Service & Support Desk', icon: LifeBuoy }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-solar-gold text-slate-900 bg-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-solar-gold' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: Solar Plant Tracker */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          {projects.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <Sun className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-700">No Solar Installations Found</h3>
              <p className="text-sm mt-1">Your registered solar contracts will appear here.</p>
            </div>
          ) : (
            projects.map((proj) => (
              <div key={proj.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-solar-gold">Rooftop Solar Plant</span>
                    <h3 className="text-xl font-bold text-slate-900 font-display mt-0.5">
                      Order {proj.order_number}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Contract Value: <strong>₹{Number(proj.contract_value).toLocaleString('en-IN')}</strong> | Status: <strong className="text-slate-800">{proj.fulfillment_status}</strong>
                    </p>
                  </div>
                  <Badge variant={proj.fulfillment_status}>{proj.fulfillment_status}</Badge>
                </div>

                {/* 5-Step Milestone Progress Bar */}
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-4">
                    Current Execution Phase: <strong className="text-slate-900">{proj.milestone_label}</strong>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {[
                      { step: 1, title: '1. Order Confirmed', desc: 'Design & BOM Complete' },
                      { step: 2, title: '2. Hardware Allocated', desc: 'Serials Reserved in Depot' },
                      { step: 3, title: '3. Dispatched to Site', desc: 'Panels & Inverter on Truck' },
                      { step: 4, title: '4. Installation in Progress', desc: 'Rooftop Wiring & Structure' },
                      { step: 5, title: '5. Commissioned & Sync', desc: 'Generating Green Electricity' }
                    ].map((step) => {
                      const isCompleted = proj.milestone_step >= step.step;
                      const isCurrent = proj.milestone_step === step.step;

                      return (
                        <div
                          key={step.step}
                          className={`p-3.5 rounded-xl border text-xs transition-all ${
                            isCompleted
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300"></div>
                            )}
                            <span className={isCurrent ? 'text-slate-900 font-bold' : ''}>{step.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{step.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery & Crew Quick Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Truck className="w-5 h-5 text-indigo-600" />
                    <div>
                      <span className="font-bold text-slate-800 block">Material Dispatch Status</span>
                      <span>{proj.dispatches?.[0]?.dispatch_number || 'Dispatch Scheduled'} ({proj.dispatches?.[0]?.status || 'In Transit'})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Wrench className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="font-bold text-slate-800 block">Installation Execution</span>
                      <span>Job: {proj.installation_job?.job_number || 'Pending Assignment'} ({proj.installation_job?.status || 'Scheduled'})</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: Invoices & Billing */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <h3 className="text-lg font-bold text-slate-900 font-display mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-solar-gold" />
              Milestone Tax Invoices
            </h3>

            {invoices.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No milestone invoices issued yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Milestone</th>
                      <th className="py-3 px-4">Invoice Date</th>
                      <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                      <th className="py-3 px-4 text-right">Paid (₹)</th>
                      <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-700">{inv.milestone_type}</td>
                        <td className="py-3 px-4 font-sans text-slate-500">
                          {new Date(inv.invoice_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-semibold">
                          ₹{Number(inv.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-600 font-bold">
                          ₹{Number(inv.amount_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <Badge variant={inv.status}>{inv.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Equipment Warranties */}
      {activeTab === 'warranties' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 font-display mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-solar-gold" />
              Active Manufacturer Warranties & Policy Certificates
            </h3>

            {warranties.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                Warranties will be automatically registered upon rooftop commissioning sign-off.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {warranties.map((w) => (
                  <div key={w.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-700">{w.warranty_certificate_number}</span>
                      <Badge variant={w.status}>{w.status}</Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{w.products?.model_name || 'Solar PV Hardware'}</h4>
                      <p className="text-xs text-slate-500 font-mono">Serial: {w.serial_numbers?.serial_number || 'Plant Level'}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                      <div>Coverage: <strong>{w.policy_snapshot?.duration_years || 10} Years</strong></div>
                      <div>Valid Through: <strong>{new Date(w.end_date).toLocaleDateString('en-IN')}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Service & Support Desk */}
      {activeTab === 'tickets' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-solar-gold" />
                Service & Warranty Tickets
              </h3>
              <button
                onClick={() => setShowTicketModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-bold rounded-lg text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Raise Service Request
              </button>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <LifeBuoy className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No service tickets logged. Your solar plant is operating normally.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <div key={t.id} className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{t.ticket_number}</span>
                        <Badge variant={t.status}>{t.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1">{t.reported_issue}</p>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Category: {t.category} | Created: {new Date(t.created_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raise Service Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-solar-gold" />
                Raise Service Request
              </h3>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Issue Category *
                </label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="INVERTER_FAULT">Inverter Error Code / Red Light</option>
                  <option value="LOW_GENERATION">Lower Solar Energy Generation</option>
                  <option value="PANEL_DAMAGE">Solar Panel Physical / Glass Damage</option>
                  <option value="GRID_TRIP">AC Breaker / Grid Synchronization Trip</option>
                  <option value="MONITORING_OFFLINE">Wi-Fi / Mobile App Monitoring Offline</option>
                  <option value="STRUCTURE_LOOSE">Mounting Structure / Clamping Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Urgency / Priority
                </label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="LOW">Low (General Query)</option>
                  <option value="MEDIUM">Medium (Normal Issue)</option>
                  <option value="HIGH">High (Plant Completely Down)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Describe the Issue *
                </label>
                <textarea
                  required
                  rows="3"
                  value={ticketIssue}
                  onChange={(e) => setTicketIssue(e.target.value)}
                  placeholder="Tell us what error code is shown on the inverter or describe the symptoms..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-5 py-2 bg-solar-gold hover:bg-yellow-500 text-midnight font-bold rounded-lg text-sm"
                >
                  {submittingTicket ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Change Password Dialog */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}

export default CustomerPortalPage;
