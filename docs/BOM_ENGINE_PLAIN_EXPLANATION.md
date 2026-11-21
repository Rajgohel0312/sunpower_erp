# SunPower ERP — BOM Generation Engine 2.0
## Plain-English Guide & Code Structure Walkthrough

> **Who this guide is for:** Anyone who needs to understand, explain, present, or maintain the SunPower ERP BOM Engine without needing a degree in electrical engineering or advanced mathematics.

---

## Part 1: The Big Picture (The 3-Tier Factory Analogy)

Imagine you are custom-building a high-end rooftop solar system. Instead of throwing everything into one big messy script, the engine works like an organized 3-department factory:

```
┌────────────────────────────────────────────────────────┐
│ TIER A: The Solar Architect (Engineering Engine)       │
│ • Inspects the roof and calculates pure physics.       │
│ • Has ZERO knowledge of the catalog, prices, or SKUs.  │
│ • Output: "Blueprint" (Exact Watts, Volts, Area, Wire) │
└──────────────────────────┬─────────────────────────────┘
                           │ Pure Blueprint
                           ▼
┌────────────────────────────────────────────────────────┐
│ TIER B: The Warehouse Manager (Product Mapping)        │
│ • Looks at available items in the company warehouse.   │
│ • Rejects any product that violates the blueprint.     │
│ • Among certified safe items, picks the best price.    │
│ • Output: "Selected Products + Alternatives"           │
└──────────────────────────┬─────────────────────────────┘
                           │ Mapped Items
                           ▼
┌────────────────────────────────────────────────────────┐
│ TIER C: The Safety Inspector & Cashier (BOM Assembly)  │
│ • Multiplies quantities by locked catalog prices.      │
│ • Checks: Are there any safety or space violations?    │
│ • If safe: Stamps "INSTALLATION READY" (can approve)   │
│ • If unsafe: Stamps "PRELIMINARY" (blocks approval)    │
└────────────────────────────────────────────────────────┘
```

---

## Part 2: How Every Calculation Works (In Simple Terms)

### 1. Panel Count & Actual Power (Capacity Engine)
* **The Goal**: The customer asks for 5.5 kW (5,500 Watts). How many panels do we need?
* **Simple Logic**:
  * We use standard **540 Watt Mono PERC** solar panels.
  * You cannot install half a panel or 0.18 of a panel!
  * Calculation: $5,500 \div 540 = 10.18$ panels.
  * We round **UP** to **11 panels**.
  * Total installed capacity = $11 \times 540\text{W} = \mathbf{5.94\text{ kWp}}$.
  * We track the $+0.44\text{ kWp}$ extra power so the customer knows they are getting slightly more power than requested.

---

### 2. Roof Space & The Shadow Rule (Area Engine)
* **The Common Mistake**: Most people think: *"My panel is 28 sq ft, so 11 panels need $11 \times 28 = 308\text{ sq ft}$."* That is wrong!
* **The Physical Reality**:
  * Solar panels are installed at a tilt (angled towards the south sun).
  * In the early morning, late afternoon, and especially in winter when the sun is low, **each tilted row casts a shadow behind it**.
  * If you put Row 2 right against Row 1, Row 1 will shade Row 2 and kill your generation!
  * You must leave empty space between rows, plus walking paths for maintenance and cleaning.
  * In Gujarat (latitudes $21^\circ - 24^\circ$), you need **$1.65\times$ the panel glass area** for row spacing.
* **The Calculation**:
  * 1 Panel = $2.28\text{m} \times 1.13\text{m} \approx \mathbf{27.8\text{ sq ft}}$.
  * 11 Panels = $306\text{ sq ft}$ of glass.
  * With $1.65\times$ pitch factor: $306 \times 1.65 = \mathbf{505\text{ sq ft}}$ minimum shadow-free space!
* **Why Elevating Does NOT Fix Space Shortage**:
  * If a roof is only $400\text{ sq ft}$, lifting the structure on 8.5ft legs lifts panels above a parapet wall or water tank, but **it cannot make the roof wider**. You cannot hang solar panels in thin air outside the building footprint.
  * When area is short, the engine flags **`AREA_INSUFFICIENT`** and blocks installation approval.

