import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ClipboardCheck, ArrowLeft, User, Phone, MapPin, 
  Calendar, Zap, CheckCircle2, AlertTriangle, FileText, 
  Camera, Image, Plus, Check, RefreshCw, Send, Layers, Box,
  Sparkles, ShieldCheck, Cpu, XCircle, AlertCircle, Info, Lock,
  CheckCircle, ArrowRight, SlidersHorizontal, ChevronDown, ChevronUp
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

  // Primary Goal Navigation Tab: 'survey' | 'bom'
  const [activeTab, setActiveTab] = useState('survey');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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

  const handleSaveSpecs = async (e, proceedToBom = false) => {
    if (e) e.preventDefault();
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
      await fetchSurvey();
      if (proceedToBom) {
        setActiveTab('bom');
      }
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
      setActiveTab('bom'); // Automatically switch to BOM view
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
      setActiveTab('bom');
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
    return <div className="p-12 text-center text-slate-500 text-sm">Loading site survey...</div>;
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
    <div className="space-y-5">
      {/* 1. Header & Survey Context Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/surveys">
              <Button variant="outline" size="sm" icon={ArrowLeft}>Back to Surveys</Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-700">{survey.survey_number}</span>
                <Badge variant={survey.status === 'APPROVED' ? 'success' : survey.status === 'REVISION_REQUIRED' ? 'danger' : 'warning'}>
                  {survey.status}
                </Badge>
                {activeBom && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1 font-mono">
                    <Layers className="w-3 h-3 text-emerald-600" /> BOM: ₹{Number(activeBom.total_cost).toLocaleString('en-IN')} ({activeBom.system_capacity_kw} kW)
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-midnight mt-0.5">
                Site Survey & Engineering Feasibility
              </h1>
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
              Customize Brands
            </Button>

            <Button 
              variant="accent" 
              size="sm" 
              icon={Layers} 
              loading={submitting} 
              onClick={handleGenerateBom}
            >
              {activeBom ? 'Re-calculate BOM' : 'Generate Engineering BOM'}
            </Button>
          </div>
        </div>

        {/* Compact Prospect & Engineer Summary Strip */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Prospect</span>
              <span className="font-semibold text-slate-900">
                {survey.leads?.full_name || survey.customers?.full_name || 'Prospect'}
              </span>
              {survey.leads && (
                <Link to={`/leads/${survey.leads.id}`} className="text-solar-gold hover:underline font-mono ml-1.5 text-[11px]">
                  ({survey.leads.lead_number})
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phone</span>
              <span className="font-mono text-slate-800">{survey.leads?.phone_e164 || survey.customers?.phone_e164 || '—'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Site Address</span>
              <span className="text-slate-800 truncate block">
                {survey.leads?.site_address || 'Gujarat, India'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Field Engineer & Date</span>
              <span className="text-slate-800 font-medium">
                {survey.engineer?.full_name || 'Unassigned'} • {new Date(survey.scheduled_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Core Primary Tabs (The 2 Core Goals) */}
      <div className="flex items-center border-b border-slate-200 bg-white rounded-t-xl px-4 pt-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('survey')}
          className={`flex items-center gap-2 py-3.5 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'survey'
              ? 'border-solar-gold text-midnight bg-amber-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <ClipboardCheck className={`w-4 h-4 ${activeTab === 'survey' ? 'text-solar-gold' : 'text-slate-400'}`} />
          <span>1. Site Survey & Rooftop Specs</span>
          {survey.proposed_capacity_kw && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700 ml-1">
              {survey.proposed_capacity_kw} kW
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 py-3.5 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'bom'
              ? 'border-solar-gold text-midnight bg-amber-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeTab === 'bom' ? 'text-solar-green' : 'text-slate-400'}`} />
          <span>2. Engineering BOM & Sizing</span>
          {activeBom ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 ml-1">
              ₹{Number(activeBom.total_cost).toLocaleString('en-IN')}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold bg-slate-100 text-slate-500 ml-1">
              Pending Sizing
            </span>
          )}
        </button>
      </div>

      {/* 3. TAB 1: Site Survey & Rooftop Specs */}
      {activeTab === 'survey' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Specifications Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-midnight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-solar-gold" /> Rooftop Technical Measurements
                </h3>
                {specsMessage && (
                  <span className="text-xs text-solar-green font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {specsMessage}
                  </span>
                )}
              </div>

              <form onSubmit={(e) => handleSaveSpecs(e, false)} className="space-y-4">
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

                {/* Live Feasibility & Area Calculator Banner */}
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
                              ? `Space Deficit: ~${deficitSqft} sq ft short for standard array`
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
                              Max capacity: ~<strong>{maxFeasible} kWp</strong>.
                            </span>
                          ) : (
                            <span>
                              Current {availSqft} sq ft comfortably accommodates {estModules} modules (~{(estModules * 0.54).toFixed(2)} kWp) with 1.65x inter-row clearance.
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
                      <option value="ELEVATED_SUPER_STRUCTURE">Elevated Super Structure (&gt; 8 ft)</option>
                      <option value="BALLASTED">Non-penetrating Ballasted</option>
                      <option value="FLUSH_MOUNT">Tin Shed Flush Clamps</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Survey Field Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. RCC terrace in good condition, south-facing, no high parapet shade."
                    value={specs.notes}
                    onChange={(e) => setSpecs({ ...specs, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    Always save measurements before sizing hardware.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" type="submit" loading={savingSpecs}>
                      Save Specs
                    </Button>
                    <Button
                      variant="accent"
                      type="button"
                      icon={ArrowRight}
                      loading={savingSpecs}
                      onClick={() => handleSaveSpecs(null, true)}
                    >
                      Save & Proceed to BOM
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right 1 Column: Rooftop Photos & Feasibility Checklist */}
          <div className="space-y-6">
            {/* Rooftop Photos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-solar-gold" /> Rooftop Photos ({survey.survey_photos?.length || 0})
                </h3>
                <Button variant="outline" size="sm" icon={Plus} onClick={() => setShowPhotoModal(true)}>
                  Upload Photo
                </Button>
              </div>

              {(!survey.survey_photos || survey.survey_photos.length === 0) ? (
                <div className="py-6 text-center text-slate-400 text-xs space-y-1">
                  <Image className="w-8 h-8 mx-auto opacity-40 text-midnight" />
                  <p>No rooftop photos uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {survey.survey_photos.map((p) => (
                    <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
                      <img src={p.file_url} alt={p.caption || 'Roof photo'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-midnight/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white text-[10px]">
                        <span className="font-semibold truncate">{p.photo_category?.replace(/_/g, ' ')}</span>
                        {p.caption && <span className="opacity-80 truncate">{p.caption}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Readiness Callout */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-solar-green" /> Feasibility Checklist
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${specs.proposed_capacity_kw ? 'text-solar-green' : 'text-slate-300'}`} />
                  <span className={specs.proposed_capacity_kw ? 'text-slate-800' : 'text-slate-400'}>Capacity requirement set</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${specs.shadow_free_area_sqft ? 'text-solar-green' : 'text-slate-300'}`} />
                  <span className={specs.shadow_free_area_sqft ? 'text-slate-800' : 'text-slate-400'}>Shadow-free roof area measured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${specs.sanctioned_load_kw ? 'text-solar-green' : 'text-slate-300'}`} />
                  <span className={specs.sanctioned_load_kw ? 'text-slate-800' : 'text-slate-400'}>DISCOM load & meter recorded</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${survey.status === 'APPROVED' ? 'text-solar-green' : 'text-slate-300'}`} />
                  <span className={survey.status === 'APPROVED' ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                    Engineering approval: {survey.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: Engineering Bill of Materials (BOM) */}
      {activeTab === 'bom' && (
        <div className="space-y-5">
          {!activeBom ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm text-center max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-solar-gold/10 text-solar-gold flex items-center justify-center mx-auto">
                <Layers className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-midnight">No Engineering BOM Generated Yet</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Generate an automated, installation-ready Bill of Materials with Tier-A PV modules, string inverters, HDG structures, and AC/DC protection gear based on your rooftop survey specifications.
                </p>
              </div>
              <div className="pt-2">
                <Button 
                  variant="accent" 
                  size="lg" 
                  icon={Layers} 
                  loading={submitting} 
                  onClick={handleGenerateBom}
                >
                  Generate Engineering BOM Now
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Top BOM KPI Summary Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-solar-green/10 text-solar-green flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">
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
                    </div>
                    <div className="text-lg font-bold text-midnight mt-0.5">
                      {activeBom.system_capacity_kw} kW System • <span className="font-mono text-solar-green">₹{Number(activeBom.total_cost).toLocaleString('en-IN')}</span> Total Hardware Cost
                    </div>
                  </div>
                </div>

                {/* BOM Actions & Version Selection */}
                <div className="flex items-center gap-2 flex-wrap">
                  {survey.project_boms?.length > 1 && (
                    <select
                      value={activeBom.id}
                      onChange={(e) => setSelectedBomId(e.target.value)}
                      className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                    >
                      {survey.project_boms.map((b) => (
                        <option key={b.id} value={b.id}>
                          v{b.version} — ₹{Number(b.total_cost).toLocaleString('en-IN')} ({b.status})
                        </option>
                      ))}
                    </select>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    icon={SlidersHorizontal}
                    onClick={handleOpenCustomizeModal}
                  >
                    Customize Brands
                  </Button>

                  <Button
                    variant="accent"
                    size="sm"
                    icon={RefreshCw}
                    loading={submitting}
                    onClick={handleGenerateBom}
                  >
                    Re-calculate
                  </Button>

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
              </div>

              {/* Out-of-sync alert if survey capacity changed since BOM was created */}
              {Number(activeBom.system_capacity_kw) !== Number(survey.proposed_capacity_kw) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center justify-between">
                  <span>
                    ⚠️ <strong>Survey specs updated to {survey.proposed_capacity_kw} kWp.</strong> This BOM was generated for {activeBom.system_capacity_kw} kWp.
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateBom}
                    className="font-bold underline text-amber-900 hover:text-amber-700 ml-2 whitespace-nowrap cursor-pointer"
                  >
                    Click to Recalculate
                  </button>
                </div>
              )}

              {/* BOM Line Items Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-midnight flex items-center gap-2">
                    <Box className="w-4 h-4 text-solar-gold" /> Bill of Materials Hardware Items ({activeBom.project_bom_items?.length || 0})
                  </h3>
                  <span className="font-mono text-xs text-slate-500 font-semibold">
                    Grand Total: ₹{Number(activeBom.total_cost).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Component & Product</th>
                        <th className="py-3 px-4">SKU / Code</th>
                        <th className="py-3 px-4 text-center">Quantity</th>
                        <th className="py-3 px-4 text-right">Unit Rate (₹)</th>
                        <th className="py-3 px-4 text-right">GST %</th>
                        <th className="py-3 px-4 text-right">Total Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeBom.project_bom_items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 text-sm">
                              {item.products?.brand} {item.products?.model_name || item.products?.sku}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {item.products?.product_categories?.name || 'Solar Hardware'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {item.products?.sku || '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                            {Number(item.quantity)} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            ₹{Number(item.unit_cost).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            {item.tax_rate_pct ? `${item.tax_rate_pct}%` : '12%'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                            ₹{Number(item.total_cost).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={5} className="py-3.5 px-4 text-right font-bold text-midnight text-sm">
                          Estimated Total Hardware Cost (Inc. Taxes):
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-solar-green text-base">
                          ₹{Number(activeBom.total_cost).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Collapsible Technical Sizing & Safety Diagnostics Drawer */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-solar-gold" />
                    <span className="text-sm font-bold text-midnight">
                      Engineering Calculations & Safety Diagnostics
                    </span>
                    <span className="text-xs text-slate-400 font-normal">
                      (Cold Voc, String Sizing, Voltage Drop & Validations)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                    <span>{showDiagnostics ? 'Hide Details' : 'View Diagnostics'}</span>
                    {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {showDiagnostics && (() => {
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
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Electrical Card */}
                        <div className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs space-y-2.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
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
                              <span className="text-slate-500 block">DC/AC Sizing Ratio:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                {dcAcRatio}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Voltage Drops:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                DC {dropDc}% • AC {dropAc}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mechanical Card */}
                        <div className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs space-y-2.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                            <ShieldCheck className="w-3.5 h-3.5 text-solar-green" />
                            <span>Structural & Safety Specs</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block">Net Module Area:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                {grossArea} sq ft
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Rooftop Footprint:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                ~{requiredFootprint} sq ft (1.65x pitch)
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Structure Substrate:</span>
                              <span className="font-semibold text-slate-900 font-mono truncate block">
                                {mech.structure_type_used?.replace(/_/g, ' ') || survey.structure_type?.replace(/_/g, ' ') || 'STANDARD GI'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Wind Rating:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                {mech.wind_speed_zone_kmh || 150} km/h (IS 875 Part 3)
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">AC Breaker:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                {breakerA} A ({prot.acdb?.supplyPhase || survey.supply_phase || 'SINGLE'})
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Safety Gear:</span>
                              <span className="font-semibold text-slate-900 font-mono">
                                {prot.earthing_pits_needed || 2} Earthing • {prot.lightning_arrester_required ? 'LA Included' : 'Standard'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Engineering Validations Panel */}
                      {activeBom.bom_validations && activeBom.bom_validations.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
                          <div className="text-xs font-bold text-slate-700 flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-solar-green" /> Compliance Rule Checks ({activeBom.bom_validations.length})
                            </span>
                            {activeBom.is_approval_blocked ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Violations Blocking Approval
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                All Safety Rules Passed
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {activeBom.bom_validations.map((v) => (
                              <div
                                key={v.id}
                                className={`p-2 rounded text-[11px] flex items-start gap-2 border ${
                                  v.severity === 'BLOCKING'
                                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                    : v.severity === 'WARNING'
                                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                }`}
                              >
                                {v.severity === 'BLOCKING' ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                                ) : v.severity === 'WARNING' ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                ) : (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                )}
                                <div>
                                  <span className="font-mono font-bold mr-1.5">[{v.rule_code}]</span>
                                  <span>{v.message}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

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
              <option value="EARTHING_PIT">Earthing Location</option>
              <option value="ELECTRICAL_PANEL">Main Distribution Panel</option>
              <option value="OTHER">Other Evidence</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Image URL / File Path *</label>
            <input
              type="text"
              required
              placeholder="e.g. https://storage.sunpower.com/surveys/roof_south.jpg"
              value={photoData.file_url}
              onChange={(e) => setPhotoData({ ...photoData, file_url: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Photo Caption (Optional)</label>
            <input
              type="text"
              placeholder="e.g. South view showing AC outdoor unit"
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
              Record Photo
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
            <Info className="w-4 h-4 text-solar-gold mt-0.5 shrink-0" />
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
              <option value="">Auto-select Optimum Tier-A Brand (Default Engine Choice)</option>
              {panelOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.model_name || p.sku} ({p.rated_capacity_w || 540}W) — ₹{Number(p.standard_cost).toLocaleString('en-IN')}/module
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Inverter */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>2. Grid-Tied Solar Inverter</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">
                {specs.supply_phase === 'THREE' ? '3-Phase (415V)' : 'Single Phase (230V)'}
              </span>
            </label>
            <select
              value={bomOverrides.inverter_product_id}
              onChange={(e) => setBomOverrides({ ...bomOverrides, inverter_product_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-solar-gold"
            >
              <option value="">Auto-select Optimum Sized Inverter (Default Engine Choice)</option>
              {inverterOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.model_name || p.sku} ({p.rated_capacity_w ? `${(p.rated_capacity_w / 1000).toFixed(1)} kW` : 'Inverter'}) — ₹{Number(p.standard_cost).toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          {/* Section 3: Mounting Structure */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              3. Solar Mounting Structure Substrate
            </label>
            <select
              value={bomOverrides.structure_product_id}
              onChange={(e) => setBomOverrides({ ...bomOverrides, structure_product_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-solar-gold"
            >
              <option value="">Auto-adapt based on Roof Substrate (Default Engine Choice)</option>
              {structureOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.model_name || p.sku} — ₹{Number(p.standard_cost).toLocaleString('en-IN')}/{p.unit_code}
                </option>
              ))}
            </select>
          </div>

          {/* Section 4: Cables & Wiring Overrides */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              4. Cable Lengths & Wiring Overrides
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* DC Solar Cable */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-700 block">DC Solar Cable (PV Array to Inverter)</span>
                <select
                  value={bomOverrides.dc_cable_product_id}
                  onChange={(e) => setBomOverrides({ ...bomOverrides, dc_cable_product_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900"
                >
                  <option value="">Auto-select DC Cable Brand</option>
                  {dcCableOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} {p.sku} (₹{Number(p.standard_cost)}/m)
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="1"
                    placeholder="Custom meters (e.g. 35)"
                    value={bomOverrides.dc_cable_meters}
                    onChange={(e) => setBomOverrides({ ...bomOverrides, dc_cable_meters: e.target.value })}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs font-mono"
                  />
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">meters</span>
                </div>
              </div>

              {/* AC Armored Cable */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-700 block">AC Armored Cable (Inverter to Meter)</span>
                <select
                  value={bomOverrides.ac_cable_product_id}
                  onChange={(e) => setBomOverrides({ ...bomOverrides, ac_cable_product_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900"
                >
                  <option value="">Auto-select AC Cable Brand</option>
                  {acCableOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} {p.sku} (₹{Number(p.standard_cost)}/m)
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="1"
                    placeholder="Custom meters (e.g. 25)"
                    value={bomOverrides.ac_cable_meters}
                    onChange={(e) => setBomOverrides({ ...bomOverrides, ac_cable_meters: e.target.value })}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs font-mono"
                  />
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">meters</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleResetOverrides}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Reset to Recommended Engine Specs
            </button>
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setShowCustomizeModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Apply Customization & Size BOM
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
