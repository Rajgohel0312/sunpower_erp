import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  LifeBuoy,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Barcode,
  Calendar,
  Building,
  ShieldCheck,
  Wrench,
  Sparkles,
  RefreshCw,
  Send,
  ArrowRightLeft,
  FileText,
  Check,
  X
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

export function ServiceTicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status transition state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // New Note State
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Technician Assignment State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assigningTech, setAssigningTech] = useState(false);

  // RMA Hardware Swap State
  const [isRmaModalOpen, setIsRmaModalOpen] = useState(false);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [rmaForm, setRmaForm] = useState({
    defective_serial_id: '',
    replacement_serial_id: '',
    reason: '',
    transfer_warranty: true,
    notes: ''
  });
  const [executingRma, setExecutingRma] = useState(false);
  const [rmaError, setRmaError] = useState(null);

  // Fetch ticket details
  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/tickets/${id}`);
      if (res.data) {
        setTicket(res.data);
      }
    } catch (err) {
      console.error('Failed to load ticket:', err);
      setError(err.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Load Technicians
  const loadTechnicians = async () => {
    try {
      const res = await api.get('/users?limit=50');
      if (res.data) {
        setTechnicians(res.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  // Load Available Warehouse Serials for RMA
  const loadAvailableSerials = async () => {
    try {
      const res = await api.get('/serials?status=AVAILABLE&limit=100');
      if (res.data) {
        setAvailableSerials(res.data);
      }
    } catch (err) {
      console.error('Failed to load serials for RMA:', err);
    }
  };

  // Status update handler
  const handleStatusChange = async (newStatus, notes = '') => {
    try {
      setUpdatingStatus(true);
      await api.patch(`/tickets/${id}/status`, {
        status: newStatus,
        notes: notes || undefined,
        resolution_notes: newStatus === 'RESOLVED' ? notes : undefined
      });
      setIsResolveModalOpen(false);
      setResolutionNotes('');
      fetchTicket();
    } catch (err) {
      alert(err.message || 'Failed to update ticket status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Assign Technician handler
  const handleAssignTechnician = async (e) => {
    e.preventDefault();
    if (!selectedTechId) return;
    try {
      setAssigningTech(true);
      await api.post(`/tickets/${id}/assign`, { technician_id: selectedTechId });
      setIsAssignModalOpen(false);
      fetchTicket();
    } catch (err) {
      alert(err.message || 'Failed to assign technician');
    } finally {
      setAssigningTech(false);
    }
  };

  // Add Note handler
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      setSubmittingNote(true);
      await api.post(`/tickets/${id}/notes`, {
        activity_type: 'NOTE',
        notes: noteText.trim()
      });
      setNoteText('');
      fetchTicket();
    } catch (err) {
      alert(err.message || 'Failed to add activity note');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Execute RMA Swap handler
  const handleExecuteRma = async (e) => {
    e.preventDefault();
    setRmaError(null);

    if (!rmaForm.replacement_serial_id) {
      setRmaError('Please select a replacement hardware serial number');
      return;
    }
    if (!rmaForm.reason || rmaForm.reason.trim().length < 3) {
      setRmaError('Failure / replacement reason is required');
      return;
    }

    try {
      setExecutingRma(true);
      await api.post(`/tickets/${id}/rma-swap`, {
        defective_serial_id: ticket.serial_number_id,
        replacement_serial_id: rmaForm.replacement_serial_id,
        reason: rmaForm.reason.trim(),
        transfer_warranty: rmaForm.transfer_warranty,
        notes: rmaForm.notes || undefined
      });
      setIsRmaModalOpen(false);
      fetchTicket();
    } catch (err) {
      console.error('Failed to execute RMA swap:', err);
      setRmaError(err.message || 'Failed to execute equipment replacement');
    } finally {
      setExecutingRma(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-3 border-solar-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Ticket Not Found</h2>
        <p className="text-sm text-slate-500">{error || 'Could not locate the requested service ticket.'}</p>
        <Link to="/tickets">
          <Button variant="outline" className="flex items-center gap-2 mx-auto">
            <ArrowLeft className="w-4 h-4" /> Back to Support Desk
          </Button>
        </Link>
      </div>
    );
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">CRITICAL PRIORITY</span>;
      case 'HIGH':
        return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">HIGH PRIORITY</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-sky-100 text-sky-800">MEDIUM PRIORITY</span>;
      case 'LOW':
        return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700">LOW PRIORITY</span>;
      default:
        return <Badge variant="neutral">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="warning">Open</Badge>;
      case 'ASSIGNED':
        return <Badge variant="info">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">In Progress</span>;
      case 'WAITING_PARTS':
        return <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Waiting Parts</span>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">Closed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header with Breadcrumb & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/tickets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-midnight transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Support Tickets
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-midnight tracking-tight">
              {ticket.ticket_number}
            </h1>
            {getPriorityBadge(ticket.priority)}
            {getStatusBadge(ticket.status)}
          </div>
        </div>

        {/* Workflow Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {ticket.status === 'OPEN' && (
            <Button
              variant="accent"
              onClick={() => {
                loadTechnicians();
                setIsAssignModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <User className="w-4 h-4" /> Assign Technician
            </Button>
          )}

          {ticket.status === 'ASSIGNED' && (
            <Button
              variant="primary"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('IN_PROGRESS', 'Field technician started inspection on site')}
              className="flex items-center gap-1.5"
            >
              <Wrench className="w-4 h-4" /> Start Field Work
            </Button>
          )}

          {ticket.status === 'IN_PROGRESS' && (
            <>
              <Button
                variant="outline"
                disabled={updatingStatus}
                onClick={() => handleStatusChange('WAITING_PARTS', 'Waiting for replacement RMA component')}
                className="flex items-center gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <Clock className="w-4 h-4" /> Mark Waiting Parts
              </Button>

              {ticket.serial_number_id && (
                <Button
                  variant="accent"
                  onClick={() => {
                    loadAvailableSerials();
                    setIsRmaModalOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Execute RMA Swap
                </Button>
              )}

              <Button
                variant="primary"
                onClick={() => setIsResolveModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Resolve Ticket
              </Button>
            </>
          )}

          {ticket.status === 'WAITING_PARTS' && (
            <>
              {ticket.serial_number_id && (
                <Button
                  variant="accent"
                  onClick={() => {
                    loadAvailableSerials();
                    setIsRmaModalOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Execute RMA Swap
                </Button>
              )}

              <Button
                variant="primary"
                disabled={updatingStatus}
                onClick={() => handleStatusChange('IN_PROGRESS', 'Parts arrived; resumed on-site repair')}
                className="flex items-center gap-1.5"
              >
                <Wrench className="w-4 h-4" /> Resume Work
              </Button>
            </>
          )}

          {ticket.status === 'RESOLVED' && (
            <Button
              variant="primary"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('CLOSED', 'Customer confirmed normal generation; ticket closed')}
              className="flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Close Ticket
            </Button>
          )}

          {['RESOLVED', 'CLOSED'].includes(ticket.status) && (
            <Button
              variant="outline"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('IN_PROGRESS', 'Issue recurred; ticket reopened')}
              className="flex items-center gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              <RefreshCw className="w-4 h-4" /> Reopen Ticket
            </Button>
          )}
        </div>
      </div>

      {/* 2. Main Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Reported Issue, Equipment & Activity Log */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reported Issue Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Reported Incident</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                Category: {ticket.category.replace('_', ' ')}
              </span>
            </div>

            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {ticket.reported_issue}
            </p>

            {ticket.resolution_notes && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resolution Summary ({ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString() : 'Resolved'}):
                </div>
                <p className="leading-relaxed">{ticket.resolution_notes}</p>
              </div>
            )}
          </div>

          {/* Serialized Equipment & Active Warranty Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Covered Equipment & Warranty</span>
              {ticket.warranties ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <ShieldCheck className="w-4 h-4" /> Active Warranty Valid
                </span>
              ) : (
                <span className="text-xs text-slate-400">No Serial Linked</span>
              )}
            </div>

            {ticket.serial_numbers ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Equipment Model</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {ticket.serial_numbers.products?.model_name || ticket.serial_numbers.products?.brand || 'Solar Inverter'}
                  </span>
                  <Link
                    to={`/inventory/serials?search=${ticket.serial_numbers.serial_number}`}
                    className="inline-flex items-center gap-1 font-mono text-sky-600 font-semibold mt-1 hover:underline"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    SN: {ticket.serial_numbers.serial_number}
                  </Link>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                  <span className="text-amber-800 text-[10px] uppercase font-bold block">Warranty Coverage</span>
                  {ticket.warranties ? (
                    <div>
                      <Link
                        to={`/warranties?search=${ticket.warranties.warranty_certificate_number}`}
                        className="font-mono font-bold text-midnight text-sm mt-0.5 hover:underline block"
                      >
                        {ticket.warranties.warranty_certificate_number}
                      </Link>
                      <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">
                        Expires: {new Date(ticket.warranties.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 mt-1 block">Out of Warranty or Unregistered</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                This ticket is registered for overall rooftop balance of system / electrical wiring.
              </p>
            )}

            {/* Past RMA Replacements on this Ticket */}
            {ticket.warranty_replacements && ticket.warranty_replacements.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block mb-2">
                  Executed Hardware Replacements (RMA)
                </span>
                <div className="space-y-2">
                  {ticket.warranty_replacements.map((r) => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 font-mono font-semibold">
                          <span className="text-rose-600 line-through">
                            {r.serial_numbers_warranty_replacements_defective_serial_idToserial_numbers?.serial_number}
                          </span>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-emerald-600">
                            {r.serial_numbers_warranty_replacements_replacement_serial_idToserial_numbers?.serial_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Reason: {r.reason}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(r.replaced_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity Log & Technician Notes */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block border-b border-slate-100 pb-3">
              Activity History & Field Notes
            </span>

            {/* Timeline */}
            <div className="space-y-3">
              {ticket.ticket_activities?.map((act) => (
                <div key={act.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="font-semibold text-slate-700">
                      {act.users?.full_name || 'System'}
                    </span>
                    <span>{new Date(act.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {act.details?.notes || act.details?.message || JSON.stringify(act.details)}
                  </p>
                </div>
              ))}
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="pt-2 flex gap-2">
              <input
                type="text"
                placeholder="Log diagnostic note, inverter measurements, or field observations..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!noteText.trim() || submittingNote}
                className="flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Add Note
              </Button>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Customer & Plant Details Sidebar */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="uppercase font-bold text-slate-500 tracking-wider text-[10px]">Beneficiary Customer</span>
              <Link
                to={`/customers/${ticket.customer_id}`}
                className="text-sky-600 font-semibold hover:underline"
              >
                View Profile
              </Link>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 text-sm">{ticket.customers?.full_name}</h3>
              <p className="text-slate-500 font-mono mt-0.5">{ticket.customers?.phone_e164}</p>
              {ticket.customers?.email && (
                <p className="text-slate-500 mt-0.5">{ticket.customers?.email}</p>
              )}
            </div>

            {ticket.customers?.customer_addresses && ticket.customers.customer_addresses.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px]">
                <span className="font-bold block text-slate-700 mb-0.5">Installation Site:</span>
                {ticket.customers.customer_addresses[0].address_line1}, {ticket.customers.customer_addresses[0].city} ({ticket.customers.customer_addresses[0].pincode})
              </div>
            )}
          </div>

          {/* Assigned Field Crew Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="uppercase font-bold text-slate-500 tracking-wider text-[10px]">Assigned Field Technician</span>
              <button
                onClick={() => {
                  loadTechnicians();
                  setIsAssignModalOpen(true);
                }}
                className="text-sky-600 font-semibold hover:underline"
              >
                Change
              </button>
            </div>

            {ticket.users_service_tickets_assigned_technician_idTousers ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-midnight text-white flex items-center justify-center font-bold">
                  {ticket.users_service_tickets_assigned_technician_idTousers.full_name?.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">
                    {ticket.users_service_tickets_assigned_technician_idTousers.full_name}
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    {ticket.users_service_tickets_assigned_technician_idTousers.email}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-center space-y-2">
                <p className="font-medium">No technician assigned yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    loadTechnicians();
                    setIsAssignModalOpen(true);
                  }}
                  className="w-full"
                >
                  Assign Field Tech
                </Button>
              </div>
            )}
          </div>

          {/* Solar Project Links */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
            <span className="uppercase font-bold text-slate-500 tracking-wider text-[10px] block border-b border-slate-100 pb-3">
              Linked Solar Project
            </span>

            {ticket.sales_orders ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Sales Order</span>
                <Link
                  to={`/orders/${ticket.sales_order_id}`}
                  className="font-mono font-semibold text-sky-600 hover:underline"
                >
                  {ticket.sales_orders.order_number}
                </Link>
              </div>
            ) : null}

            {ticket.installation_jobs ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Installation Job</span>
                <Link
                  to={`/installations/${ticket.installation_job_id}`}
                  className="font-mono font-semibold text-sky-600 hover:underline"
                >
                  {ticket.installation_jobs.job_number}
                </Link>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">SLA Due Date</span>
              <span className="font-mono font-semibold text-slate-800">
                {ticket.sla_due_date ? new Date(ticket.sla_due_date).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Technician Assignment Modal */}
      {isAssignModalOpen && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Assign Field Technician"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAssignTechnician} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Technician</label>
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
                required
              >
                <option value="">Choose technician...</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={assigningTech}>
                {assigningTech ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Resolve Ticket Modal */}
      {isResolveModalOpen && (
        <Modal
          isOpen={isResolveModalOpen}
          onClose={() => setIsResolveModalOpen(false)}
          title="Resolve Support Ticket"
          maxWidth="max-w-lg"
        >
          <div className="p-6 space-y-4 text-xs">
            <p className="text-slate-600">
              Please enter the technical root cause and resolution summary for the customer and audit log.
            </p>

            <textarea
              rows={4}
              placeholder="e.g. Inverter AC disconnect breaker reset; DC string Voc verified at 380V. Cloud telemetry back online."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40 text-xs"
              required
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setIsResolveModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!resolutionNotes.trim() || updatingStatus}
                onClick={() => handleStatusChange('RESOLVED', resolutionNotes)}
              >
                Confirm Resolution
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. RMA Equipment Swap Modal */}
      {isRmaModalOpen && (
        <Modal
          isOpen={isRmaModalOpen}
          onClose={() => setIsRmaModalOpen(false)}
          title="Execute Serialized RMA Equipment Swap"
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleExecuteRma} className="p-6 space-y-4 text-xs">
            {rmaError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{rmaError}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800">
              <div className="font-bold flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" />
                Defective Unit Being Removed:
              </div>
              <div className="font-mono font-bold mt-1 text-sm text-midnight">
                {ticket.serial_numbers?.serial_number}
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                {ticket.serial_numbers?.products?.model_name || ticket.serial_numbers?.products?.brand}
              </div>
            </div>

            {/* Select Replacement Serial */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Replacement Hardware Serial from Warehouse Stock <span className="text-rose-500">*</span>
              </label>
              <select
                value={rmaForm.replacement_serial_id}
                onChange={(e) => setRmaForm({ ...rmaForm, replacement_serial_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-solar-gold/40"
                required
              >
                <option value="">Choose Available Serial...</option>
                {availableSerials.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.serial_number} — {s.products?.model_name || s.products?.brand} ({s.warehouses?.name || 'Warehouse'})
                  </option>
                ))}
              </select>
            </div>

            {/* Failure Reason */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Failure & Swap Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Internal IGBT circuit failure due to lightning surge; manufacturer approved full replacement."
                value={rmaForm.reason}
                onChange={(e) => setRmaForm({ ...rmaForm, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-solar-gold/40 text-xs"
                required
              />
            </div>

            {/* Transfer Warranty Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="transfer_warranty"
                checked={rmaForm.transfer_warranty}
                onChange={(e) => setRmaForm({ ...rmaForm, transfer_warranty: e.target.checked })}
                className="rounded border-slate-300 text-midnight focus:ring-solar-gold"
              />
              <label htmlFor="transfer_warranty" className="font-semibold text-slate-700 cursor-pointer">
                Automatically transfer remaining active warranty duration to the replacement hardware
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setIsRmaModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="accent"
                disabled={executingRma}
                className="flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {executingRma ? 'Executing RMA Swap...' : 'Execute RMA Swap & Resolve'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default ServiceTicketDetailPage;