---

### 3. Winter Cold Voltage vs. Summer Heat (String Engine)
* **The Weird Physics of Solar**:
  * Most people think solar panels give more voltage when they are boiling hot. **It is the opposite!**
  * Solar cells produce their **highest voltage on freezing cold winter mornings (5°C)**.
  * On a cold morning, open-circuit voltage ($V_{oc}$) increases by $\approx +10\%$.
  * Single panel voltage rises from $49.5\text{V}$ to $\mathbf{52.2\text{V}}$.
* **Why This Matters (Preventing Inverter Explosions)**:
  * Inverters have a strict maximum DC voltage limit (e.g. $550\text{V}$ for single-phase, $1,100\text{V}$ for three-phase).
  * If you wire 11 panels in one single string: $11 \times 52.2\text{V} = \mathbf{574\text{V}}$!
  * If your inverter limit is $550\text{V}$, on the first cold December morning, $574\text{V}$ hits the inverter and **blows up the internal electronics**.
  * The String Engine calculates this cold voltage in advance. If 1 string is too high, it automatically splits the panels into **2 balanced strings** (e.g. 5 panels and 6 panels $\approx 260\text{V}-313\text{V}$), keeping it safe.

---

### 4. Wire Sizing & The Garden Hose Analogy (Cable Engine)
* **The Garden Hose Analogy**:
  * Think of electric cable like a garden hose. If water travels through a very long, thin hose, water pressure drops by the time it reaches the nozzle.
  * In electricity, that lost pressure is called **Voltage Drop**, and it turns valuable solar power into waste heat!
* **The Standards Rule**:
  * We never want to lose more than **$1.5\%$** of our solar power inside the DC wire.
* **Why Wires Need to Be 6 sq mm**:
  * Solar DC wires on dark roofs bake in the sun up to **$70^\circ\text{C}$**. Hot copper has higher resistance.
  * If your cable run from the roof to the ground meter is $25\text{ meters}$ or more, standard thin wire ($4\text{ sq mm}$) loses $\approx 1.8\%$ to $2.2\%$ of your power (triggering a warning).
  * Our engine automatically upsizes the wire to **$6\text{ sq mm}$**.
  * A $6\text{ sq mm}$ wire is thicker, cuts resistance by **$33\%$**, brings power loss down to $\approx 1.1\%$, and clears the warning.

---

### 5. Inverter Phase Matching (Inverter Engine)
* If a house has Single-Phase (230V) power, you cannot connect a Three-Phase (415V) inverter. The electricity board (DISCOM) inspector will immediately fail the site.
* The Inverter Engine enforces a strict 1:1 match. A mismatch flags **`INVERTER_PHASE_MISMATCH`** and blocks approval.

---

### 6. Circuit Breakers (Protection Engine)
* **The 1.25× Continuous Rule**:
  * When a solar inverter pumps power all day, current flows non-stop for 6–8 hours.
  * If an inverter pushes $22\text{ Amps}$ of current, you cannot use a $22\text{A}$ breaker. Continuous heat would cause it to nuisance-trip.
  * Electrical safety standards mandate multiplying continuous current by $1.25\times$:
    $$22\text{A} \times 1.25 = 27.5\text{A} \implies \text{Next standard MCB is }\mathbf{32\text{ Amps}}.$$

---

### 7. Chemical Earthing & Lightning Protection (Earthing Engine)
* **2 Earthing Pits** are always mandatory:
  1. One pit to ground the metal panel frames and mounting structures.
  2. One pit to ground the inverter chassis and AC distribution box.
* **When is a 3rd Pit + Lightning Arrester Required?**
  * Systems $\ge 5\text{ kWp}$ or high-clearance elevated super-structures act as elevated strike targets on rooftops.
  * Per standard IS/IEC 62305, the engine mandates a dedicated rooftop **Lightning Arrester** mast and a dedicated, isolated **3rd Chemical Earthing Pit**.

---

## Part 3: Code Structure — What Lives Where

Here is the exact map of the codebase and the single responsibility of every file:

```
server/src/modules/
│
├── engineering/                     # TIER A: PURE CALCULATIONS (No Database, No SKUs)
│   ├── engineering.service.js       # The Master Architect: coordinates all 8 sub-engines
│   └── engines/
│       ├── capacity.engine.js       # Calculates panel count & installed DC kWp
│       ├── area.engine.js           # Calculates required sq ft (1.65x pitch) & deficit
│       ├── string.engine.js         # Calculates cold Voc(max), hot Vmp(min), string splitting
│       ├── inverter.engine.js       # Verifies phase match & DC/AC oversizing ratio
│       ├── mounting.engine.js       # Selects substrate kit (metal shed clamp, tiled hook, etc.)
│       ├── cable.engine.js          # Ohm's law voltage drop on 70°C roof & conductor sizing
│       ├── protection.engine.js     # Sizes 1.25x AC MCB breakers & Type II SPDs
│       └── earthing.engine.js       # Sizes equipment earth pits vs IS 62305 lightning mast
│
├── product-mapping/                 # TIER B: WAREHOUSE MATCHING (Technical Bouncer)
│   ├── compatibility.service.js     # Stage 1: Hard pass/fail filters (phase, volts, amps, substrate)
│   ├── product-selector.service.js  # Stage 2: Ranks certified products by cost & handles overrides
│   └── product-mapping.service.js   # Orchestrates catalog queries across all 10 component groups
│
├── bom/                             # TIER C: ASSEMBLY, PRICING & APPROVAL GATING
│   ├── bom.service.js               # Conductor: runs Tier A -> Tier B -> Tier C -> saves DB
│   ├── bom.generator.js             # Assembles BOM line items with quantities & technical notes
│   ├── bom.pricing.js               # Multiplies quantities x unit rates, calculates grand total
│   ├── bom.validator.js             # Checks blockers: decides INSTALLATION_READY vs PRELIMINARY
│   ├── bom.repository.js            # Sequential BOM numbers (BOM-2026-00001) & version increments
│   ├── bom.controller.js            # HTTP endpoints (generate, get, approve, reject)
│   └── bom.routes.js                # Express router mounted at /api/v1/boms (RBAC protected)
│
└── catalog/                         # PRODUCT SPECS & EFFECTIVE-DATED PRICING
    ├── product-specification.service.js # CRUD for technical electrical/mechanical attributes
    └── product-pricing.service.js       # Effective-dated price ledger (freezes BOM historical cost)
```

### Frontend Location
* `client/src/pages/surveys/SurveyDetailPage.jsx`:
  * **Live Space Calculator**: Gives immediate feedback on roof area before generating.
  * **Auto-Save on Generation**: Automatically saves any unsaved form inputs before calculating BOM.
  * **Engineering Snapshot Cards**: Displays real-time Volts, Amps, DC/AC ratio, and wire drop %.
  * **Rules & Safety Audit Panel**: Color-coded badges for Blockers (red), Warnings (amber), and Passed (green).
  * **Approval Button**: Disabled with a lock icon if blockers exist; active green if ready.

---

## Part 4: Quick Reference Cheat-Sheet (Summary for Conversations)

| Question | Simple 1-Sentence Answer |
| :--- | :--- |
| **Why not just bundle products?** | Because every roof is unique: a tin shed needs clamps, a tile roof needs hooks, a 30m run needs 6mm wire, and a small roof will blow fuses if string voltage isn't calculated for winter. |
| **Why does 5.5 kW need 505 sq ft?** | 5.5 kW needs 11 panels (5.94 kWp). 11 panels have 306 sq ft of glass, but because tilted panels cast shadows, you must leave 1.65× space between rows so front panels don't shade back panels. |
| **Why does the wire switch to 6 sq mm?** | On long runs (>20m), thin 4mm wire loses electricity as heat on a 70°C roof. Thick 6mm wire cuts resistance by 33% and keeps power loss under 1.5%. |
| **Why is approval blocked on space deficit?** | You can raise panels on tall legs to bridge a water tank, but you cannot mount panels in empty air outside the building footprint. If the roof is too small, installation cannot proceed safely without reducing capacity. |
