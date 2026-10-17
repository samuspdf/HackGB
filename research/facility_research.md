# Facility Research — 15 Study Facilities

Lakeshore Watch · HackGB 2026 · compiled 2026-10-17

**What this covers:** for each of the 15 study facilities (top 5 per city by on-site releases), what it releases, where those releases go, and what they come in contact with locally.

**Data used**

| Source | What it gave us | Data date |
|---|---|---|
| EPA TRI Basic Data File, WI | Chemicals, pounds by medium (air / water / land), off-site transfers | Reporting year 2024 |
| EPA ECHO Detailed Facility Reports (`data/raw/echo/`) | Permits, inspections, violations, enforcement, receiving waters, impaired waters, ozone status, 1-mile demographics (ACS) | Pulled 2026-10-17 (compliance through 09/2026) |
| EPA ECHO effluent charts | Which water-permit limits were exceeded vs. reports filed late | 07/2023 – 10/2026 |
| NCES EDGE school locations (`data/raw/schools_near_facilities.json`) | Public + private schools within 1 and 3 miles | 2023–24 school year |
| Web research (sources at bottom) | Legacy contamination, fish advice, beaches, drinking water, plant status | See each source |

**How to read this (spec Section 2 rules)**
- **Releases ≠ violations.** "Releases" are what the facility reported to TRI, almost always legal under its permits. "Compliance record" is a separate section.
- **Pounds ≠ harm.** Amounts are raw pounds. Toxicity weighting (RSEI) has not been applied yet.
- **No causation claims.** Where a facility releases something that also appears in a local impairment or advisory, it's marked **possible contributor**. Where the local problem comes mainly from legacy or distant sources, that's stated.
- **Late reports vs. exceedances.** In ECHO, many Clean Water Act "violations" are late or missing monitoring reports, not measured pollution above a limit. Each is labeled.

---

## Cross-cutting findings

1. **Almost everything goes to air.** 14 of the 15 facilities release mainly to air. **Georgia-Pacific (Green Bay)** is the only one with large direct water releases (about 230,000 lb of nitrates plus about 57 lb of lead compounds to the Fox River). It's the clearest facility for the river → fish → beach demo.
2. **A lot goes to the sewer, not the river.** Several facilities send large amounts to the municipal sewage plant (POTW) rather than discharging directly:
   - Pioneer Metal Finishing: about 207,500 lb of nitrates to Green Bay's NEW Water
   - Hexion, Plastics Engineering and SACO AEI: together about 55,000 lb of formaldehyde, 22,500 lb of phenol and 19,000 lb of methanol to Sheboygan's treatment plant

   These get treated there before discharge. The app should show "sent to wastewater plant → treated → discharged to [water]" as its own pathway.
3. **The fish advisories here are mostly legacy problems.**
   - **Lower Fox River / Green Bay:** PCBs from decades of carbonless-copy-paper manufacturing and recycling. Cleanup finished in 2020–2022, and the DNR expects advisories to take 20–30 years to lift.
   - **Sheboygan River:** PCBs, largely from the former Tecumseh Products plant. The lower 14 miles still carry "do not eat resident fish" advice.
   - **Lake Michigan mercury:** largely from atmospheric deposition, often from distant sources.

   None of the 15 facilities reported PCB releases in 2024.
4. **Ozone ties together all the VOC emitters.** The lakeshore portions of Sheboygan and Manitowoc counties are in nonattainment or maintenance areas for the 2015 ozone standard. Methanol, formaldehyde, xylene, toluene, styrene and vinyl acetate are ozone-forming VOCs. That makes these facilities **possible contributors** to local ozone. The DNR notes that lakeshore ozone is also heavily driven by pollution carried in from the Chicago and Milwaukee areas.
5. **Compliance stories worth showing (separate from releases):**
   - **Pioneer Metal Finishing:** listed as a hazardous-waste Significant Noncomplier in all 12 of the last 12 quarters.
   - **Nemak Gateway** and **Wisconsin Aluminum Foundry:** both had Clean Air Act High Priority Violations in 2024–2026.
   - **Georgia-Pacific** and **Edgewater:** water permits flagged for many quarters, mostly for late or missing monitoring reports.
   - **Hexion:** a 2022 EPA settlement over TRI *reporting* (the right-to-know law, EPCRA §313).
6. **Schools are close by everywhere.** Every facility has at least 1 school within 1 mile, and Carboline has 10. In Manitowoc, four facilities share the same nearby schools (Jefferson Elementary, Washington Middle, Roncalli Middle).
7. **Drinking water comes from Lake Michigan, not the rivers.**
   - Green Bay: Lake Michigan intake offshore near Kewaunee, about 30 miles from the Green Bay facilities.
   - Sheboygan: Lake Michigan.
   - Manitowoc: likely Lake Michigan. Not yet confirmed from MPU's water quality report.

   Following the spec, exact intake locations are not mapped.

---

## Green Bay (Brown County)

