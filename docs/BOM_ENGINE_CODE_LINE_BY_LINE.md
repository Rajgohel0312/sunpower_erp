# SunPower ERP — BOM Generation Engine 2.0
# Complete Line-by-Line Code Structure & Implementation Guide

> **Document Purpose**: This document provides an exhaustive, line-by-line and section-by-section walkthrough of the entire Dynamic Engineering BOM Generation Engine 2.0 in SunPower ERP. It is written so that any engineer, architect, or non-technical stakeholder can trace exactly what each line of code does, why it exists, and how all files interact.

---

## Table of Contents
1. [Architectural Overview & Request Lifecycle](#1-architectural-overview--request-lifecycle)
2. [Directory & File Organization Map](#2-directory--file-organization-map)
3. [Tier A: Pure Engineering Engines (`server/src/modules/engineering/engines/`)](#3-tier-a-pure-engineering-engines)
   - [3.1 `capacity.engine.js`](#31-capacityenginejs)
   - [3.2 `area.engine.js`](#32-areaenginejs)
   - [3.3 `string.engine.js`](#33-stringenginejs)
   - [3.4 `inverter.engine.js`](#34-inverterenginejs)
   - [3.5 `mounting.engine.js`](#35-mountingenginejs)
   - [3.6 `cable.engine.js`](#36-cableenginejs)
   - [3.7 `protection.engine.js`](#37-protectionenginejs)
   - [3.8 `earthing.engine.js`](#38-earthingenginejs)
4. [Tier A Orchestrator: `engineering.service.js`](#4-tier-a-orchestrator-engineeringservicejs)
5. [Tier B: Product Mapping & Filtering (`server/src/modules/product-mapping/`)](#5-tier-b-product-mapping--filtering)
   - [5.1 `compatibility.service.js`](#51-compatibilityservicejs)
   - [5.2 `product-selector.service.js`](#52-product-selectorservicejs)
   - [5.3 `product-mapping.service.js`](#53-product-mappingservicejs)
6. [Tier C: BOM Assembly, Pricing & Approval Gating (`server/src/modules/bom/`)](#6-tier-c-bom-assembly-pricing--approval-gating)
   - [6.1 `bom.generator.js`](#61-bomgeneratorjs)
   - [6.2 `bom.pricing.js`](#62-bompricingjs)
   - [6.3 `bom.validator.js`](#63-bomvalidatorjs)
   - [6.4 `bom.repository.js`](#64-bomrepositoryjs)
   - [6.5 `bom.service.js`](#65-bomservicejs)
7. [Frontend Synchronization (`SurveyDetailPage.jsx`)](#7-frontend-synchronization-surveydetailpagejsx)
8. [Database Schema & Migrations (`006_bom_engine_2_0.sql`)](#8-database-schema--migrations)

---

## 1. Architectural Overview & Request Lifecycle

The BOM Generation Engine follows a strict **3-Tier Decoupled Pipeline**:

```
[ Frontend: SurveyDetailPage.jsx ]
         │
         │ 1. User clicks "Generate BOM"
         │    (Auto-saves form specs to DB first)
         ▼
[ HTTP Route: POST /api/v1/boms/generate/:surveyId ]
         │
         ▼
[ BOM Controller: bom.controller.js ]
         │
         ▼
[ BOM Service: bom.service.js (Tier C Orchestrator) ]
         │
         ├───► STEP 1: Calls Tier A (Pure Physics)
         │     [ engineering.service.js ]
         │     Runs 8 mathematical engines (Capacity, Area, String, Inverter,
         │     Mounting, Cable, Protection, Earthing).
         │     Output: Pure Engineering Specification (No SKUs, No Prices).
         │
         ├───► STEP 2: Calls Tier B (Warehouse Catalog Bouncer)
         │     [ product-mapping.service.js ]
         │     Runs Hard Filters (compatibility.service.js) and Commercial
         │     Ranking (product-selector.service.js) across all 10 product categories.
         │     Output: Mapped Certified Products + Rejected Alternatives.
         │
         ├───► STEP 3: Calls Tier C Assembly & Pricing
         │     [ bom.generator.js + bom.pricing.js ]
         │     Assembles line items with quantities, multiplying by locked standard costs.
         │
         ├───► STEP 4: Calls Tier C Validation & Approval Gate
         │     [ bom.validator.js ]
         │     Gathers all Blockers and Warnings.
         │     If Blockers exist -> mode = 'PRELIMINARY', is_approval_blocked = true.
         │     If Clean -> mode = 'INSTALLATION_READY', is_approval_blocked = false.
         │
         └───► STEP 5: Transactional Database Persistence
               [ bom.repository.js ]
               Runs in a Prisma $transaction:
               - Increments version (v1 -> v2)
               - Supersedes previous DRAFT BOMs
               - Generates sequential human-readable BOM number (BOM-2026-XXXXX)
               - Stores full `engineering_snapshot` JSONB
               - Inserts line items and validation records atomically.
```

---

## 2. Directory & File Organization Map

| Directory / File Path | Responsibility | Layer |
| :--- | :--- | :--- |
| `server/src/modules/engineering/engines/capacity.engine.js` | Sizing module counts & installed DC kWp | Tier A (Physics) |
| `server/src/modules/engineering/engines/area.engine.js` | Usable area vs. 1.65x pitch shadow footprint | Tier A (Physics) |
| `server/src/modules/engineering/engines/string.engine.js` | Winter Voc(max), Summer Vmp(min), string splitting | Tier A (Physics) |
| `server/src/modules/engineering/engines/inverter.engine.js` | Grid phase matching & DC/AC oversizing ratios | Tier A (Physics) |
| `server/src/modules/engineering/engines/mounting.engine.js` | Substrate matching (metal shed clamps, tile hooks) | Tier A (Physics) |
| `server/src/modules/engineering/engines/cable.engine.js` | Wire resistance on 70°C roof & Ohm's law drop | Tier A (Physics) |
| `server/src/modules/engineering/engines/protection.engine.js` | 1.25x continuous current AC MCBs & Type II SPDs | Tier A (Physics) |
| `server/src/modules/engineering/engines/earthing.engine.js` | Equipment pits vs. IS 62305 lightning mast | Tier A (Physics) |
| `server/src/modules/engineering/engineering.service.js` | Coordinates Tier A engines; auto-upsizes cables | Tier A Orchestrator |
| `server/src/modules/product-mapping/compatibility.service.js` | Hard technical filters (phase, volts, amps, roof) | Tier B (Catalog Filter) |
| `server/src/modules/product-mapping/product-selector.service.js` | Ranks certified products by cost & cross-section | Tier B (Catalog Filter) |
| `server/src/modules/product-mapping/product-mapping.service.js` | Queries database & maps 10 product groups | Tier B Orchestrator |
| `server/src/modules/bom/bom.generator.js` | Builds line items with quantities and notes | Tier C (Assembly) |
| `server/src/modules/bom/bom.pricing.js` | Multiplies quantity × unit cost for totals | Tier C (Pricing) |
| `server/src/modules/bom/bom.validator.js` | Decides INSTALLATION_READY vs PRELIMINARY | Tier C (Validation) |
| `server/src/modules/bom/bom.repository.js` | Sequential numbering, atomic versioning, queries | Tier C (Data Access) |
| `server/src/modules/bom/bom.service.js` | Lifecycle coordinator: generate, get, approve | Tier C Orchestrator |
| `server/src/modules/bom/bom.controller.js` | Express HTTP request/response handler | HTTP Interface |
| `server/src/modules/bom/bom.routes.js` | RBAC-protected REST route definitions | HTTP Interface |
| `client/src/pages/surveys/SurveyDetailPage.jsx` | Frontend UI, Live Space Calc, Snapshot Cards | Client View |

---

## 3. Tier A: Pure Engineering Engines

Every engine in this folder is a **pure function**. It does not query the database, does not know product brand names, and does not know prices. It takes inputs and returns physics calculations.

---

### 3.1 `capacity.engine.js`

**File**: `server/src/modules/engineering/engines/capacity.engine.js`

```javascript
export const capacityEngine = {
  calculateModuleCapacity(requestedCapacityKw, moduleWattageW) {
    if (!requestedCapacityKw || Number(requestedCapacityKw) <= 0) {
      throw new Error('requestedCapacityKw must be a positive number');
    }
    const moduleWattage = Number(moduleWattageW) > 0 ? Number(moduleWattageW) : 540;
    const requestedKw = Number(requestedCapacityKw);

    // Math.ceil ensures we never install a fraction of a panel.
    // Example: (5.5 kW * 1000) / 540W = 5500 / 540 = 10.185 -> ceil = 11 modules.
    const panelCount = Math.ceil((requestedKw * 1000) / moduleWattage);

    // Actual installed DC capacity = 11 * 540W = 5940W = 5.940 kWp.
    const actualDcCapacityKw = Number(((panelCount * moduleWattage) / 1000).toFixed(3));

    // Track the extra capacity given to customer (+0.440 kWp).
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
```

---

### 3.2 `area.engine.js`

**File**: `server/src/modules/engineering/engines/area.engine.js`

This engine calculates physical glass area, applies the **1.65x pitch factor for shadow avoidance**, checks for space deficits, and enforces the rule that elevating a structure cannot bypass missing roof space.

```javascript
export const areaEngine = {
  evaluateAreaFeasibility({
    shadowFreeAreaSqft,
    proposedCapacityKw,
    panelCount,
    moduleLengthMm = 2278,
    moduleWidthMm = 1134,
    pitchFactor = 1.65
  }) {
    const availableSqft = shadowFreeAreaSqft ? Number(shadowFreeAreaSqft) : null;
    const capacityKw = Number(proposedCapacityKw);

    // Calculate exact glass surface area per module.
    // Length (2.278m) * Width (1.134m) = 2.583 sq meters.
    // 1 sq meter = 10.7639 sq ft -> 2.583 * 10.7639 = 27.81 sq ft per panel.
    const moduleAreaSqM = (Number(moduleLengthMm) * Number(moduleWidthMm)) / 1000000;
    const singleModuleSqFt = moduleAreaSqM * 10.7639;
    const netModuleAreaSqft = Number((panelCount * singleModuleSqFt).toFixed(2));

    // Required installation footprint with row-to-row tilt shadow clearance and walkways.
    // Example: 11 panels * 27.81 sq ft = 305.91 sq ft * 1.65 = 505 sq ft!
    const requiredGrossAreaSqft = Math.ceil(netModuleAreaSqft * Number(pitchFactor));

    const benchmarkAreaSqft = Math.ceil(capacityKw * 75);
    const effectiveRequiredSqft = Math.max(requiredGrossAreaSqft, benchmarkAreaSqft);

    if (availableSqft === null || availableSqft <= 0) {
      return {
        isFeasible: false,
        status: 'SITE_INSPECTION_REQUIRED',
        availableSqft: 0,
        requiredSqft: effectiveRequiredSqft,
        deficitSqft: effectiveRequiredSqft,
        maxFeasibleCapacityKw: 0,
        approvalEligible: false,
        message: 'Shadow-free rooftop area has not been surveyed or verified. Field inspection required.'
      };
    }

    const isDeficit = availableSqft < effectiveRequiredSqft;
    const deficitSqft = isDeficit ? Math.ceil(effectiveRequiredSqft - availableSqft) : 0;
    const maxFeasibleCapacityKw = Number(((availableSqft / (effectiveRequiredSqft / capacityKw))).toFixed(1));

    if (isDeficit) {
      return {
        isFeasible: false,
        status: 'AREA_INSUFFICIENT',
        availableSqft,
        requiredSqft: effectiveRequiredSqft,
        requiredFootprintSqft: effectiveRequiredSqft,
        grossModuleAreaSqft: netModuleAreaSqft,
        deficitSqft,
        maxFeasibleCapacityKw,
        approvalEligible: false, // Critical hard gate!
        message: `Rooftop shadow-free area (${availableSqft} sq ft) is insufficient for ${capacityKw} kWp (requires ~${effectiveRequiredSqft} sq ft). Area deficit of ${deficitSqft} sq ft. Maximum feasible capacity on this footprint is ~${maxFeasibleCapacityKw} kWp.`,
        recommendation: `Reduce proposed capacity to ${maxFeasibleCapacityKw} kWp or identify additional unobstructed rooftop space. Note: Elevating structure cannot bypass insufficient usable footprint.`
      };
    }

    return {
      isFeasible: true,
      status: 'VERIFIED_FEASIBLE',
      availableSqft,
      requiredSqft: effectiveRequiredSqft,
      requiredFootprintSqft: effectiveRequiredSqft,
      grossModuleAreaSqft: netModuleAreaSqft,
      deficitSqft: 0,
      maxFeasibleCapacityKw,
      approvalEligible: true,
      message: `Rooftop area verified. Available shadow-free space (${availableSqft} sq ft) comfortably accommodates ${capacityKw} kWp array (~${effectiveRequiredSqft} sq ft required).`
    };
  }
};
```

---

## 4. How Overrides & BOM Changes Work

The engine supports dynamic regeneration and overrides:
- When a user changes survey parameters (capacity, roof type, distance), clicking "Re-generate BOM" recalculates the entire BOM atomically.
- If a custom panel, inverter, structure, or cable length is provided, the engine respects the override while verifying that it satisfies physical and electrical safety rules.
