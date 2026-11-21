/**
 * Solar Array Capacity Engineering Engine
 * Deterministic calculation of panel count, actual installed DC capacity, and array power.
 */

export const capacityEngine = {
  /**
   * Calculates module count and actual DC array capacity from requested system size
   * @param {number} requestedCapacityKw - Target DC capacity in kWp
   * @param {number} moduleWattageW - Nameplate rated power of PV module in Watts
   * @returns {{ panelCount: number, actualDcCapacityKw: number, requestedCapacityKw: number, oversizingDeltaKw: number }}
   */
  calculateModuleCapacity(requestedCapacityKw, moduleWattageW) {
    if (!requestedCapacityKw || Number(requestedCapacityKw) <= 0) {
      throw new Error('requestedCapacityKw must be a positive number');
    }
    const moduleWattage = Number(moduleWattageW) > 0 ? Number(moduleWattageW) : 540;
    const requestedKw = Number(requestedCapacityKw);

    // Number of modules required to meet or exceed requested capacity
    const panelCount = Math.ceil((requestedKw * 1000) / moduleWattage);
    const actualDcCapacityKw = Number(((panelCount * moduleWattage) / 1000).toFixed(3));
    const oversizingDeltaKw = Number((actualDcCapacityKw - requestedKw).toFixed(3));

    return {
      requestedCapacityKw: requestedKw,
      moduleWattageW: moduleWattage,
      panelCount,
      actualDcCapacityKw,
      oversizingDeltaKw
    };
  }
};
