/**
 * BOM Generator Engine (Tier C)
 * Assembles mapped products and computed engineering quantities into line items
 * with documented technical justifications.
 */

export const bomGenerator = {
  /**
   * Generates BOM items list from requirements and product mappings
   */
  generateItems(requirements, mappingResults, overrides = {}) {
    const items = [];
    const map = mappingResults.mapping;
    const req = requirements;

    // 1. Solar PV Modules
    if (map.panel?.selected) {
      const panel = map.panel.selected;
      const count = req.capacity.panelCount;
      const unitCost = Number(panel.standard_cost);
      items.push({
        product_id: panel.id,
        quantity: count,
        unit_cost: unitCost,
        total_cost: count * unitCost,
        notes: `${count}x ${panel.rated_capacity_w || 540}W Mono PERC Half-Cut (~${req.capacity.actualDcCapacityKw} kWp) [Req. Area: ~${req.area.requiredSqft} sq ft]`
      });
    }

    // 2. Solar Inverter
    if (map.inverter?.selected) {
      const inv = map.inverter.selected;
      const unitCost = Number(inv.standard_cost);
      const ratio = ((req.capacity.actualDcCapacityKw * 1000) / (inv.rated_capacity_w || 5000)).toFixed(2);
      items.push({
        product_id: inv.id,
        quantity: 1,
        unit_cost: unitCost,
        total_cost: unitCost,
        notes: `${(Number(inv.rated_capacity_w || 5000) / 1000).toFixed(1)}kW ${req.inverter.requiredPhase} Phase On-Grid Inverter (DC/AC Oversizing Ratio: ${ratio})`
      });
    }

    // 3. Mounting Structure Kit
    if (map.structure?.selected) {
      const struct = map.structure.selected;
      const qty = req.mounting.structQty;
      const unitCost = Number(struct.standard_cost);
      items.push({
        product_id: struct.id,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        notes: req.mounting.notes
      });
    }

    // 4. Solar DC Cable
    if (map.dcCable?.selected) {
      const dcCab = map.dcCable.selected;
      const qty = overrides.dc_cable_meters !== undefined ? Number(overrides.dc_cable_meters) : req.cables.dc.totalDcLengthMeters;
      const unitCost = Number(dcCab.standard_cost);
      items.push({
        product_id: dcCab.id,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        notes: req.cables.dc.notes
      });
    }

    // 5. AC Armored Cable
    if (map.acCable?.selected) {
      const acCab = map.acCable.selected;
      const qty = overrides.ac_cable_meters !== undefined ? Number(overrides.ac_cable_meters) : req.cables.ac.totalAcLengthMeters;
      const unitCost = Number(acCab.standard_cost);
      items.push({
        product_id: acCab.id,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        notes: req.cables.ac.notes
      });
    }

    // 6. AC Distribution Box (ACDB)
    if (map.acdb?.selected) {
      const acdb = map.acdb.selected;
      const unitCost = Number(acdb.standard_cost);
      items.push({
        product_id: acdb.id,
        quantity: 1,
        unit_cost: unitCost,
        total_cost: unitCost,
        notes: req.protection.acdb.notes
      });
    }

    // 7. DC Combiner Box (DCDB)
    if (map.dcdb?.selected) {
      const dcdb = map.dcdb.selected;
      const unitCost = Number(dcdb.standard_cost);
      items.push({
        product_id: dcdb.id,
        quantity: 1,
        unit_cost: unitCost,
        total_cost: unitCost,
        notes: req.protection.dcdb.notes
      });
    }

    // 8. Chemical Earthing Electrodes
    if (map.earthing?.selected) {
      const earth = map.earthing.selected;
      const qty = req.earthing.totalRecommendedPits;
      const unitCost = Number(earth.standard_cost);
      items.push({
        product_id: earth.id,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        notes: req.earthing.notes
      });
    }

    // 9. Lightning Arrester (if required)
    if (map.lightningArrester?.selected) {
      const la = map.lightningArrester.selected;
      const unitCost = Number(la.standard_cost);
      items.push({
        product_id: la.id,
        quantity: 1,
        unit_cost: unitCost,
        total_cost: unitCost,
        notes: `Conventional Copper Lightning Arrester (1m pure copper mast & base terminal). Reason: ${req.earthing.lpsReason}`
      });
    }

    // 10. Balance of System Kit
    if (map.bos?.selected) {
      const bos = map.bos.selected;
      const qty = req.mounting.structQty;
      const unitCost = Number(bos.standard_cost);
      items.push({
        product_id: bos.id,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        notes: `Complete BOS Kit for ${qty} kW (${req.bos.mc4ConnectorPairs} MC4 pairs, ${req.bos.conduitLengthM}m conduits, ${req.bos.midClamps} mid-clamps, ${req.bos.endClamps} end-clamps)`
      });
    }

    return items;
  }
};