**Local setting:** The Lower Fox River flows north through the city into the bay of Green Bay, and the East River joins it downtown. Both lie inside the **Lower Green Bay & Fox River Area of Concern**, home of one of the largest PCB sediment cleanups ever (more than 6 million cubic yards dredged over 39 miles, about $1 billion, 2004–2020). The Fox River is on the 303(d) impaired list for **nutrients (phosphorus), PCBs and turbidity**, and it doesn't meet its fish-consumption, recreation or aquatic-life uses. About 1.2 million lb of phosphorus a year flows from the Fox into Green Bay, mostly from farm and urban runoff. NEW Water says it contributes under 3% of that. Bay Beach was closed to swimming in the late 1930s–1940s because of pollution, and the city has been working to reopen it. Brown County is not in an ozone nonattainment area.

### 1. Georgia-Pacific Broadway LLC (tissue/paper mill)
TRI ID 54307FRTHW1919S · 1919 S Broadway · parent: Koch Inc. · permits: NPDES WI0001848 (+2 general), Clean Air Act (CAA) Title V, RCRA

**What it releases (2024, on-site 249,103 lb)**

| Chemical | Air (lb) | Water (lb) | Notes |
|---|---|---|---|
| Nitrate compounds | 0 | 230,000 | A nutrient (nitrogen) |
| Methanol | 14,690 | 170 | VOC from pulping/processing |
| Ammonia | 3,900 | 150 | Nutrient; toxic to fish at high levels |
| Lead compounds | 3.7 | 56.6 | Persistent, bioaccumulative toxic (PBT) |
| 1,3-Dichloro-2-propanol | 51 | 80 | Comes from wet-strength paper resins |
| Mercury compounds | 2.0 | 0 | PBT |
| Dioxin & dioxin-like compounds | trace (grams) | — | PBT, carcinogen |

These totals have held steady at about 249,000–258,000 lb/yr since 2020.

**Where it goes / what it touches**
- **Water → Fox River**, about 2 miles above its mouth at Green Bay.
  - **Nutrients:** the Fox is impaired for nutrients. The nitrate and ammonia are a **possible contributor** to nutrient loading, though the DNR's nutrient listing and cleanup plan (TMDL) target phosphorus, which this facility doesn't report to TRI.
  - **PCBs:** the Fox's fish advisory and PCB impairment come from **legacy PCB sediments**. The mill's corporate predecessor (Fort James / Fort Howard, now Georgia-Pacific Consumer Products) was one of the companies held responsible for that contamination. It settled its natural-resource-damage liability in 2002 (preserve 1,000+ acres of habitat plus $8.5M), and Georgia-Pacific, NCR and Glatfelter later agreed to cover future cleanup costs. The 2024 releases contain no PCBs.
  - **Lead and mercury:** the water lead (about 57 lb) and air mercury are PBTs that can build up in sediment and fish. The Fox isn't listed as impaired for lead.
- **Air:** methanol and ammonia reach the surrounding neighborhood.
- **People within 1 mile:** 6,548 residents. 28% people of color, 38% low-income, 8% under age 5.
- **Schools within 1 mile:** Cormier School & Early Learning Center, Green Bay Area Catholic Education. 48 schools within 3 miles.
- **Wildlife:** fish-eating birds and mammals along the lower Fox and bay (eagles, cormorants, gulls) are the receptors the spec flags for PBTs.

**Compliance record (separate from releases)**
- **Water permit WI0001848:** in noncompliance 7 of the last 13 quarters, 2 of them *Significant Noncompliance*. **Every violation is a late or missing monitoring report**: mercury (9), copper (100 entries), flow, temperature. **No measured exceedances of limits.** Pollutant loads reported to EPA dropped from about 87,000 lb (2022) to about 400–500 lb (2025–26). That could reflect a reporting change and needs checking before the app shows it.
- Hazardous waste (RCRA): Notice of Noncompliance (state), 03/2024. Generator, manifest and land-disposal-restriction paperwork issues.
- Air: no violations. 2 inspections, last 06/2025.
- Formal enforcement actions and penalties: none in 5 years.

### 2. CNG Green Bay (listed in ECHO as Legacy Flexo; flexographic printing)
TRI ID 5430WLGCYF1327G · 1327 Glory Rd · only permit on file: TRI

**What it releases:** **ozone, 46,558 lb, all stack air**, its only TRI chemical. Ozone is a lung irritant. Flexible-packaging printers usually generate ozone with corona treaters, which prepare film surfaces for ink. That's likely the source here but not confirmed.

**What it touches**
- **Air** only. Ozone at ground level irritates airways and worsens asthma. It breaks down within hours, so the effect is local.
- **People within 1 mile:** 2,476 residents. 23% people of color, 18% low-income.
- **Schools within 1 mile:** Family Services of Northeast Wisconsin. 19 within 3 miles.

**Compliance:** no air, water or hazardous-waste permits are listed in ECHO, so there's no compliance history. Worth asking whether its ozone emissions are covered by a state air permit. **To verify.**

### 3. Green Bay Packaging — Coated Products Division (label/coated paper)
TRI ID 54307GRNBY3250S · 3250 S Ridge Rd · permits: CAA (synthetic minor), RCRA

**What it releases:** **vinyl acetate, 23,968 lb, almost all stack air**, its only TRI chemical. Vinyl acetate is a VOC used in adhesives and coatings. TRI flags it as a carcinogen (IARC: possibly carcinogenic to humans). It irritates the eyes and respiratory tract.

