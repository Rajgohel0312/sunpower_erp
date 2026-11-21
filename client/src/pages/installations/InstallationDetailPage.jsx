import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  User,
  Phone,
  MapPin,
  Camera,
  ShieldCheck,
  Zap,
  Building,
  Check,
  X,
  FileCheck2,
  Star,
  Award,
  Upload,
  ExternalLink
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

const STAGE_ORDER = [
  'ASSIGNED',
  'EN_ROUTE',
  'ON_SITE',
  'STRUCTURE_COMPLETE',
  'PANELS_MOUNTED',
  'WIRING_COMPLETE',
  'TESTING_IN_PROGRESS',
  'COMMISSIONED'
];

export function InstallationDetailPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step Update State
  const [updatingStepKey, setUpdatingStepKey] = useState(null);
  const [stepMeasurement, setStepMeasurement] = useState('');
  const [stepRemarks, setStepRemarks] = useState('');

  // Photo Upload Modal State
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [photoCategory, setPhotoCategory] = useState('STRUCTURE');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoLat, setPhotoLat] = useState('23.0225');
  const [photoLng, setPhotoLng] = useState('72.5714');

  // Customer Sign-off Modal State
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [signoffSubmitting, setSignoffSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerRating, setCustomerRating] = useState(5);
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [isNetMeterInstalled, setIsNetMeterInstalled] = useState(true);
  const [discomConsumerNumber, setDiscomConsumerNumber] = useState('');
  const [testedPeakPowerKw, setTestedPeakPowerKw] = useState('');

  // Simple Canvas Drawing Ref for Signature
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/installations/${id}`);
      setJob(res?.data || null);
      if (res?.data?.sales_orders?.customers) {
        setCustomerName(res.data.sales_orders.customers.full_name || '');
        setCustomerPhone(res.data.sales_orders.customers.phone_e164 || '');
      }
      if (res?.data?.sales_orders?.system_capacity_kw) {
        setTestedPeakPowerKw(String(res.data.sales_orders.system_capacity_kw));
      }
    } catch (err) {
      setError(err.message || 'Failed to load installation job details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Stage Advancement Handler
  const handleAdvanceStage = async (nextStatus) => {
    try {
      await api.patch(`/installations/${id}/status`, { status: nextStatus });
      setSuccess(`Job stage advanced to ${nextStatus.replace(/_/g, ' ')}`);
      fetchJob();
    } catch (err) {
      setError(err.message || 'Failed to advance job status');
    }
  };

  // Toggle Checklist Step
  const handleToggleChecklistStep = async (stepKey, currentCompleted) => {
    try {
      await api.patch(`/installations/${id}/checklist/${stepKey}`, {
        is_completed: !currentCompleted,
        measured_value: stepMeasurement || undefined,
        remarks: stepRemarks || undefined
      });
      setSuccess(`Checklist step updated!`);
      setUpdatingStepKey(null);
      setStepMeasurement('');
      setStepRemarks('');
      fetchJob();
    } catch (err) {
      setError(err.message || 'Failed to update checklist step');
    }
  };

  // Upload Photo Evidence
  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    if (!photoUrl) return;

    setPhotoSubmitting(true);
    try {
      await api.post(`/installations/${id}/photos`, {
        photo_category: photoCategory,
        file_url: photoUrl,
        caption: photoCaption || undefined,
        gps_lat: photoLat ? Number(photoLat) : undefined,
        gps_lng: photoLng ? Number(photoLng) : undefined
      });
      setSuccess('Geotagged site photo uploaded successfully!');
      setShowPhotoModal(false);
      setPhotoUrl('');
      setPhotoCaption('');
      fetchJob();
    } catch (err) {
      setError(err.message || 'Failed to upload photo evidence');
    } finally {
      setPhotoSubmitting(false);
    }
  };

  // Signature Canvas Drawing Logic
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#102B46';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Submit Customer Commissioning Sign-Off
  const handleSubmitSignoff = async (e) => {
    e.preventDefault();
    if (!hasSignature && !canvasRef.current) {
      setError('Please provide customer digital signature on the signature pad');
      return;
    }

    const signatureSvg = canvasRef.current ? canvasRef.current.toDataURL() : '<svg>CustomerSignature</svg>';

    setSignoffSubmitting(true);
    try {
      await api.post(`/installations/${id}/signoff`, {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_signature_svg: signatureSvg,
        customer_rating: Number(customerRating),
        customer_feedback: customerFeedback || undefined,
        is_net_meter_installed: Boolean(isNetMeterInstalled),
        discom_consumer_number: discomConsumerNumber || undefined,
        tested_peak_power_kw: testedPeakPowerKw ? Number(testedPeakPowerKw) : undefined
      });
      setSuccess('Installation successfully commissioned with digital certificate!');
      setShowSignoffModal(false);
      fetchJob();
    } catch (err) {
      setError(err.message || 'Failed to complete commissioning sign-off');
    } finally {
      setSignoffSubmitting(false);
    }
  };

  // Checklist Completion Stats
  const checklistStats = useMemo(() => {
    if (!job?.installation_checklists) return { total: 0, completed: 0, pct: 0, allMandatoryDone: false };
    const total = job.installation_checklists.length;
    const completed = job.installation_checklists.filter((c) => c.is_completed).length;
    const mandatory = job.installation_checklists.filter((c) => c.is_mandatory);
    const mandatoryCompleted = mandatory.filter((c) => c.is_completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allMandatoryDone = mandatory.length > 0 && mandatory.length === mandatoryCompleted;
    return { total, completed, pct, allMandatoryDone };
  }, [job]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
        <Clock className="w-6 h-6 animate-spin text-midnight" />
        Loading installation job details...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Installation Job not found.</p>
        <Link to="/installations" className="text-xs text-midnight underline mt-2 inline-block">
          &larr; Back to Installation Jobs
        </Link>
      </div>
    );
  }

  const signoff = job.installation_signoffs?.[0] || null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/installations"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-midnight font-medium mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Installation Jobs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-midnight tracking-tight">
              {job.job_number}
            </h1>
            <Badge variant={job.status === 'COMMISSIONED' ? 'success' : 'info'}>
              {job.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Order: <strong className="text-slate-800 font-mono">{job.sales_orders?.order_number}</strong> • Customer: <strong className="text-slate-800">{job.sales_orders?.customers?.full_name}</strong> ({job.sales_orders?.system_capacity_kw} kW)
          </p>
        </div>

        {/* Quick Action Stage Advancements */}
        <div className="flex items-center gap-2 flex-wrap">
          {job.status === 'ASSIGNED' && (
            <Button variant="primary" onClick={() => handleAdvanceStage('EN_ROUTE')}>
              Start Crew Transit (EN_ROUTE) &rarr;
            </Button>
          )}
          {job.status === 'EN_ROUTE' && (
            <Button variant="primary" onClick={() => handleAdvanceStage('ON_SITE')}>
              Arrived on Rooftop (ON_SITE) &rarr;
            </Button>
          )}
          {job.status === 'ON_SITE' && (
            <Button variant="primary" onClick={() => handleAdvanceStage('STRUCTURE_COMPLETE')}>
              Structure Complete &rarr;
            </Button>
          )}
          {job.status === 'STRUCTURE_COMPLETE' && (
            <Button variant="primary" onClick={() => handleAdvanceStage('PANELS_MOUNTED')}>
              Panels Mounted &rarr;
            </Button>
          )}
          {job.status === 'PANELS_MOUNTED' && (
            <Button variant="primary" onClick={() => handleAdvanceStage('WIRING_COMPLETE')}>
              Wiring Complete &rarr;
            </Button>
          )}
          {job.status === 'WIRING_COMPLETE' && (
            <Button variant="primary" onClick={() => handleAdvanceStage('TESTING_IN_PROGRESS')}>
              Testing in Progress &rarr;
            </Button>
          )}

          {job.status !== 'COMMISSIONED' && (
            <Button
              variant="accent"
              icon={Award}
              disabled={!checklistStats.allMandatoryDone}
              onClick={() => setShowSignoffModal(true)}
            >
              Customer Commissioning Sign-Off
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 font-bold ml-2">✕</button>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Execution Pipeline Tracker */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-semibold text-slate-700 uppercase tracking-wider">Field Installation Pipeline</span>
          <span className="font-mono">{checklistStats.completed} of {checklistStats.total} technical steps verified ({checklistStats.pct}%)</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${job.status === 'COMMISSIONED' ? 'bg-emerald-500' : 'bg-midnight'}`}
            style={{ width: `${checklistStats.pct}%` }}
          />
        </div>
      </div>

      {/* Grid: Site Details & Dispatch Hardware */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Site Details */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-midnight" />
              <span>Customer & Site Logistics</span>
            </h2>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Customer Name</span>
                <span className="font-bold text-slate-900 text-sm">
                  {job.sales_orders?.customers?.full_name}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Contact Number</span>
                <a
                  href={`tel:${job.sales_orders?.customers?.phone_e164}`}
                  className="font-mono text-midnight font-bold hover:underline flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-solar-green" />
                  {job.sales_orders?.customers?.phone_e164}
                </a>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Rooftop Site Location</span>
                <div className="font-medium text-slate-700 mt-0.5 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>
                    {job.sales_orders?.leads?.site_address || 'Address registered on order'},{' '}
                    {job.sales_orders?.leads?.city} {job.sales_orders?.leads?.pincode}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">System Sizing</span>
                <span className="font-mono font-bold text-slate-900">
                  ⚡ {job.sales_orders?.system_capacity_kw} kW ({job.sales_orders?.leads?.system_type || 'ON_GRID'})
                </span>
              </div>
            </div>

            {/* Field Crew */}
            <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Assigned Team Lead
              </span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-midnight/5 flex items-center justify-center font-bold text-midnight">
                  {job.users_installation_jobs_team_lead_idTousers?.full_name?.[0] || 'U'}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {job.users_installation_jobs_team_lead_idTousers?.full_name || 'Unassigned'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {job.users_installation_jobs_team_lead_idTousers?.phone_e164 || ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Linked Delivery Dispatch */}
          {job.dispatches && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-midnight" />
                  <span>Dispatched Hardware</span>
                </h2>
                <Badge variant={job.dispatches.status === 'DELIVERED' ? 'success' : 'info'}>
                  {job.dispatches.status}
                </Badge>
              </div>

              <div className="text-xs space-y-1 font-mono">
                <div>Challan: <strong>{job.dispatches.dispatch_number}</strong></div>
                <div>Vehicle: <strong>{job.dispatches.vehicle_number}</strong></div>
                <div>Driver: {job.dispatches.driver_name}</div>
              </div>

              {job.dispatches.dispatch_serials?.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Allocated Serial Numbers ({job.dispatches.dispatch_serials.length}):
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {job.dispatches.dispatch_serials.map((ds) => (
                      <div key={ds.id} className="text-[11px] font-mono bg-slate-50 p-1.5 rounded flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{ds.serial_numbers?.serial_number}</span>
                        <span className="text-slate-500 text-[10px]">{ds.products?.brand}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Commissioning Certificate Badge if already completed */}
          {signoff && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Official Commissioning Certificate</h3>
              </div>
              <div className="text-xs text-emerald-950 space-y-1 font-mono">
                <div>Certificate #: <strong>{signoff.certificate_number}</strong></div>
                <div>Customer: <strong>{signoff.customer_name}</strong></div>
                <div>Rating: {'⭐'.repeat(signoff.customer_rating || 5)}</div>
                {signoff.discom_consumer_number && (
                  <div>DISCOM Consumer #: <strong>{signoff.discom_consumer_number}</strong></div>
                )}
                {signoff.tested_peak_power_kw && (
                  <div>Tested Peak Power: <strong>{signoff.tested_peak_power_kw} kW</strong></div>
                )}
              </div>
              {signoff.customer_feedback && (
                <p className="text-[11px] italic text-emerald-800 pt-2 border-t border-emerald-200/60">
                  "{signoff.customer_feedback}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Middle & Right Column: Interactive Checklist & Photos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: 8-Step Technical Verification Checklist */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-midnight tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-solar-green" />
                  <span>Mandatory Technical Verification Checklist</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All 8 mandatory checks must be verified and measured before commissioning sign-off is permitted.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {job.installation_checklists?.map((step) => {
                const isEditing = updatingStepKey === step.step_key;

                return (
                  <div key={step.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        disabled={job.status === 'COMMISSIONED'}
                        onClick={() => handleToggleChecklistStep(step.step_key, step.is_completed)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          step.is_completed
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                      >
                        {step.is_completed && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>

                      <div>
                        <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                          <span>{step.step_name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                            {step.category}
                          </span>
                        </div>

                        {step.measured_value && (
                          <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                            Measurement: <strong>{step.measured_value}</strong>
                          </div>
                        )}
                        {step.remarks && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            "{step.remarks}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Measurement Edit */}
                    {job.status !== 'COMMISSIONED' && (
                      <div className="flex items-center gap-2 sm:self-center shrink-0 pl-9 sm:pl-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Value (e.g. 1.8 Ohms)"
                              value={stepMeasurement}
                              onChange={(e) => setStepMeasurement(e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded font-mono w-36 outline-none focus:ring-1 focus:ring-midnight"
                            />
                            <button
                              onClick={() => handleToggleChecklistStep(step.step_key, false)}
                              className="px-2 py-1 bg-midnight text-white rounded text-xs font-semibold hover:bg-slate-800"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setUpdatingStepKey(null)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setUpdatingStepKey(step.step_key);
                              setStepMeasurement(step.measured_value || '');
                              setStepRemarks(step.remarks || '');
                            }}
                            className="text-[11px] text-slate-500 hover:text-midnight font-medium underline"
                          >
                            {step.measured_value ? 'Edit Value' : '+ Add Measurement'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Geotagged Photo Evidence */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-midnight tracking-tight flex items-center gap-2">
                  <Camera className="w-4 h-4 text-midnight" />
                  <span>Geotagged Installation Photo Evidence</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Photographic records of PV modules, inverter mounting, and earthing chambers.
                </p>
              </div>

              {job.status !== 'COMMISSIONED' && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={Upload}
                  onClick={() => setShowPhotoModal(true)}
                >
                  Upload Photo
                </Button>
              )}
            </div>

            {job.installation_photos?.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                No photo evidence uploaded yet. Click "Upload Photo" to record rooftop photos.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {job.installation_photos?.map((photo) => (
                  <div key={photo.id} className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 text-xs space-y-1">
                    <img
                      src={photo.file_url}
                      alt={photo.caption || photo.photo_category}
                      className="w-full h-28 object-cover bg-slate-200"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=400&q=80';
                      }}
                    />
                    <div className="p-2 space-y-0.5">
                      <span className="font-mono text-[10px] font-bold text-midnight uppercase block">
                        {photo.photo_category}
                      </span>
                      {photo.caption && (
                        <p className="text-[11px] text-slate-600 line-clamp-1">{photo.caption}</p>
                      )}
                      {photo.gps_lat && (
                        <span className="text-[10px] font-mono text-slate-400 block">
                          📍 {photo.gps_lat}, {photo.gps_lng}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Photo Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        title="Upload Geotagged Installation Photo"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUploadPhoto} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Photo Category *</label>
            <select
              value={photoCategory}
              onChange={(e) => setPhotoCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none"
            >
              <option value="STRUCTURE">Structure Anchoring & Clamps</option>
              <option value="PANELS_ARRAY">Solar PV Module Array</option>
              <option value="INVERTER_MOUNT">Solar Inverter & Wiring</option>
              <option value="DCDB_ACDB">DCDB & ACDB Distribution Boxes</option>
              <option value="EARTHING_CHAMBER">Chemical Earthing Pit & Electrode</option>
              <option value="LIGHTNING_ARRESTER">ESE Lightning Arrester</option>
              <option value="NET_METER">Bi-Directional Net Meter Board</option>
              <option value="SIGN_OFF_EVIDENCE">Customer Sign-off Handover</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Image URL / File Path *</label>
            <input
              type="text"
              required
              placeholder="https://storage.sunpower.com/photos/roof_east.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Photo Caption (Optional)</label>
            <input
              type="text"
              placeholder="e.g. 5kW Growatt inverter with DC SPD and AC isolator"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GPS Latitude</label>
              <input
                type="text"
                placeholder="23.0225"
                value={photoLat}
                onChange={(e) => setPhotoLat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GPS Longitude</label>
              <input
                type="text"
                placeholder="72.5714"
                value={photoLng}
                onChange={(e) => setPhotoLng(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setShowPhotoModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={photoSubmitting}>
              Upload Evidence
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Commissioning Sign-off Modal */}
      <Modal
        isOpen={showSignoffModal}
        onClose={() => setShowSignoffModal(false)}
        title="Customer Commissioning Acceptance & Certificate"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmitSignoff} className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              All Mandatory Checklist Items Verified
            </span>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              Structure, DC Voc, dual earthing, and grid sync measurements passed. Capturing customer digital signature will issue official Commissioning Certificate and advance equipment serials to INSTALLED.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer Full Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer Phone *</label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">DISCOM Consumer Number</label>
              <input
                type="text"
                placeholder="e.g. UGVCL-08291048"
                value={discomConsumerNumber}
                onChange={(e) => setDiscomConsumerNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tested Peak Power Output (kW)</label>
              <input
                type="number"
                step="0.1"
                placeholder="5.0"
                value={testedPeakPowerKw}
                onChange={(e) => setTestedPeakPowerKw(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Customer Satisfaction Rating */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Satisfaction Rating *</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCustomerRating(star)}
                  className={`text-xl transition-transform hover:scale-125 ${
                    star <= customerRating ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="text-xs text-slate-500 font-mono ml-2">({customerRating} / 5 Stars)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Handover Feedback</label>
            <textarea
              rows={2}
              placeholder="e.g. Very pleased with crew behavior, wiring neatness, and mobile monitoring setup."
              value={customerFeedback}
              onChange={(e) => setCustomerFeedback(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Digital Signature Canvas Pad */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">Customer Digital Signature *</label>
              <button
                type="button"
                onClick={clearSignature}
                className="text-[11px] text-slate-400 hover:text-rose-600 underline"
              >
                Clear Pad
              </button>
            </div>
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
              <canvas
                ref={canvasRef}
                width={500}
                height={130}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-32 cursor-crosshair bg-white"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Sign with finger on touchscreen or draw with mouse on desktop.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setShowSignoffModal(false)}>
              Cancel
            </Button>
            <Button variant="accent" type="submit" loading={signoffSubmitting}>
              Issue Certificate & Commission
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default InstallationDetailPage;
