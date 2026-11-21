import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ClipboardCheck, ArrowLeft, User, Phone, MapPin, 
  Calendar, Zap, CheckCircle2, AlertTriangle, FileText, 
  Camera, Image, Plus, Check, RefreshCw, Send, Layers, Box,
  Sparkles, ShieldCheck, Cpu, XCircle, AlertCircle, Info, Lock,
  CheckCircle, ArrowRight, SlidersHorizontal
} from 'lucide-react';
import { api } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';

export function SurveyDetailPage() {
  const { id } = useParams();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Submitting
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [selectedBomId, setSelectedBomId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState({ decision: 'APPROVED', comments: '' });
  const [photoData, setPhotoData] = useState({ photo_category: 'ROOF_PANORAMA', file_url: '', caption: '' });

  // Catalog Products for Overrides
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [bomOverrides, setBomOverrides] = useState({
    panel_product_id: '',
    inverter_product_id: '',
    structure_product_id: '',
    dc_cable_product_id: '',
    ac_cable_product_id: '',
    dc_cable_meters: '',
    ac_cable_meters: ''
  });

  // Specs Form
  const [specs, setSpecs] = useState({
    roof_type: 'RCC_FLAT',
    shadow_free_area_sqft: '',
    proposed_capacity_kw: '',
    sanctioned_load_kw: '',
    supply_phase: 'SINGLE',
    discom_provider: 'UGVCL',
    consumer_number: '',
    distance_roof_to_meter_m: 20,
    earthing_pits_needed: 2,
    structure_type: 'STANDARD_GI',
    notes: ''
  });
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [specsMessage, setSpecsMessage] = useState('');

  const fetchSurvey = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/surveys/${id}`);
      const srv = res?.data || null;
      setSurvey(srv);

      if (srv) {
        setSpecs({
          roof_type: srv.roof_type || 'RCC_FLAT',
          shadow_free_area_sqft: srv.shadow_free_area_sqft || '',
          proposed_capacity_kw: srv.proposed_capacity_kw || '',
          sanctioned_load_kw: srv.sanctioned_load_kw || '',
          supply_phase: srv.supply_phase || 'SINGLE',
          discom_provider: srv.discom_provider || 'UGVCL',
          consumer_number: srv.consumer_number || '',
          distance_roof_to_meter_m: srv.distance_roof_to_meter_m || 20,
          earthing_pits_needed: srv.earthing_pits_needed || 2,
          structure_type: srv.structure_type || 'STANDARD_GI',
          notes: srv.notes || ''
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCatalogProducts = useCallback(async () => {
    try {
      const res = await api.get('/catalog/products', { limit: 100, is_active: true });
      setCatalogProducts(res?.data || []);
    } catch (err) {
      console.error('Failed to load catalog products for customization:', err);
    }
  }, []);

  useEffect(() => {
    fetchSurvey();
    fetchCatalogProducts();
  }, [fetchSurvey, fetchCatalogProducts]);

  const handleSaveSpecs = async (e) => {
    e.preventDefault();
    setSavingSpecs(true);
    setSpecsMessage('');

    try {
      await api.patch(`/surveys/${id}`, {
        roof_type: specs.roof_type,
        shadow_free_area_sqft: Number(specs.shadow_free_area_sqft) || 0,
        proposed_capacity_kw: Number(specs.proposed_capacity_kw) || 0,
        sanctioned_load_kw: Number(specs.sanctioned_load_kw) || 0,
        supply_phase: specs.supply_phase,
        discom_provider: specs.discom_provider,
        consumer_number: specs.consumer_number,
        distance_roof_to_meter_m: Number(specs.distance_roof_to_meter_m) || 0,
        earthing_pits_needed: Number(specs.earthing_pits_needed) || 2,
        structure_type: specs.structure_type,
        notes: specs.notes
      });
      setSpecsMessage('Rooftop specifications saved successfully.');
      fetchSurvey();
    } catch (err) {
      alert(err.message || 'Failed to save rooftop specs');
    } finally {
      setSavingSpecs(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!window.confirm('Submit this survey for engineering manager approval?')) return;
    try {
      await api.post(`/surveys/${id}/submit`);
      fetchSurvey();
    } catch (err) {
      alert(err.message || 'Failed to submit survey');
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/surveys/${id}/review`, reviewData);
      setShowReviewModal(false);
      fetchSurvey();
    } catch (err) {
      alert(err.message || 'Review action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPhotoSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/surveys/${id}/photos`, photoData);
      setShowPhotoModal(false);
      setPhotoData({ photo_category: 'ROOF_PANORAMA', file_url: '', caption: '' });
      fetchSurvey();
    } catch (err) {
      alert(err.message || 'Failed to record photo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateBom = async () => {
    if (!window.confirm('Generate Engineering Bill of Materials (BOM) based on this survey?')) return;
    setSubmitting(true);
    try {
      // Auto-save the latest specs first so generation always uses current form inputs
      await api.patch(`/surveys/${id}`, {
        roof_type: specs.roof_type,
        shadow_free_area_sqft: Number(specs.shadow_free_area_sqft) || 0,
        proposed_capacity_kw: Number(specs.proposed_capacity_kw) || 0,
        sanctioned_load_kw: Number(specs.sanctioned_load_kw) || 0,
        supply_phase: specs.supply_phase,
        discom_provider: specs.discom_provider,
        consumer_number: specs.consumer_number,
        distance_roof_to_meter_m: Number(specs.distance_roof_to_meter_m) || 0,
        earthing_pits_needed: Number(specs.earthing_pits_needed) || 2,
        structure_type: specs.structure_type,
        notes: specs.notes
      });

      const res = await api.post(`/surveys/${id}/bom`, {});
      if (res?.data?.id) {
        setSelectedBomId(res.data.id);
      } else {
        setSelectedBomId(null);
      }
      await fetchSurvey();
    } catch (err) {
      alert(err.message || 'Failed to generate BOM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCustomizeModal = () => {
    if (activeBom?.project_bom_items) {
      const panelItem = activeBom.project_bom_items.find(i => i.products?.product_categories?.code === 'PANEL' || i.products?.sku?.startsWith('PNL'));
      const invItem = activeBom.project_bom_items.find(i => i.products?.product_categories?.code === 'INVERTER' || i.products?.sku?.startsWith('INV'));
      const structItem = activeBom.project_bom_items.find(i => i.products?.product_categories?.code === 'STRUCTURE' || i.products?.sku?.startsWith('STR'));
      const dcItem = activeBom.project_bom_items.find(i => i.products?.sku?.includes('DC') && (i.products?.product_categories?.code === 'CABLE' || i.products?.sku?.startsWith('CBL')));
      const acItem = activeBom.project_bom_items.find(i => i.products?.sku?.includes('AC') && (i.products?.product_categories?.code === 'CABLE' || i.products?.sku?.startsWith('CBL')));

      setBomOverrides({
        panel_product_id: panelItem?.product_id || '',
        inverter_product_id: invItem?.product_id || '',
        structure_product_id: structItem?.product_id || '',
        dc_cable_product_id: dcItem?.product_id || '',
        ac_cable_product_id: acItem?.product_id || '',
        dc_cable_meters: dcItem?.quantity || '',
        ac_cable_meters: acItem?.quantity || ''
      });
    }
    setShowCustomizeModal(true);
  };

  const handleResetOverrides = () => {
    setBomOverrides({
      panel_product_id: '',
      inverter_product_id: '',
      structure_product_id: '',
      dc_cable_product_id: '',
      ac_cable_product_id: '',
      dc_cable_meters: '',
      ac_cable_meters: ''
    });
  };

  const handleApplyCustomBom = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Auto-save latest specs first
      await api.patch(`/surveys/${id}`, {
        roof_type: specs.roof_type,
        shadow_free_area_sqft: Number(specs.shadow_free_area_sqft) || 0,
        proposed_capacity_kw: Number(specs.proposed_capacity_kw) || 0,
        sanctioned_load_kw: Number(specs.sanctioned_load_kw) || 0,
        supply_phase: specs.supply_phase,
        discom_provider: specs.discom_provider,
        consumer_number: specs.consumer_number,
        distance_roof_to_meter_m: Number(specs.distance_roof_to_meter_m) || 0,
        earthing_pits_needed: Number(specs.earthing_pits_needed) || 2,
        structure_type: specs.structure_type,
        notes: specs.notes
      });

      // 2. Build payload with overrides
      const payload = {};
      if (bomOverrides.panel_product_id) payload.panel_product_id = bomOverrides.panel_product_id;
      if (bomOverrides.inverter_product_id) payload.inverter_product_id = bomOverrides.inverter_product_id;
      if (bomOverrides.structure_product_id) payload.structure_product_id = bomOverrides.structure_product_id;
      if (bomOverrides.dc_cable_product_id) payload.dc_cable_product_id = bomOverrides.dc_cable_product_id;
      if (bomOverrides.ac_cable_product_id) payload.ac_cable_product_id = bomOverrides.ac_cable_product_id;
      if (bomOverrides.dc_cable_meters) payload.dc_cable_meters = Number(bomOverrides.dc_cable_meters);
      if (bomOverrides.ac_cable_meters) payload.ac_cable_meters = Number(bomOverrides.ac_cable_meters);

      const res = await api.post(`/surveys/${id}/bom`, payload);
      if (res?.data?.id) {
        setSelectedBomId(res.data.id);
      }
      setShowCustomizeModal(false);
      await fetchSurvey();
      alert('Customized Engineering BOM generated successfully.');
    } catch (err) {
      alert(err.message || 'Failed to generate customized BOM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveBom = async (bomId) => {
    if (!window.confirm('Approve this BOM revision for procurement and installation?')) return;
    setSubmitting(true);
    try {
      await api.post(`/boms/${bomId}/approve`);
      await fetchSurvey();
      alert('BOM approved successfully for installation.');
    } catch (err) {
      alert(err.message || 'Failed to approve BOM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectBom = async (bomId) => {
    const reason = window.prompt('Enter reason for rejecting this BOM:');
    if (!reason) return;
    setSubmitting(true);
    try {
      await api.post(`/boms/${bomId}/reject`, { reason });
      await fetchSurvey();
    } catch (err) {
      alert(err.message || 'Failed to reject BOM');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading feasibility survey...</div>;
  }

  if (error || !survey) {
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl">
        {error || 'Site survey record not found.'}
      </div>
    );
  }

  const activeBom = (selectedBomId && survey.project_boms?.find(b => b.id === selectedBomId))
    || survey.project_boms?.[0]
    || null;

  const panelOptions = catalogProducts.filter(p => p.product_categories?.code === 'PANEL' || p.sku?.startsWith('PNL'));
  const inverterOptions = catalogProducts.filter(p => p.product_categories?.code === 'INVERTER' || p.sku?.startsWith('INV'));
  const structureOptions = catalogProducts.filter(p => p.product_categories?.code === 'STRUCTURE' || p.sku?.startsWith('STR'));
  const dcCableOptions = catalogProducts.filter(p => (p.product_categories?.code === 'CABLE' || p.sku?.startsWith('CBL')) && (p.sku?.includes('DC') || p.product_specifications?.is_uv_resistant));
  const acCableOptions = catalogProducts.filter(p => (p.product_categories?.code === 'CABLE' || p.sku?.startsWith('CBL')) && (p.sku?.includes('AC') || p.product_specifications?.is_armored));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/surveys">
            <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-500">{survey.survey_number}</span>
              <Badge variant={survey.status === 'APPROVED' ? 'success' : survey.status === 'REVISION_REQUIRED' ? 'danger' : 'warning'}>
                {survey.status}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-midnight">
              Rooftop Feasibility Assessment
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {(survey.status === 'SCHEDULED' || survey.status === 'IN_PROGRESS' || survey.status === 'REVISION_REQUIRED') && (
            <Button variant="primary" size="sm" icon={Send} onClick={handleSubmitForReview}>
              Submit for Approval
            </Button>
          )}

          {survey.status === 'SUBMITTED' && (
            <Button variant="green" size="sm" icon={Check} onClick={() => setShowReviewModal(true)}>
              Review Survey
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            icon={SlidersHorizontal}
            onClick={handleOpenCustomizeModal}
          >
            Customize BOM
          </Button>

          <Button 
            variant="accent" 
            size="sm" 
            icon={Layers} 
            loading={submitting} 
            onClick={handleGenerateBom}
          >
            {activeBom ? 'Re-generate BOM' : 'Generate Engineering BOM'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Linked Entity, Photos & Schedule */}
        <div className="space-y-6">
          {/* Prospect Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Linked Entity Details
            </h3>

            {survey.leads && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{survey.leads.full_name}</span>
                  <Link to={`/leads/${survey.leads.id}`} className="text-xs text-solar-gold hover:underline font-mono">
                    {survey.leads.lead_number}
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {survey.leads.phone_e164}
                </div>
                <div className="text-xs text-slate-500 flex items-start gap-1.5 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span>{survey.leads.site_address || 'No street address specified'} ({survey.leads.city || 'Gujarat'})</span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Field Engineer:</span>
                <span className="font-semibold text-slate-800">{survey.engineer?.full_name || 'Unassigned'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Scheduled:</span>
                <span className="font-mono text-slate-800">
                  {new Date(survey.scheduled_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Rooftop Photos Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-solar-gold" /> Rooftop Photos ({survey.survey_photos?.length || 0})
              </h3>
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setShowPhotoModal(true)}>
                Add Photo
              </Button>
            </div>

            {(!survey.survey_photos || survey.survey_photos.length === 0) ? (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No site photos uploaded yet. Upload rooftop panorama and electric meter board.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {survey.survey_photos.map((ph) => (
                  <div key={ph.id} className="border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 space-y-1">
                    <div className="font-semibold text-[11px] text-slate-700 truncate">
                      {ph.photo_category.replace(/_/g, ' ')}
                    </div>
                    <a href={ph.file_url} target="_blank" rel="noreferrer" className="block text-[11px] text-midnight underline truncate">
                      View Photo Link
                    </a>
                    {ph.caption && <p className="text-[10px] text-slate-400 truncate">{ph.caption}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Rooftop Specs Form & Generated BOM */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rooftop Feasibility Specs Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-midnight flex items-center gap-2">
                <Zap className="w-4 h-4 text-solar-gold" /> Rooftop Technical Specifications
              </h3>
              {specsMessage && (
                <span className="text-xs text-solar-green font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {specsMessage}
                </span>
              )}
            </div>

            <form onSubmit={handleSaveSpecs} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Roof Type *</label>
                  <select
                    value={specs.roof_type}
                    onChange={(e) => setSpecs({ ...specs, roof_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="RCC_FLAT">RCC Flat Slab</option>
                    <option value="METAL_SHEET">Industrial Metal / Tin Sheet</option>
                    <option value="TILED_ROOF">Slanted Tiled Roof</option>
                    <option value="GROUND_MOUNT">Ground Mount</option>
                    <option value="OTHER">Other / Mixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Shadow-free Area (sq ft) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 400"
                    value={specs.shadow_free_area_sqft}
                    onChange={(e) => setSpecs({ ...specs, shadow_free_area_sqft: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Proposed Capacity (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 5.4"
                    value={specs.proposed_capacity_kw}
                    onChange={(e) => setSpecs({ ...specs, proposed_capacity_kw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-midnight"
                  />
                </div>
              </div>

              {/* Live Feasibility & Area Calculator */}
              {specs.proposed_capacity_kw > 0 && (() => {
                const estModules = Math.ceil((Number(specs.proposed_capacity_kw) * 1000) / 540);
                const estNetSqft = estModules * 27.81;
                const estRequiredSqft = Math.max(Math.ceil(estNetSqft * 1.65), Math.ceil(Number(specs.proposed_capacity_kw) * 75));
                const availSqft = Number(specs.shadow_free_area_sqft) || 0;
                const isDeficit = availSqft > 0 && availSqft < estRequiredSqft;
                const deficitSqft = isDeficit ? estRequiredSqft - availSqft : 0;
                const maxFeasible = estRequiredSqft > 0 && availSqft > 0
                  ? Number((availSqft / (estRequiredSqft / Number(specs.proposed_capacity_kw))).toFixed(1))
                  : 0;

                return (
                  <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    isDeficit
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      isDeficit ? 'text-rose-600' : 'text-emerald-600'
                    }`} />
                    <div className="flex-1">
                      <div className="font-bold flex items-center gap-2">
                        <span>
                          {isDeficit
                            ? `⚠️ Space Deficit: ~${deficitSqft} sq ft short for standard array`
                            : `✓ Rooftop Space Confirmed: Area is sufficient for ${specs.proposed_capacity_kw} kWp`}
                        </span>
                        <span className="font-mono text-[11px] opacity-75 font-normal">
                          (Needs ~{estRequiredSqft} sq ft for {estModules}x 540W modules @ 1.65x pitch)
                        </span>
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                        {isDeficit ? (
                          <span>
                            Available shadow-free area ({availSqft} sq ft) cannot fit this array without shade.
                            Maximum feasible capacity is ~<strong>{maxFeasible} kWp</strong>. 
                            <strong> Deficit will flag [AREA_INSUFFICIENT] and block installation-ready approval</strong> until proposed capacity is reduced or area is expanded.
                          </span>
                        ) : (
                          <span>
                            Current {availSqft} sq ft comfortably accommodates {estModules} modules (~{(estModules * 0.54).toFixed(2)} kWp) with 1.65x inter-row shadow clearance.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sanctioned Load (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 6.0"
                    value={specs.sanctioned_load_kw}
                    onChange={(e) => setSpecs({ ...specs, sanctioned_load_kw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Supply Phase *</label>
                  <select
                    value={specs.supply_phase}
                    onChange={(e) => setSpecs({ ...specs, supply_phase: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="SINGLE">Single Phase (230V)</option>
                    <option value="THREE">Three Phase (415V)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">DISCOM Utility *</label>
                  <select
                    value={specs.discom_provider}
                    onChange={(e) => setSpecs({ ...specs, discom_provider: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="TORRENT_POWER">Torrent Power</option>
                    <option value="OTHER">Other Discom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Consumer / Meter Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 10293847561"
                    value={specs.consumer_number}
                    onChange={(e) => setSpecs({ ...specs, consumer_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Roof-to-Meter Cable Run (m)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25"
                    value={specs.distance_roof_to_meter_m}
                    onChange={(e) => setSpecs({ ...specs, distance_roof_to_meter_m: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mounting Structure *</label>
                  <select
                    value={specs.structure_type}
                    onChange={(e) => setSpecs({ ...specs, structure_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="STANDARD_GI">Standard HDG GI Structure</option>
                    <option value="ELEVATED_SUPER_STRUCTURE">Elevated Super Structure (Above 8 ft)</option>
                    <option value="BALLASTED">Non-penetrating Ballasted</option>
                    <option value="FLUSH_MOUNT">Tin Shed Flush Clamps</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" type="submit" loading={savingSpecs}>
                  Save Technical Specs
                </Button>
              </div>
            </form>
          </div>

          {/* Generated Bill of Materials (BOM) Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-solar-green" />
                <div>
                  <h3 className="text-sm font-bold text-midnight">Engineering Bill of Materials (BOM)</h3>
                  {activeBom && (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-xs text-slate-500 font-semibold">
                        {activeBom.bom_number} (v{activeBom.version})
                      </span>
                      <Badge variant={activeBom.status === 'APPROVED' ? 'success' : activeBom.status === 'SUPERSEDED' ? 'neutral' : activeBom.status === 'REJECTED' ? 'danger' : 'warning'}>
                        {activeBom.status}
                      </Badge>
                      {activeBom.generation_mode === 'INSTALLATION_READY' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> INSTALLATION READY
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> PRELIMINARY
                        </span>
                      )}
                      {survey.project_boms?.length > 1 && (
                        <select
                          value={activeBom.id}
                          onChange={(e) => setSelectedBomId(e.target.value)}
                          className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 font-mono bg-white text-slate-700 ml-1"
                        >
                          {survey.project_boms.map((b) => (
                            <option key={b.id} value={b.id}>
                              v{b.version} ({b.system_capacity_kw} kW - ₹{Number(b.total_cost).toLocaleString('en-IN')})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {activeBom && (
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={SlidersHorizontal}
                    onClick={handleOpenCustomizeModal}
                    className="hidden sm:inline-flex"
                  >
                    Customize Components
                  </Button>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Hardware Cost</span>
                    <span className="font-mono text-lg font-bold text-midnight">
                      ₹{Number(activeBom.total_cost).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {activeBom.status !== 'APPROVED' && (
                    <div className="flex items-center gap-1.5">
                      {activeBom.is_approval_blocked ? (
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 cursor-not-allowed inline-flex items-center gap-1"
                          title="Approval blocked: resolve engineering safety violations."
                        >
                          <Lock className="w-3.5 h-3.5" /> Approval Blocked
                        </button>
                      ) : (
                        <Button
                          variant="green"
                          size="sm"
                          icon={Check}
                          loading={submitting}
                          onClick={() => handleApproveBom(activeBom.id)}
                        >
                          Approve BOM
                        </Button>
                      )}
                      {activeBom.status !== 'REJECTED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={XCircle}
                          loading={submitting}
                          onClick={() => handleRejectBom(activeBom.id)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Out-of-sync alert if survey capacity changed since BOM was created */}
            {activeBom && Number(activeBom.system_capacity_kw) !== Number(survey.proposed_capacity_kw) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 flex items-center justify-between">
                <span>
                  ⚠️ <strong>Survey specs updated to {survey.proposed_capacity_kw} kWp.</strong> This BOM was generated for {activeBom.system_capacity_kw} kWp.
                </span>
                <button
                  type="button"
                  onClick={handleGenerateBom}
                  className="font-bold underline text-amber-900 hover:text-amber-700 ml-2 whitespace-nowrap"
                >
                  Click "Re-generate BOM" to recalculate
                </button>
              </div>
            )}

            {!activeBom ? (
              <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                <Box className="w-10 h-10 mx-auto opacity-30 text-midnight" />
                <p>No engineering BOM generated for this survey yet.</p>
                <p className="text-[11px] text-slate-400">Click "Generate Engineering BOM" above to automatically calculate panel counts, inverter, structures, and cables.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Engineering Snapshot Cards */}
                {activeBom && (() => {
                  const snap = activeBom.engineering_snapshot || {};
                  const elec = snap.electrical || {};
                  const mech = snap.mechanical || {};
                  const prot = snap.protection || {};
                  const cap = snap.capacity || {};
                  const str = snap.stringing || {};
                  const area = snap.area || {};
                  const cab = snap.cables || {};

                  const totalKw = Number(activeBom.system_capacity_kw || 0);
                  const totalModules = elec.total_modules || cap.panelCount || Math.ceil((totalKw * 1000) / 540);
                  const stringsCount = elec.strings_count || str.stringCount || (totalModules >= 10 ? 2 : 1);
                  const modsPerString = elec.modules_per_string || str.modulesPerString || Math.floor(totalModules / stringsCount);
                  const vocCold = elec.voc_max_v || str.stringVocMax || Number((52.28 * modsPerString).toFixed(1));
                  const vmpHot = elec.vmp_min_v || str.stringVmpMin || Number((35.22 * modsPerString).toFixed(1));
                  const dcAcRatio = elec.dc_ac_ratio || (totalKw > 0 ? (totalKw / (totalKw <= 3.6 ? 3 : totalKw <= 6 ? 5 : 10)).toFixed(2) : '1.08');
                  const dropDc = elec.voltage_drop_dc_pct ?? cab.dc?.voltageDropPct ?? '1.20';
                  const dropAc = elec.voltage_drop_ac_pct ?? cab.ac?.voltageDropPct ?? '0.95';

                  const grossArea = mech.gross_module_area_sqft || area.grossModuleAreaSqft || Number((totalModules * 27.81).toFixed(1));
                  const requiredFootprint = mech.required_footprint_sqft || area.requiredFootprintSqft || area.requiredSqft || Math.ceil(grossArea * 1.65);
                  const deficit = mech.area_deficit_sqft ?? area.deficitSqft ?? 0;
                  const breakerA = prot.ac_breaker_rating_a || prot.acdb?.breakerRatingA || (totalKw <= 3.6 ? 25 : totalKw <= 6 ? 32 : 63);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Electrical Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                          <Cpu className="w-3.5 h-3.5 text-solar-gold" />
                          <span>Electrical Architecture & Sizing</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Modules:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {totalModules}x 540W (~{totalKw} kWp)
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">String Config:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {stringsCount} string(s) × {modsPerString} mods
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Cold Voc (@5°C):</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {vocCold} V
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Hot Vmp (@70°C):</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {vmpHot} V
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">DC/AC Ratio:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {dcAcRatio}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Voltage Drops:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              DC: {dropDc}% | AC: {dropAc}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mechanical & Safety Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-solar-green" />
                          <span>Mechanical Footprint & Protection</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block">Gross Module Area:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {grossArea} sq ft
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Footprint (1.65x pitch):</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {requiredFootprint} sq ft
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Space Margin:</span>
                            <span className={`font-semibold font-mono ${
                              deficit > 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}>
                              {deficit > 0 ? `Deficit: -${deficit} sq ft` : 'Clearance Confirmed'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">AC Breaker:</span>
                            <span className="font-semibold text-slate-900 font-mono">
                              {breakerA} A ({survey.supply_phase === 'THREE' ? '4-Pole' : '2-Pole'})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Engineering Validations Panel */}
                {activeBom.bom_validations && activeBom.bom_validations.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4 text-slate-600" />
                        <span>Engineering Rules & Safety Audit</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {activeBom.bom_validations.filter(v => v.severity === 'BLOCKER').length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold font-mono">
                            {activeBom.bom_validations.filter(v => v.severity === 'BLOCKER').length} Blocker(s)
                          </span>
                        )}
                        {activeBom.bom_validations.filter(v => v.severity === 'WARNING').length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold font-mono">
                            {activeBom.bom_validations.filter(v => v.severity === 'WARNING').length} Warning(s)
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold font-mono">
                          {activeBom.bom_validations.filter(v => v.severity === 'INFO').length} Passed
                        </span>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 bg-white max-h-72 overflow-y-auto">
                      {activeBom.bom_validations.map((v) => (
                        <div
                          key={v.id || v.code}
                          className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                            v.severity === 'BLOCKER'
                              ? 'bg-rose-50 border-rose-200 text-rose-950'
                              : v.severity === 'WARNING'
                              ? 'bg-amber-50 border-amber-200 text-amber-950'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          }`}
                        >
                          {v.severity === 'BLOCKER' ? (
                            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                          ) : v.severity === 'WARNING' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[12px]">{v.description}</span>
                              <div className="flex items-center gap-1 font-mono text-[10px]">
                                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                                  {v.code}
                                </span>
                                <span className="bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                  {v.component}
                                </span>
                              </div>
                            </div>

                            {(v.expected_value || v.actual_value) && (
                              <div className="text-[11px] flex items-center gap-3 font-mono opacity-80 pt-0.5">
                                {v.expected_value && <span>Expected: {v.expected_value}</span>}
                                {v.actual_value && <span>Actual: {v.actual_value}</span>}
                              </div>
                            )}

                            {v.technical_explanation && (
                              <p className="text-[11px] opacity-90 leading-relaxed italic">
                                {v.technical_explanation}
                              </p>
                            )}

                            {v.recommended_action && (
                              <div className="text-[11px] font-semibold flex items-center gap-1 text-slate-800 pt-0.5">
                                <ArrowRight className="w-3 h-3 text-slate-600" />
                                <span>Action: {v.recommended_action}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Component / SKU</th>
                        <th className="py-2.5 px-3">Description & Notes</th>
                        <th className="py-2.5 px-3 font-mono text-right">Quantity</th>
                        <th className="py-2.5 px-3 font-mono text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 font-mono text-right">Total (₹)</th>
                        <th className="py-2.5 px-3 text-center">Customize</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeBom.project_bom_items?.map((it) => {
                        const isPanel = it.products?.sku?.startsWith('PNL');
                        const isInverter = it.products?.sku?.startsWith('INV');
                        const isStructure = it.products?.sku?.startsWith('STR');
                        const isCable = it.products?.sku?.startsWith('CBL');
                        const isCustomizable = isPanel || isInverter || isStructure || isCable;

                        return (
                          <tr key={it.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-midnight">
                              {it.products?.sku}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800">{it.products?.model_name}</span>
                              {it.notes && <span className="block text-[11px] text-slate-500">{it.notes}</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 text-right">
                              {Number(it.quantity)} {it.products?.unit_code}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600 text-right">
                              ₹{Number(it.unit_cost).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-midnight text-right">
                              ₹{Number(it.total_cost).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isCustomizable ? (
                                <button
                                  type="button"
                                  onClick={handleOpenCustomizeModal}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                                  title="Change product brand or configure specifications"
                                >
                                  <SlidersHorizontal className="w-3 h-3 text-amber-600" />
                                  <span>Switch Brand</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">Auto BOS</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="Review & Approve Site Survey"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Review Decision *</label>
            <select
              value={reviewData.decision}
              onChange={(e) => setReviewData({ ...reviewData, decision: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="APPROVED">Approve Survey (Mark Ready for Quotation)</option>
              <option value="REVISION_REQUIRED">Request Revision from Engineer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {reviewData.decision === 'REVISION_REQUIRED' ? 'Revision Instructions *' : 'Review Comments (Optional)'}
            </label>
            <textarea
              rows={3}
              required={reviewData.decision === 'REVISION_REQUIRED'}
              placeholder="e.g. Structure design approved. Ready to issue 5kW quote."
              value={reviewData.comments}
              onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Submit Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Photo Modal */}
      <Modal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        title="Add Rooftop Survey Photo"
      >
        <form onSubmit={handleAddPhotoSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Photo Category *</label>
            <select
              value={photoData.photo_category}
              onChange={(e) => setPhotoData({ ...photoData, photo_category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="ROOF_PANORAMA">Roof Panorama / Angle</option>
              <option value="SHADOW_OBSTRUCTION">Shadow Obstruction / Parapet</option>
              <option value="METER_BOX">Electricity Meter Board</option>
              <option value="DISTRIBUTION_PANEL">Main Distribution Panel</option>
              <option value="EARTHING_SITE">Proposed Earthing Pit Site</option>
              <option value="CABLE_PATH">Cable Route / Shaft</option>
              <option value="GENERAL">General Site Photo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Photo Image URL *</label>
            <input
              type="url"
              required
              placeholder="https://images.sunpower.com/surveys/roof-01.jpg"
              value={photoData.file_url}
              onChange={(e) => setPhotoData({ ...photoData, file_url: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Caption / Observation</label>
            <input
              type="text"
              placeholder="e.g. South-West clear terrace area"
              value={photoData.caption}
              onChange={(e) => setPhotoData({ ...photoData, caption: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowPhotoModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Attach Photo
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customize BOM / Brand Overrides Modal */}
      <Modal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        title="Customize Engineering BOM & Component Brands"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleApplyCustomBom} className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-solar-gold mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-900">Engineering Compatibility Assurance</p>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                Select your preferred manufacturer brands or custom cable lengths. The engineering engine will automatically test electrical voltage boundaries (cold Voc / MPPT), physical roof substrate fit, and voltage drops before updating the BOM.
              </p>
            </div>
          </div>

          {/* Section 1: PV Modules */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>1. Solar PV Module Brand</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">540W - 545W Mono PERC Half-Cut</span>
            </label>
            <select
              value={bomOverrides.panel_product_id}
              onChange={(e) => setBomOverrides({ ...bomOverrides, panel_product_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-solar-gold"
            >
              <option value="">Auto-Select Best Cost (System Default)</option>
              {panelOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.model_name} (₹{Number(p.standard_cost).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Inverter */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>2. Solar Inverter Brand</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">{specs.supply_phase} Phase (Grid Compatible)</span>
            </label>
            <select
              value={bomOverrides.inverter_product_id}
              onChange={(e) => setBomOverrides({ ...bomOverrides, inverter_product_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-solar-gold"
            >
              <option value="">Auto-Select Best Fit (System Default)</option>
              {inverterOptions
                .filter(inv => {
                  const phase = inv.product_specifications?.phase || (inv.sku.includes('3P') ? 'THREE' : 'SINGLE');
                  return phase === specs.supply_phase;
                })
                .map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.brand} — {inv.model_name} ({inv.product_specifications?.phase || '1P'} - ₹{Number(inv.standard_cost).toLocaleString('en-IN')})
                  </option>
                ))}
            </select>
          </div>

          {/* Section 3: Mounting Structure */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>3. Module Mounting Structure</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">Roof: {specs.roof_type}</span>
            </label>
            <select
              value={bomOverrides.structure_product_id}
              onChange={(e) => setBomOverrides({ ...bomOverrides, structure_product_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-solar-gold"
            >
              <option value="">Auto-Select for Substrate (System Default)</option>
              {structureOptions.map(st => (
                <option key={st.id} value={st.id}>
                  {st.brand} — {st.model_name} (₹{Number(st.standard_cost).toLocaleString('en-IN')}/kW)
                </option>
              ))}
            </select>
          </div>

          {/* Section 4: Cables & Wiring Overrides */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              4. Cable Specifications & Run Lengths
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* DC Solar Cable */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">DC Solar String Cable</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Conductor Gauge / SKU</label>
                  <select
                    value={bomOverrides.dc_cable_product_id}
                    onChange={(e) => setBomOverrides({ ...bomOverrides, dc_cable_product_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">Auto Gauge (Based on V-Drop)</option>
                    {dcCableOptions.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.sku} (₹{c.standard_cost}/m)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Total Cable Length (Meters)</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="Auto-calculated from run"
                    value={bomOverrides.dc_cable_meters}
                    onChange={(e) => setBomOverrides({ ...bomOverrides, dc_cable_meters: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
              </div>

              {/* AC Armored Cable */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">AC Grid Interconnection Cable</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Conductor Gauge / SKU</label>
                  <select
                    value={bomOverrides.ac_cable_product_id}
                    onChange={(e) => setBomOverrides({ ...bomOverrides, ac_cable_product_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">Auto Gauge (Based on V-Drop)</option>
                    {acCableOptions.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.sku} (₹{c.standard_cost}/m)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Total Cable Length (Meters)</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="Auto-calculated from run"
                    value={bomOverrides.ac_cable_meters}
                    onChange={(e) => setBomOverrides({ ...bomOverrides, ac_cable_meters: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetOverrides}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
            >
              Reset to Auto-Optimized
            </button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowCustomizeModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={submitting} icon={Check}>
                Generate Custom BOM
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
export default SurveyDetailPage;