**What it touches**
- **Air:** the nearby residential area. Vinyl acetate is also an ozone-forming VOC, but Brown County isn't in an ozone nonattainment area.
- **People within 1 mile:** 2,979 residents. 21% people of color, 22% low-income.
- **Schools within 1 mile:** Family Services of Northeast Wisconsin. 21 within 3 miles.

**Compliance:** state warning letter (air), 12/2022. EPA "other response — no further action" (air), 09/2025. 3 air inspections, last 10/2025. No formal actions.

### 4. Pioneer Metal Finishing (anodizing / metal finishing)
TRI ID 54304PNRNR486GL · 486 Globe Ave · permits: RCRA only (plus TRI)

**What it releases (on-site 14,477 lb)**

| Chemical | Air (lb) | To sewer plant (lb) | Off-site disposal (lb) |
|---|---|---|---|
| Nitric acid | 14,467 | — | — |
| Nickel & compounds | 10 | 428 | 11,735 |
| Nitrate compounds | — | 207,502 | 20,750 |

- Nitric acid: corrosive, a respiratory irritant.
- Nickel compounds: TRI-flagged carcinogen, known human carcinogen by inhalation (IARC).

**Where it goes / what it touches**
- **Air:** nitric acid mist reaches the area around Globe Ave.
- **Sewer → NEW Water (Green Bay Metropolitan Sewerage District) → Fox River / Green Bay.** The 207,500 lb of nitrates is the largest single transfer to a sewage plant among the 15 facilities. Nitrates are only partly removed in treatment. That makes it a **possible contributor** to nutrient loading in the Fox/bay, which is impaired for nutrients (the DNR's TMDL targets phosphorus).
- **People within 1 mile:** 4,213 residents. 29% people of color, 38% low-income.
- **Within 1 mile:** Cormier School & Early Learning Center, Green Bay Correctional Institution. 32 schools within 3 miles.

**Compliance:**
- **Hazardous waste: Significant Noncomplier, all 12 of the last 12 quarters**, currently flagged SNC. State Notice of Noncompliance 02/2023. 2 inspections, last 07/2026.
- Earlier EPA RCRA case (05-2017-9909), $5,000 penalty.
- OSHA (workplace, not environmental): 8 inspections, 11 violations, $15,266 in penalties.

This is the strongest documented compliance problem among the 15.

### 5. Carboline Global Inc. (industrial coatings; parent RPM International)
TRI ID 54302WSCNS614EL · 614 Elizabeth St (east side, near the East River) · permits: CAA (Title V), RCRA

**What it releases (on-site 9,060 lb, all air):** xylene 3,365 · toluene 3,233 · n-butyl alcohol 912 · ethylbenzene 768 · styrene 603 · zinc, barium, aluminum dust, diisocyanates in small amounts · lead and mercury compounds under 1 lb each.
- These are paint solvents and VOCs. Ethylbenzene and styrene are TRI-flagged carcinogens, and diisocyanates are a leading cause of occupational asthma.
- **Off-site:** about 254,000 lb sent off for disposal, mostly toluene (131,000) and xylene (57,000).

**What it touches**
- **Air:** a dense residential neighborhood. Solvent VOCs are also ozone precursors.
- **People within 1 mile:** 13,778 residents, the most of any Green Bay facility. **53% people of color**, the highest of all 15. 44% low-income, 19% below poverty, 1,074 children under 5.
- **Schools within 1 mile: 10**, the most of any facility: Bay View, Danz Elementary, Dr. Rosa Minoka-Hill School, East High, Green Bay Trinity Lutheran, LYNC Academy, Nicolet Elementary, St. Thomas More, Sullivan Elementary, Washington Middle. 38 within 3 miles.
- This is the clearest environmental-justice story in the Green Bay set: modest release amounts, but the most people, schools and children nearby.

**Compliance:** 2 state air Notices of Violation (03/2023, 06/2023). None in the current 3-year window. 2 air inspections, last 04/2025. No formal actions.

---

## Manitowoc (Manitowoc County)

**Local setting:** The Manitowoc River enters Lake Michigan downtown. It's on the impaired list for **PCBs in fish tissue and sediment** (since 2002) and has specific restricted fish-consumption advice. Lake Michigan along Manitowoc County is impaired for **mercury and PCBs in fish**. Red Arrow Park Beach is impaired for **pathogens** (bacteria), which comes from stormwater and wildlife, not these facilities. Lakeshore Manitowoc County is an ozone **maintenance area** under the 2015 standard (per a DNR 2025 memo; ECHO also flags it). **All five facilities release almost entirely to air, and they sit within about 2.5 miles of each other**, so their nearby schools overlap. Each facility's 1-mile population is 3,700–11,200 with 30–47% low-income.

### 1. Manitowoc Public Utilities — Electric Division (power plant)
TRI ID 54221MNTWC1303S · 1303 S 8th St (on the river near the lakefront) · city-owned · permits: CAA Title V, RCRA, drinking water (SDWA)

**What it releases (on-site 9,179 lb, all air):** hydrochloric acid 7,214 (from burning fuel) · ammonia 1,962 (from pollution-control equipment) · lead compounds 3 (PBT). Also 238 lb of lead sent off-site.

**Plant status:** still running. The boilers can burn coal, petroleum coke, biomass and gas. A recent fuel mix was about 77% wood, 20% petroleum coke and 3% coal (period ending 02/2024). MPU is converting Boilers 8 and 9 to 100% renewable fuel pellets.

**What it touches**
- **Air:** hydrochloric acid is a respiratory irritant. Lead settles onto nearby soil and water.
- **People within 1 mile:** 8,471 residents. 45% low-income.
- **Schools within 1 mile:** First German Ev. Lutheran, Jefferson Elementary, Lincoln High, Roncalli Middle, Washington Middle. 17 within 3 miles.
- Mercury isn't reported at TRI thresholds. Lake Michigan's mercury impairment is mainly from atmospheric deposition from many, often distant, sources.

**Compliance:** clean. No violations in 3 years for air, hazardous waste or drinking water. 2 air inspections, last 05/2025.

### 2. Jagemann Plating Co. (electroplating)
TRI ID 54220JGMNN1324S · 1324 S 26th St · permits: CAA, general stormwater (WIG004982), RCRA

**What it releases (on-site 5,535 lb, almost all air):** zinc compounds 5,509 · nitric acid 20 · nitrates 4 · nickel compounds 1.7 (carcinogen) · chromium compounds 1.0.
- **To the sewer plant:** 1,575 lb of nitrates, 165 lb of zinc, 135 lb of chromium compounds.
- **Off-site disposal:** about 68,000 lb, mostly zinc (33,860) and chromium compounds (27,359).

**What it touches**
- **Air:** zinc dust/fume settles nearby.
- **Sewer → Manitowoc wastewater plant → Lake Michigan** (route to verify).
- **Watershed:** Little Manitowoc River–Frontal Lake Michigan. A beach in this watershed had a closure in the last 2 years.
- **People within 1 mile:** 10,458 residents. **45% low-income.**
- **Schools within 1 mile:** Bethany Ev. Lutheran, Franklin Elementary, Jefferson Elementary, Roncalli Middle, Washington Middle.

**Compliance:** hazardous waste Notice of Noncompliance (state), 02/2026: generator, emergency-preparedness and land-disposal issues. No formal actions.

### 3. Eck Industries (aluminum foundry)
TRI ID 54220CKNDS1602N · 1602 N 8th St · permits: CAA Title V, general stormwater (WIG004331), RCRA

**What it releases (on-site 3,728 lb, all stack air):**
- **Tetrachloroethylene (perc) 2,587 lb.** EPA classifies it as likely carcinogenic to humans. It's a solvent that persists in groundwater wherever it reaches soil.
- Formaldehyde 500 (carcinogen) · chlorine 250 · copper 250 · nickel 120 (carcinogen) · naphthalene 16 · zinc 4 · lead 1.
- **Off-site:** about 21,800 lb, mostly copper (15,817) and nickel (4,254).

The DNR held a 2023 public hearing on new furnace permits here, an example of the permit-comment process from spec Phase 4.

**What it touches**
- **Air:** the north side of Manitowoc.
- **People within 1 mile:** 3,747 residents. 23% seniors (the highest share in Manitowoc).
- **Schools within 1 mile:** Immanuel Lutheran, Jackson Elementary, Roncalli Elementary, Wilson Middle.

**Compliance:** hazardous waste Notice of Noncompliance (state), 02/2026: generator, used-oil and manifest issues. 3 air inspections, last 02/2026. No air violations.

### 4. Wisconsin Aluminum Foundry Co. (aluminum/copper foundry)
TRI ID 54220WSCNS838S1 · 838 S 16th St · permits: CAA (state operating permit)

**What it releases (on-site 739 lb, all air):** naphthalene 612 (fugitive; TRI-flagged carcinogen, from foundry sand binders) · copper 124 · lead 3.5 (PBT, carcinogen).

**What it touches**
- **Air:** dense neighborhood south of downtown.
- **People within 1 mile:** 11,175 residents, the most in Manitowoc. 45% low-income, 682 children under 5.
- **Schools within 1 mile:** Bethany Ev. Lutheran, First German Ev. Lutheran, Jefferson Elementary, Roncalli Middle, Washington Middle.

**Compliance:**
- **Clean Air Act High Priority Violation**, 12/2024 → resolved 10/2025, with 8 of the last 12 quarters in noncompliance.
- Federally reportable violations 09–11/2024, particulate matter (PM / PM10) violations 02/2026, and new ones 07/2026.
- State Notices of Violation 01/2025 and 03/2026. No formal actions or penalties yet.

Low release volume, but an active air-compliance problem, which shows why the spec keeps releases and violations separate.

### 5. Pentair — Manitowoc Ice (ice machine manufacturing)
TRI ID 54220MNTWC2110S · 2110 S 26th St · permits: CAA (registration), RCRA

**What it releases (on-site 403 lb, all air):** ammonia 387 · nitric acid 16 · nickel 0.1. **Off-site:** 2,757 lb nickel and 1,041 lb copper.

**What it touches**
- **Air:** small amounts, southwest Manitowoc.
- **People within 1 mile:** 6,116 residents. **47% low-income**, the highest of all 15. 24% seniors.
- **Schools within 1 mile:** Jefferson Elementary, Monroe Elementary, Roncalli Middle, Washington Middle.

**Compliance:** hazardous waste Notice of Noncompliance (state), 04/2024: generator, universal-waste and tank-system issues. 2 quarters in violation. No formal actions.

---

## Sheboygan (Sheboygan County)

**Local setting:** The Sheboygan River meets Lake Michigan downtown. It's the **Sheboygan River Area of Concern**, with PCBs, heavy metals and PAHs in sediments, largely from the former Tecumseh Products plant upstream in Sheboygan Falls (EPA ordered a cleanup of about $41M in 2000). Sediment cleanup finished in 2012, and the AOC is in "monitored recovery." **The DNR and DHS still advise people not to eat resident fish and certain waterfowl from the lower 14 miles of the river.** EPA expects to remove PCB-contaminated soil at Rochester Park (former Tecumseh landfill) in 2026–2027. The Sheboygan, Sheboygan Falls and Kohler water system draws from **Lake Michigan**. The lakeshore strip of Sheboygan County is in **nonattainment for the 2015 ozone standard**, per ECHO. The status was remanded by a court and is being reviewed. Beaches like Deland Park are sampled weekly for E. coli. ECHO flags at least one beach closure in the last 2 years in this watershed.

### 1. Edgewater Generating Station (coal power plant; Alliant / Wisconsin Power & Light)
TRI ID 53082DGWTR3739L · 3739 Lakeshore Dr (on the Lake Michigan shoreline) · permits: CAA Title V, NPDES WI0001589, RCRA

**What it releases (on-site 61,731 lb; largest in Sheboygan)**

| Chemical | Air (lb) | Water (lb) | Off-site (lb) | Notes |
|---|---|---|---|---|
| Ammonia | 35,169 | 0 | — | From pollution-control equipment |
| Hydrogen fluoride | 25,189 | 0 | — | Acid gas from coal; strong respiratory irritant |
| Barium compounds | 1,160 | 77 | 6,139 | Coal ash constituent |
| Vanadium compounds | 69 | 2 | 300 | |
| Lead compounds | 44.6 | 0.9 | 1,364 | PBT |
| Mercury compounds | 6.3 | 0 | 13.4 | PBT |
| Polycyclic aromatic compounds | 5.5 | 0 | — | PBT, carcinogen |
| Dioxins | trace (g) | — | — | PBT, carcinogen |

**Plant status:** Unit 5 burns coal. Its retirement was planned for 2022, then 2025. In May 2024 Alliant announced a **conversion to natural gas in 2028**, pending regulatory approval, with gas pipeline work in the area due in 2027. Some residents and health groups oppose gas and favor alternatives like solar.

**Where it goes / what it touches**
- **Air:** the largest air releaser in Sheboygan. Hydrogen fluoride and ammonia reach the south side and lakeshore. Mercury (6.3 lb) and lead are PBTs that settle onto land and Lake Michigan. That makes the plant a **possible contributor** to Lake Michigan's mercury fish advisory, which comes mainly from regional and global deposition. NOx from coal burning also forms ozone, though TRI doesn't track NOx.
- **Water → Lake Michigan** via permit WI0001589 (outfall details to confirm in the permit). Small amounts of barium, lead and vanadium.
- **Off-site:** coal-ash-related metals sent to landfills (barium, lead).
- **People within 1 mile:** 4,691 residents. 16% low-income.
- **Schools within 1 mile:** Christ Child Academy, Early Learning Center, Sheboygan Christian School, South High, Wilson Elementary. 19 within 3 miles.

**Compliance:**
- **Water permit:** noncompliance in **10 of the last 12 quarters**.
  - **Real limit exceedances (4):** pH above 9.0 three times (10/2025 9.10, 11/2025 9.04, 06/2026 9.44) and total suspended solids 85.9 vs. 82 mg/L limit (08/2024).
  - **Everything else:** late or missing reports for iron, copper, arsenic, oil & grease, flow.
  - Toxicity-weighted water loads jumped from about 2 lb-eq (2023–24) to about 1,000–1,160 lb-eq (2025–26). Worth asking why.
- Air: no violations. 2 inspections, last 05/2025.
- No formal actions or penalties.

### 2. Hexion Inc. — Sheboygan Site (formaldehyde resins; ECHO lists it under former name Borden Chemical)
TRI ID 53081BRDNN2522S · 2522 S 24th St · parent: Hexion Holdings · permits: CAA Title V, RCRA, CERCLA ID, TSCA

**What it releases (on-site 28,575 lb, all air)**

| Chemical | Air (lb) | To sewer plant (lb) | Notes |
|---|---|---|---|
| Methanol | 19,609 (half fugitive) | 10,710 | VOC |
| Formaldehyde | 6,374 (83% fugitive) | 22,076 | Known human carcinogen (IARC), respiratory irritant |
| Triethylamine | 1,009 | 10 | Irritant |
| Phenol | 829 | 2,191 | Irritant, toxic |
| Ammonia | 754 | — | |

**Where it goes / what it touches**
- **Air:** fugitive (leak/vent) formaldehyde and methanol reach the south-side neighborhood. All of them are ozone precursors in an **ozone nonattainment area**, so the plant is a **possible contributor**.
- **Sewer → Sheboygan Regional Wastewater Treatment Facility → Lake Michigan** (route to verify). Formaldehyde, methanol and phenol biodegrade readily in treatment plants.
- **People within 1 mile:** 8,731 residents. 27% people of color, 28% low-income, 660 children under 5.
- **Schools within 1 mile: 6.** Christ Child Academy, Early Learning Center, Horace Mann Middle, James Madison Elementary, South High, Wilson Elementary. 27 within 3 miles.

**Compliance:**
- **EPA EPCRA §313 (TRI reporting) case**, settled 07/2022. $0 penalty, but **$204,225 in compliance-action costs**.
- Hazardous waste Notice of Noncompliance (state), 02/2025. The violations include air-emission standards for tanks/containers (RCRA 265.CC), generator, manifest and land-disposal issues.
- Air: no violations. Inspection 07/2025.

### 3. SACO AEI (polymer compounds; parent Aesse Investments)
TRI ID 53081NRTHW322CR · 3220 Crocker Ave · permits: general stormwater (WIG006072), TRI

**What it releases (on-site 13,579 lb, almost all stack air):** methanol 13,559 · maleic anhydride 10 (respiratory sensitizer) · antimony 5 and zinc 5 (to water) · lead 0.4. **To the sewer plant:** 5,675 lb methanol. **Off-site:** 1,441 lb antimony.

**What it touches**
- **Air:** methanol, an ozone precursor in the nonattainment area.
- **Water:** about 15 lb (antimony, zinc, maleic anhydride) to the Sheboygan River–Frontal Lake Michigan watershed. Inside the Sheboygan River AOC area, but these aren't the AOC's legacy contaminants (PCBs, PAHs).
- **People within 1 mile:** 3,952 residents. 30% low-income.
- **Schools within 1 mile:** Horace Mann Middle. 23 within 3 miles.

**Compliance:** EPA TSCA (toxic-substances reporting) case HQ-2019-5005, **$22,479 penalty**. No current violations. ECHO shows no air permit for this facility despite about 13,600 lb of stack methanol. **To verify with the DNR air permit search.**

### 4. Nemak USA — Gateway Plant (aluminum die-casting, automotive)
TRI ID 53081JLFRN4243G · 4243 Gateway Dr · permits: CAA Title V, RCRA

**What it releases (on-site 6,387 lb, all air):**
- Chlorine 5,840 (from aluminum melt treatment; respiratory irritant)
- Manganese 499 (neurotoxic when inhaled over long periods) · copper 35 · aluminum dust 8 · nickel 2.4 (carcinogen) · chromium 2 · lead 0.7 · dioxins (trace, sent off-site)
- **Off-site:** about 9,700 lb, mostly aluminum (8,870).

**What it touches**
- **Air:** the Gateway industrial park on the south/west side, near I-43.
- **People within 1 mile:** 2,402 residents. **38% low-income, 20% below poverty** (the highest poverty rate in Sheboygan).
- **Schools within 1 mile:** Jackson Elementary. 16 within 3 miles.

**Compliance:**
- **Clean Air Act High Priority Violation**, 05/2025 → resolved 05/2026. Noncompliance in 6 of the last 12 quarters.
- Federally reportable violations 06/2024 under the national air-toxics rules for aluminum (MACT), new-source standards (NSPS) and the Title V permit.
- State Notices of Violation 09/2024 and 07/2025, plus a warning letter. 3 air inspections, last 09/2026.
- No formal actions or penalties yet.
- Separately, OSHA fined Nemak $26,520 in 2019 over worker lung disease from metalworking-fluid mist (workplace, not environmental).

### 5. Plastics Engineering Co. — N 15th St Plant (phenolic resins / molding compounds)
TRI ID 53083PLSTC2732N · 2732 N 15th St · permits: CAA, RCRA

**What it releases (on-site 3,681 lb)**

| Chemical | Air (lb) | Water (lb) | To sewer plant (lb) | Notes |
|---|---|---|---|---|
| Phenol | 1,772 | 67 | 20,318 | Irritant |
| Styrene | 933 | 0 | — | Carcinogen flag |
| Methanol | 699 | 0 | 2,703 | VOC |
| Formaldehyde | 194 | 0 | 32,807 | Known carcinogen |
| Zinc compounds | 2.6 | 9 | 40 | |
| Aniline, o-cresol, ethylene glycol | small | — | — | |

**What it touches**
- **Air:** north-side residential area. VOCs are ozone precursors in the nonattainment area.
- **Water:** 76 lb (phenol, zinc) to local waters.
- **Sewer → Sheboygan wastewater plant → Lake Michigan** (route to verify). This is the largest formaldehyde transfer to a sewage plant among the 15 facilities.
- **People within 1 mile:** 11,949 residents, the most in Sheboygan. **38% people of color**, the highest in Sheboygan. 32% low-income.
- **Schools within 1 mile: 7.** Cooper Elementary, Etude Elementary, Jefferson Elementary, North High, Pigeon River Elementary, St. Paul Lutheran, Urban Middle. 24 within 3 miles.

**Compliance:** hazardous waste Notice of Noncompliance (state), 12/2023. 3 quarters in violation (generator, manifest, land-disposal, preparedness). No formal actions.

---

## Summary table

| City | Facility | On-site lb (2024) | Main medium | Key chemicals | Nearest waters | Schools ≤1 mi | Pop ≤1 mi | Compliance headline |
|---|---|---|---|---|---|---|---|---|
| Green Bay | Georgia-Pacific Broadway | 249,103 | **Water** | Nitrates, methanol, lead | Fox River (PCB/nutrient-impaired) | 2 | 6,548 | Water: 7 qtrs flagged, all late/missing reports |
| Green Bay | CNG Green Bay (Legacy Flexo) | 46,558 | Air | Ozone | — | 1 | 2,476 | No permits on file |
| Green Bay | GBP Coated Products | 23,968 | Air | Vinyl acetate | — | 1 | 2,979 | Air warning letter 2022 |
| Green Bay | Pioneer Metal Finishing | 14,477 | Air + sewer | Nitric acid; 207k lb nitrates to sewer | Fox River via NEW Water | 2 | 4,213 | **Hazardous-waste SNC, 12/12 qtrs** |
| Green Bay | Carboline Global | 9,060 | Air | Xylene, toluene, styrene | — | **10** | **13,778** | Air NOVs 2023 |
| Manitowoc | Manitowoc Public Utilities | 9,179 | Air | HCl, ammonia, lead | Manitowoc R. / L. Michigan | 5 | 8,471 | Clean |
| Manitowoc | Jagemann Plating | 5,535 | Air | Zinc, chromium (off-site) | L. Michigan | 5 | 10,458 | Hazardous-waste NON 2026 |
| Manitowoc | Eck Industries | 3,728 | Air | Perc, formaldehyde | L. Michigan | 4 | 3,747 | Hazardous-waste NON 2026 |
| Manitowoc | Wisconsin Aluminum Foundry | 739 | Air | Naphthalene, lead | L. Michigan | 5 | 11,175 | **CAA High Priority Violation 2024–25** |
| Manitowoc | Pentair Manitowoc Ice | 403 | Air | Ammonia | L. Michigan | 4 | 6,116 | Hazardous-waste NON 2024 |
| Sheboygan | Edgewater Generating Station | 61,731 | Air | Ammonia, HF, mercury, lead | L. Michigan (on shore) | 5 | 4,691 | Water: 4 exceedances + late reports |
| Sheboygan | Hexion | 28,575 | Air + sewer | Methanol, formaldehyde | L. Michigan via WWTP | 6 | 8,731 | EPCRA case 2022; hazardous-waste NON 2025 |
| Sheboygan | SACO AEI | 13,579 | Air | Methanol | Sheboygan R. AOC area | 1 | 3,952 | TSCA penalty $22,479 |
| Sheboygan | Nemak Gateway | 6,387 | Air | Chlorine, manganese | — | 1 | 2,402 | **CAA High Priority Violation 2025–26** |
| Sheboygan | Plastics Engineering | 3,681 | Air + sewer | Phenol, formaldehyde | L. Michigan via WWTP | **7** | **11,949** | Hazardous-waste NON 2023 |

Population figures are ACS 2024 estimates within 1 mile (from ECHO). Schools are NCES 2023–24, public plus private.

---

## Open items to verify before showing in the app

1. **Current fish advice wording.** Pull exact meal limits from the DNR's 2026–2028 *Choose Wisely* booklet / waterbody query for the Lower Fox River, the bay of Green Bay, the Sheboygan River (lower 14 mi), the Manitowoc River and Lake Michigan. Spec rule 2.5 requires official wording.
2. **Wastewater routes.** Confirm which treatment plant receives each facility's sewer transfers (NEW Water De Pere vs. Green Bay plant; Sheboygan Regional WWTF; Manitowoc WWTF) and where each discharges.
3. **Edgewater outfalls.** Confirm the receiving water for NPDES WI0001589, and the reason toxicity-weighted loads rose in 2025–26.
4. **Georgia-Pacific's reported loads drop** (87,000 → about 400 lb) in ECHO's discharge-report data. Is this a real change or a reporting gap?
5. **Manitowoc drinking-water source.** Confirm from MPU's annual Consumer Confidence Report.
6. **Air permits for CNG Green Bay and SACO AEI.** ECHO lists none. Check the DNR air permit search.
7. **Sheboygan County ozone status** after the court remand.
8. **Toxicity weighting.** Re-rank with RSEI. Low-pound PBT and carcinogen emitters (mercury, lead, nickel, perc, formaldehyde) may move up.

---

## Sources

**Data**
- EPA TRI Basic Data Files — https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present
- EPA ECHO Detailed Facility Report service — https://echo.epa.gov/ (raw JSON in `data/raw/echo/`)
- NCES EDGE school locations — https://nces.ed.gov/programs/edge/Geographic/SchoolLocations

**Green Bay / Fox River**
- Lower Green Bay/Fox River AOC (EPA) — https://epa.gov/great-lakes-aocs/lower-green-bayfox-river-aoc
- Five years after the PCB cleanup (news) — https://www.yahoo.com/news/five-years-world-largest-pcb-112126783.html
- WI DHS Fox River public health assessment — https://www.dhs.wisconsin.gov/environmental/foxriverpha.pdf
- DNR impaired water: Lower Fox River — https://apps.dnr.wi.gov/water/impairedDetail.aspx?key=357301
- Fort James / Georgia-Pacific natural-resource-damage agreement (USFWS) — https://www.fws.gov/story/2002-06/trustees-announce-natural-resources-damage-agreement-georgia-pacific-corp
- DOJ 2002 settlement release — https://www.justice.gov/archive/opa/pr/2002/June/02_enrd_362.htm
- Fox River cleanup cost settlement — https://rtspecialty.com/ecp/companies-agree-to-cover-all-costs-for-fox-river-cleanup/
- Fox River PRP list (Georgia-Pacific SEC filing) — https://www.sec.gov/Archives/edgar/data/41719/000119312514292893/R22.htm
- Green Bay phosphorus / dead zone (Circle of Blue) — https://circleofblue.org/cpx/great-lakes-algae/green-bay-moves-to-reduce-phosphorus-and-revive-dead-zone
- NEW Water adaptive management — https://nacwa.org/news-publications/news-detail/2023/04/24/new-water-uses-innovative-approach-to-reach-dnr-limits
- USGS Fox River phosphorus loading 1989–2021 — https://pubs.usgs.gov/publication/sir20235112/full
- Bay Beach history — https://wpr.org/green-bay-looking-reviving-historic-beach · https://news.uwgb.edu/?p=133132
- Green Bay Water Utility source — https://www.ashwaubenon.gov/government/departments/water-sewer-utility/water-quality-testing/
- DNR PFAS fish advice, Green Bay — https://dnr.wisconsin.gov/topic/PFAS/FishAdvisoryGreenBay.html
- 2026–2028 Choose Wisely booklet announcement — https://www.wispolitics.com/2026/dept-of-natural-resources-dept-of-health-services-issue-2026-2028-fish-consumption-booklet/
- Pioneer Metal Finishing violation tracker — https://violationtracker.goodjobsfirst.org/violation-tracker/wi-pioneer-metal-finishing-corp
- Pioneer Green Bay OSHA record — https://www.fastdol.com/employers/17d59675-4f2b-abd2-6373-8f65c581ba6a

**Manitowoc**
- DNR impaired water: Manitowoc River — https://apps.dnr.wi.gov/water/impairedDetail.aspx?key=482064
- DNR impaired water: South Branch Manitowoc River — https://apps.dnr.wi.gov/water/impairedDetail.aspx?key=9924
- DNR Kewaunee listing (Lake Michigan tributary advisory note) — https://apps.dnr.wi.gov/water/impairedDetail.aspx?key=482755
- MPU power plant brochure — https://www.mpu.org/wp-content/uploads/2023/11/powerplantopenhousebrochure.pdf
- MPU fuel mix — https://www.gridinfo.com/plant/manitowoc/4125
- MPU renewable pellet conversion (APPA) — https://www.publicpower.org/node/25270
- Eck Industries 2023 DNR permit hearing — https://dnr.wisconsin.gov/calendar/hearing/67571
- DNR 2025 ozone memo (Door/Manitowoc/Kenosha/Sheboygan) — https://dnr.wisconsin.gov/sites/default/files/topic/AirQuality/DoorManitKenoshaSheboyganResponse05012025.pdf
- EPA narrows ozone nonattainment counties (WPR) — https://wpr.org/epa-narrows-ozone-nonattainment-wisconsin-counties
- EPA Wisconsin ozone remand TSD — https://www.epa.gov/sites/production/files/2021-05/documents/wi_tsd_remand_final.pdf

**Sheboygan**
- DNR Sheboygan River AOC — https://dnr.wisconsin.gov/topic/greatlakes/sheboygan.html
- Cleanup work remains, Sheboygan River (WPR) — https://wpr.org/environment/after-decades-cleanup-work-remains-sheboygan-river
- EPA Rochester Park removal site — https://response.epa.gov/RochesterPark
- Edgewater conversion to gas in 2028 (WPR) — https://wpr.org/energy/alliant-energy-plans-to-convert-sheboygan-coal-plant-to-natural-gas-in-2028
- Alliant Edgewater fuel-switch release — https://s201.q4cdn.com/991130938/files/doc_news/2024/May/23/2024-5-23-nr-edgewater-fuel-switch.pdf
- Opposition to gas conversion (Spectrum News) — https://spectrumnews1.com/wi/milwaukee/news/2024/09/24/sheboygan-power-plant-natural-gas-opposition
- Nemak OSHA citation — https://biztimes.com/osha-fining-nemak-after-three-workers-diagnosed-with-lung-disease/
- Sheboygan water system (Lake Michigan) — https://www.sheboygancountyedc.com/market-info/utilities/water-and-sewer
- Sheboygan County public beaches — https://www.sheboygancounty.com/departments/departments-f-q/health-and-human-services/public-health/environmental-health/water-quality-drinking-water
- DNR Beach Health — https://apps.dnr.wi.gov/beachhealth/
