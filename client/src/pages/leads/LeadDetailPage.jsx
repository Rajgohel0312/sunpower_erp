import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Zap,
  IndianRupee,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  PhoneCall,
  UserCheck,
  AlertCircle,
  XCircle,
  Plus,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

const getMinDateTimeLocal = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [engineers, setEngineers] = useState([]);
  const [surveyFormData, setSurveyFormData] = useState({ assigned_engineer_id: '', scheduled_at: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [activityData, setActivityData] = useState({ activity_type: 'CALL', note: '' });
  const [followUpData, setFollowUpData] = useState({ scheduled_at: '', notes: '' });
  const [lostReason, setLostReason] = useState('');

  const fetchLead = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/crm/leads/${id}`);
      setLead(res?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleStageTransition = async (newStage, reason = null) => {
    try {
      await api.patch(`/crm/leads/${id}`, {
        stage: newStage,
        lost_reason: reason
      });
      setShowLostModal(false);
      setLostReason('');
      fetchLead();
    } catch (err) {
      alert(err.message || 'Stage transition failed');
    }
  };

  const handleConvertToCustomer = async () => {
    if (!window.confirm('Convert this lead to a permanent customer record?')) return;
    try {
      await api.post(`/crm/leads/${id}/convert`, {
        customer_type: 'RESIDENTIAL'
      });
      fetchLead();
    } catch (err) {
      alert(err.message || 'Conversion failed');
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/crm/leads/${id}/activities`, {
        activity_type: activityData.activity_type,
        details: { note: activityData.note }
      });
      setShowActivityModal(false);
      setActivityData({ activity_type: 'CALL', note: '' });
      fetchLead();
    } catch (err) {
      alert(err.message || 'Failed to add activity');
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'CALL':
        return <PhoneCall className="w-3.5 h-3.5 text-blue-600" />;
      case 'WHATSAPP':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
      case 'MEETING':
        return <Calendar className="w-3.5 h-3.5 text-purple-600" />;
      case 'STAGE_CHANGE':
        return <Layers className="w-3.5 h-3.5 text-amber-600" />;
      case 'ASSIGNMENT':
        return <UserCheck className="w-3.5 h-3.5 text-indigo-600" />;
      case 'CONVERSION':
        return <CheckCircle2 className="w-3.5 h-3.5 text-solar-green" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const renderActivityDetails = (act) => {
    let details = act.details;
    if (typeof details === 'string') {
      try {
        details = JSON.parse(details);
      } catch {
        details = { note: details };
      }
    }
    if (!details) return <span className="text-slate-400 italic">No additional details</span>;

    // 1. Stage Change
    if (act.activity_type === 'STAGE_CHANGE') {
      if (details.action === 'LEAD_CREATED') {
        return (
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
            <span className="text-slate-700">Lead captured and initialized at stage</span>
            <Badge variant={details.stage || 'NEW'}>{details.stage || 'NEW'}</Badge>
            {details.source && (
              <span className="text-slate-500 font-sans">via <strong className="text-slate-700">{details.source}</strong></span>
            )}
            {details.capacity_kw && (
              <span className="text-slate-500 font-sans">({details.capacity_kw} kW)</span>
            )}
          </div>
        );
      }

      return (
        <div className="mt-1 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600">Stage transitioned:</span>
            {details.from_stage && <Badge variant="outline">{details.from_stage}</Badge>}
            <span className="text-slate-400 font-mono">→</span>
            <Badge variant={details.to_stage || 'primary'}>{details.to_stage}</Badge>
          </div>
          {details.lost_reason && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
              <span className="font-semibold">Reason for Loss:</span> {details.lost_reason}
            </div>
          )}
        </div>
      );
    }

    // 2. Assignment
    if (act.activity_type === 'ASSIGNMENT') {
      return (
        <div className="mt-1 space-y-1 text-xs">
          <div className="text-slate-700">
            Assigned to <strong className="text-midnight">{details.assignee_name || 'Team Member'}</strong>
          </div>
          {details.notes && (
            <p className="text-xs text-slate-500 italic mt-0.5">"{details.notes}"</p>
          )}
        </div>
      );
    }

    // 3. Customer Conversion
    if (act.activity_type === 'CONVERSION') {
      return (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-emerald-700 font-semibold">Lead converted to Customer Account:</span>
          {details.customer_id ? (
            <Link
              to={`/customers/${details.customer_id}`}
              className="font-mono font-bold text-midnight bg-amber-100 hover:bg-solar-gold/40 px-2 py-0.5 rounded border border-amber-300 transition-colors"
            >
              {details.customer_code || 'View Customer'}
            </Link>
          ) : (
            <span className="font-mono font-bold text-midnight px-2 py-0.5 rounded bg-amber-100">
              {details.customer_code}
            </span>
          )}
        </div>
      );
    }

    // 4. Notes / Calls / WhatsApp / Meeting
    const noteText = details.note || details.notes || details.summary || details.message;
    if (noteText) {
      return <p className="mt-1 text-slate-700 whitespace-pre-wrap text-xs leading-relaxed">{noteText}</p>;
    }

    // 5. Clean structured attribute tags (never raw JSON string)
    const keys = Object.keys(details);
    if (keys.length > 0) {
      return (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {keys.map((k) => (
            <span key={k} className="inline-flex items-center text-[11px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded">
              <strong className="mr-1 capitalize">{k.replace(/_/g, ' ')}:</strong>{' '}
              {typeof details[k] === 'object' ? JSON.stringify(details[k]) : String(details[k])}
            </span>
          ))}
        </div>
      );
    }

    return <span className="text-slate-400 italic text-xs">No notes provided</span>;
  };

  const handleCreateFollowUp = async (e) => {
    e.preventDefault();

    if (new Date(followUpData.scheduled_at).getTime() < Date.now() - 5 * 60 * 1000) {
      alert('Follow-up scheduled date and time cannot be in the past. Please select today or a future date.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/crm/leads/${id}/follow-ups`, {
        scheduled_at: new Date(followUpData.scheduled_at).toISOString(),
        notes: followUpData.notes
      });
      setShowFollowUpModal(false);
      setFollowUpData({ scheduled_at: '', notes: '' });
      fetchLead();
    } catch (err) {
      alert(err.message || 'Failed to schedule follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId) => {
    try {
      await api.patch(`/crm/follow-ups/${followUpId}`, { status: 'COMPLETED' });
      fetchLead();
    } catch (err) {
      alert(err.message || 'Failed to update follow-up');
    }
  };

  const handleOpenSurveyModal = async () => {
    setShowSurveyModal(true);
    try {
      const res = await api.get('/users', { limit: 100 });
      setEngineers(res?.data || []);
    } catch (err) {
      console.error('Failed to load users for survey:', err);
    }
  };

  const handleScheduleSurvey = async (e) => {
    e.preventDefault();

    if (new Date(surveyFormData.scheduled_at).getTime() < Date.now() - 5 * 60 * 1000) {
      alert('Survey scheduled date and time cannot be in the past. Please select today or a future date.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/surveys', {
        lead_id: id,
        assigned_engineer_id: surveyFormData.assigned_engineer_id,
        scheduled_at: new Date(surveyFormData.scheduled_at).toISOString(),
        notes: surveyFormData.notes
      });
      setShowSurveyModal(false);
      setSurveyFormData({ assigned_engineer_id: '', scheduled_at: '', notes: '' });
      await fetchLead();
    } catch (err) {
      alert(err.message || 'Failed to schedule survey');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading lead file...</div>;
  }

  if (error || !lead) {
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl">
        {error || 'Lead not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/leads">
            <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-500">{lead.lead_number}</span>
              <Badge variant={lead.stage}>{lead.stage}</Badge>
            </div>
            <h2 className="text-xl font-bold text-midnight">{lead.full_name}</h2>
          </div>
        </div>

        {/* Lead Stage Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.stage === 'NEW' && (
            <Button variant="primary" size="sm" onClick={() => handleStageTransition('CONTACTED')}>
              Mark Contacted
            </Button>
          )}
          {lead.stage === 'CONTACTED' && (
            <Button variant="primary" size="sm" onClick={() => handleStageTransition('QUALIFIED')}>
              Mark Qualified
            </Button>
          )}
          {/* Survey Actions */}
          {lead.surveys && lead.surveys.length > 0 ? (
            <Link to={`/surveys/${lead.surveys[0].id}`}>
              <Button variant="accent" size="sm" icon={ClipboardCheck}>
                Open Survey ({lead.surveys[0].survey_number})
              </Button>
            </Link>
          ) : (
            <Button variant="accent" size="sm" icon={ClipboardCheck} onClick={handleOpenSurveyModal}>
              Schedule Site Survey
            </Button>
          )}

          {/* Convert to Customer Button */}
          {lead.customer_id ? (
            <Link to={`/customers/${lead.customer_id}`}>
              <Badge variant="success" className="font-mono text-xs py-1.5 px-3">
                Customer: {lead.customer_code || 'Linked'}
              </Badge>
            </Link>
          ) : (
            <Button variant="green" size="sm" icon={UserCheck} onClick={handleConvertToCustomer}>
              Convert to Customer
            </Button>
          )}

          {lead.stage !== 'LOST' && lead.stage !== 'WON' && (
            <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => setShowLostModal(true)}>
              Mark Lost
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Specifications & Contact Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Lead Information
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="font-mono font-medium">{lead.phone_e164}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-3 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{lead.email}</span>
                </div>
              )}
              <div className="flex items-start gap-3 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                <div>
                  <div>{lead.site_address || 'No street address specified'}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    {lead.city || 'Ahmedabad'}, {lead.state || 'Gujarat'} - {lead.pincode || '380001'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Capacity Req.</span>
                <span className="text-base font-bold text-midnight">{lead.requested_capacity_kw || '—'} kW</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Monthly Bill</span>
                <span className="text-base font-bold text-midnight">
                  {lead.monthly_electricity_bill ? `₹${Number(lead.monthly_electricity_bill).toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-500 space-y-1">
              <div><span className="font-medium text-slate-700">System Type:</span> {lead.system_type?.replace(/_/g, ' ')}</div>
              <div><span className="font-medium text-slate-700">Source:</span> {lead.source}</div>
              <div><span className="font-medium text-slate-700">Created:</span> {new Date(lead.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Follow-ups Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Follow-ups & Tasks
              </h3>
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setShowFollowUpModal(true)}>
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {lead.follow_ups?.length === 0 ? (
                <p className="text-xs text-slate-400">No scheduled follow-ups.</p>
              ) : (
                lead.follow_ups?.map((fu) => (
                  <div key={fu.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-600 font-semibold">
                        {new Date(fu.scheduled_at).toLocaleString()}
                      </span>
                      {fu.status === 'COMPLETED' ? (
                        <span className="text-emerald-700 font-semibold">Completed</span>
                      ) : (
                        <button
                          onClick={() => handleCompleteFollowUp(fu.id)}
                          className="text-xs text-midnight hover:underline font-medium"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                    {fu.notes && <p className="text-slate-600">{fu.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Site Surveys & Activity Stream */}
        <div className="lg:col-span-2 space-y-6">
          {/* Site Surveys & Technical Engineering Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-solar-gold" />
                <h3 className="text-sm font-bold text-midnight">Site Surveys & Rooftop Engineering</h3>
                {lead.surveys && lead.surveys.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {lead.surveys.length}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleOpenSurveyModal}
                className="text-xs"
              >
                Schedule Survey
              </Button>
            </div>

            {(!lead.surveys || lead.surveys.length === 0) ? (
              <div className="py-6 text-center text-slate-400 text-xs space-y-2">
                <p>No site surveys scheduled yet for this lead.</p>
                <Button variant="accent" size="sm" icon={Calendar} onClick={handleOpenSurveyModal}>
                  Schedule First Site Survey
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {lead.surveys.map((survey) => (
                  <div
                    key={survey.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-midnight">{survey.survey_number}</span>
                        <Badge variant={survey.status}>{survey.status}</Badge>
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          📅 <strong>Scheduled:</strong> {new Date(survey.scheduled_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {survey.assigned_engineer_name && (
                          <span>
                            👷 <strong>Engineer:</strong> {survey.assigned_engineer_name}
                          </span>
                        )}
                        {survey.roof_type && (
                          <span>
                            🏠 <strong>Roof:</strong> {survey.roof_type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {survey.proposed_capacity_kw && (
                          <span>
                            ⚡ <strong>Capacity:</strong> {survey.proposed_capacity_kw} kW
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-0.5">
                        <span>📷 {survey.photos_count || 0} Photos</span>
                        <span>•</span>
                        <span>📋 {survey.boms_count || 0} BOMs</span>
                        {survey.reviewed_at && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-sans font-semibold">✓ Feasibility Reviewed</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center sm:self-center">
                      <Link to={`/surveys/${survey.id}`}>
                        <Button variant="primary" size="sm" icon={ChevronRight} className="font-semibold text-xs whitespace-nowrap">
                          Open Survey & BOM Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <h3 className="text-sm font-bold text-midnight">Activity Log & Interaction History</h3>
              </div>
              <Button variant="accent" size="sm" icon={Plus} onClick={() => setShowActivityModal(true)}>
                Log Interaction
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {lead.activities?.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No activity logged yet.</div>
              ) : (
                lead.activities?.map((act) => (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mt-0.5 flex-shrink-0 shadow-sm border border-slate-200">
                      {getActivityIcon(act.activity_type)}
                    </div>
                    <div className="flex-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-xs tracking-wide">
                          {act.activity_type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {new Date(act.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="mt-1">
                        {renderActivityDetails(act)}
                      </div>
                      {act.actor_name && (
                        <span className="block mt-1.5 text-[10px] text-slate-400 font-medium">
                          Logged by: {act.actor_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Log Communication Activity"
      >
        <form onSubmit={handleAddActivity} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Activity Type</label>
            <select
              value={activityData.activity_type}
              onChange={(e) => setActivityData({ ...activityData, activity_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="CALL">Phone Call</option>
              <option value="WHATSAPP">WhatsApp Discussion</option>
              <option value="MEETING">In-Person Meeting</option>
              <option value="NOTE">Internal Note</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Call Summary</label>
            <textarea
              required
              rows={3}
              value={activityData.note}
              onChange={(e) => setActivityData({ ...activityData, note: e.target.value })}
              placeholder="e.g. Discussed rooftop dimensions and subsidy availability..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Save Activity</Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Follow-up Modal */}
      <Modal
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        title="Schedule Follow-up Reminder"
      >
        <form onSubmit={handleCreateFollowUp} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              required
              min={getMinDateTimeLocal()}
              value={followUpData.scheduled_at}
              onChange={(e) => setFollowUpData({ ...followUpData, scheduled_at: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Task / Goal</label>
            <textarea
              rows={2}
              value={followUpData.notes}
              onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
              placeholder="Call to follow up on quotation decision..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowFollowUpModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Schedule</Button>
          </div>
        </form>
      </Modal>

      {/* Mark Lost Modal */}
      <Modal
        isOpen={showLostModal}
        onClose={() => setShowLostModal(false)}
        title="Mark Lead as Lost"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Per company policy, a reason is required when archiving a lead as lost.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lost Reason *</label>
            <textarea
              required
              rows={3}
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Roof structural condition unsuitable / Chose competitor due to pricing..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowLostModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!lostReason.trim()}
              onClick={() => handleStageTransition('LOST', lostReason)}
            >
              Confirm Lost
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Survey Modal */}
      <Modal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        title="Schedule Rooftop Site Survey"
      >
        <form onSubmit={handleScheduleSurvey} className="space-y-4">
          <div>
            <SearchableSelect
              required
              label="Assign Survey Engineer *"
              options={engineers.map((u) => ({
                value: u.id,
                label: u.full_name,
                subtitle: u.roles?.join(', ') || 'Staff',
                searchTerms: `${u.full_name} ${u.email || ''}`
              }))}
              value={surveyFormData.assigned_engineer_id}
              onChange={(val) => setSurveyFormData((prev) => ({ ...prev, assigned_engineer_id: val }))}
              placeholder="Search and select field engineer..."
              searchPlaceholder="Filter engineers by name..."
              emptyMessage="No matching engineers found"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              required
              min={getMinDateTimeLocal()}
              value={surveyFormData.scheduled_at}
              onChange={(e) => setSurveyFormData({ ...surveyFormData, scheduled_at: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Site Access Instructions</label>
            <textarea
              rows={3}
              placeholder="e.g. Terrace access through internal stairs..."
              value={surveyFormData.notes}
              onChange={(e) => setSurveyFormData({ ...surveyFormData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowSurveyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Schedule Survey
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default LeadDetailPage;
