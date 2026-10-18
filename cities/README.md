# Facility Research — Overview

Each city's setting is in `cities/<city>/README.md`, and each facility's write-up is in `cities/<city>/<company>/research.md`.

Gunk Radar · HackGB 2026 · compiled 2026-10-17

**What this covers:** for each of the 12 study facilities (top 3 per city by on-site releases, in Green Bay, Manitowoc, Sheboygan and Milwaukee), what it releases, where those releases go, and what they come in contact with locally.

**Data used**

| Source | What it gave us | Data date |
|---|---|---|
| EPA TRI Basic Data File, WI | Chemicals, pounds by medium (air / water / land), off-site transfers | Reporting year 2024 |
| EPA ECHO Detailed Facility Reports (`cities/<city>/<company>/echo_facility_report.json`) | Permits, inspections, violations, enforcement, receiving waters, impaired waters, ozone status, 1-mile demographics (ACS) | Pulled 2026-10-17 (compliance through 09/2026) |
| EPA ECHO effluent charts | Which water-permit limits were exceeded vs. reports filed late | 07/2023 – 10/2026 |
| NCES EDGE school locations (`cities/<city>/<company>/schools_nearby.json`) | Public + private schools within 1 and 3 miles | 2023–24 school year |
| Web research (sources at bottom) | Legacy contamination, fish advice, beaches, drinking water, plant status | See each source |

**How to read this (spec Section 2 rules)**
- **Releases ≠ violations.** "Releases" are what the facility reported to TRI, almost always legal under its permits. "Compliance record" is a separate section.
- **Pounds ≠ harm.** Amounts are raw pounds. Toxicity weighting (RSEI) has not been applied yet.
- **No causation claims.** Where a facility releases something that also appears in a local impairment or advisory, it's marked **possible contributor**. Where the local problem comes mainly from legacy or distant sources, that's stated.
- **Late reports vs. exceedances.** In ECHO, many Clean Water Act "violations" are late or missing monitoring reports, not measured pollution above a limit. Each is labeled.

---

## Cross-cutting findings

1. **Almost everything goes to air.** 11 of the 12 facilities release mainly to air. **Georgia-Pacific (Green Bay)** is the only one with large direct water releases (about 230,000 lb of nitrates plus about 57 lb of lead compounds to the Fox River). It's the clearest facility for the river → fish → beach demo.
2. **A lot goes to the sewer, not the river.** Several facilities send large amounts to the municipal sewage plant (POTW) rather than discharging directly:
   - Hexion and SACO AEI: together about 22,100 lb of formaldehyde, 16,400 lb of methanol and 2,200 lb of phenol to Sheboygan's treatment plant
   - Jagemann Plating: about 1,600 lb of nitrates plus zinc and chromium to Manitowoc's treatment plant
   - Advanced Plating Technologies: about 29,100 lb of nitrates plus small amounts of nickel, copper, lead and cyanide to MMSD (Milwaukee)

   These get treated there before discharge. The app should show "sent to wastewater plant → treated → discharged to [water]" as its own pathway.
3. **The fish advisories here are mostly legacy problems.**
   - **Lower Fox River / Green Bay:** PCBs from decades of carbonless-copy-paper manufacturing and recycling. Cleanup finished in 2020–2022, and the DNR expects advisories to take 20–30 years to lift.
   - **Sheboygan River:** PCBs, largely from the former Tecumseh Products plant. The lower 14 miles still carry "do not eat resident fish" advice.
   - **Lake Michigan mercury:** largely from atmospheric deposition, often from distant sources.

   - **Milwaukee Estuary:** legacy PCBs, PAHs and metals in the Milwaukee, Menomonee and Kinnickinnic rivers. A roughly $450 million sediment cleanup is under way, with delisting targeted for 2031.

   None of the 12 facilities reported PCB releases in 2024.
4. **Ozone ties together all the VOC emitters.** The lakeshore portions of Sheboygan and Manitowoc counties are in nonattainment or maintenance areas for the 2015 ozone standard, and all of Milwaukee County is in nonattainment (reclassified "serious" in 2025, on hold in court). Methanol, formaldehyde, vinyl acetate and glycol ethers are ozone-forming VOCs. That makes these facilities **possible contributors** to local ozone. The DNR notes that lakeshore ozone is also heavily driven by pollution carried in from the Chicago and Milwaukee areas.
5. **Compliance stories worth showing (separate from releases):**
   - **Georgia-Pacific** and **Edgewater:** water permits flagged for many quarters, mostly for late or missing monitoring reports.
   - **Hexion:** a 2022 EPA settlement over TRI *reporting* (the right-to-know law, EPCRA §313).
   - **SACO AEI:** a $22,479 EPA penalty under the toxic-substances law (TSCA).
   - **Highline Warren (Milwaukee):** a state hazardous-waste Notice of Noncompliance, 01/2026.
6. **Schools are close by everywhere.** Every facility has at least 1 school within 1 mile. Hexion has 6, and in Milwaukee, Seidel Tanning has 12 and Advanced Plating Technologies has 20, the most on the map. In Manitowoc, Manitowoc Public Utilities and Jagemann Plating share the same nearby schools (Jefferson Elementary, Washington Middle, Roncalli Middle).
7. **Drinking water comes from Lake Michigan, not the rivers.**
   - Green Bay: Lake Michigan intake offshore near Kewaunee, about 30 miles from the Green Bay facilities.
   - Sheboygan: Lake Michigan.
   - Manitowoc: likely Lake Michigan. Not yet confirmed from MPU's water quality report.
   - Milwaukee: Lake Michigan, through deep intakes more than a mile offshore (Linnwood and Howard Avenue plants).

   Following the spec, exact intake locations are not mapped.

---

## Summary table

| City | Facility | On-site lb (2024) | Main medium | Key chemicals | Nearest waters | Schools ≤1 mi | Pop ≤1 mi | Compliance headline |
|---|---|---|---|---|---|---|---|---|
| Green Bay | Georgia-Pacific Broadway | 249,103 | **Water** | Nitrates, methanol, lead | Fox River (PCB/nutrient-impaired) | 2 | 6,548 | Water: 7 qtrs flagged, all late/missing reports |
| Green Bay | CNG Green Bay (Legacy Flexo) | 46,558 | Air | Ozone | — | 1 | 2,476 | No permits on file |
| Green Bay | GBP Coated Products | 23,968 | Air | Vinyl acetate | — | 1 | 2,979 | Air warning letter 2022 |
| Manitowoc | Manitowoc Public Utilities | 9,179 | Air | HCl, ammonia, lead | Manitowoc R. / L. Michigan | 5 | 8,471 | Clean |
| Manitowoc | Jagemann Plating | 5,535 | Air | Zinc, chromium (off-site) | L. Michigan | 5 | 10,458 | Hazardous-waste NON 2026 |
| Manitowoc | Eck Industries | 3,728 | Air | Perc, formaldehyde | L. Michigan | 4 | 3,747 | Hazardous-waste NON 2026 |
| Sheboygan | Edgewater Generating Station | 61,731 | Air | Ammonia, HF, mercury, lead | L. Michigan (on shore) | 5 | 4,691 | Water: 4 exceedances + late reports |
| Sheboygan | Hexion | 28,575 | Air + sewer | Methanol, formaldehyde | L. Michigan via WWTP | 6 | 8,731 | EPCRA case 2022; hazardous-waste NON 2025 |
| Sheboygan | SACO AEI | 13,579 | Air | Methanol | Sheboygan R. AOC area | 1 | 3,952 | TSCA penalty $22,479 |
| Milwaukee | Seidel Tanning | 32,573 | Air | Glycol ethers, formic acid (+56,500 lb chromium off-site) | Milwaukee R. (0.1 mi) | 12 | 38,177 | Clean |
| Milwaukee | Highline Warren | 12,974 | Air | Methanol | — | 5 | 10,985 | Hazardous-waste NON 2026 |
| Milwaukee | Advanced Plating Technologies | 10,213 | Air + sewer | 1-Bromopropane, nitric acid (+29,100 lb nitrates to sewer) | Milwaukee R. (0.2 mi) | 20 | 32,562 | Clean |

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
8. **Milwaukee sewer route.** Confirm whether MMSD's Jones Island or South Shore plant receives the Seidel and Advanced Plating sewer flows.
9. **Highline Warren's product.** Confirm the Milwaukee site blends windshield washer fluid (likely, from the parent company and the methanol).
10. **1-Bromopropane rule.** Check whether EPA's 2024 proposed TSCA restrictions have been finalized.
11. **Toxicity weighting.** Re-rank with RSEI. Low-pound PBT and carcinogen emitters (mercury, lead, nickel, perc, formaldehyde) may move up.

---

## Sources

**Data**
- EPA TRI Basic Data Files — https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present
- EPA ECHO Detailed Facility Report service — https://echo.epa.gov/ (raw JSON in each `cities/<city>/<company>/` folder)
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
- Sheboygan water system (Lake Michigan) — https://www.sheboygancountyedc.com/market-info/utilities/water-and-sewer
- Sheboygan County public beaches — https://www.sheboygancounty.com/departments/departments-f-q/health-and-human-services/public-health/environmental-health/water-quality-drinking-water
- DNR Beach Health — https://apps.dnr.wi.gov/beachhealth/

**Milwaukee**
- Seidel Tanning history (Stitchdown) — https://www.stitchdown.com/brand-profiles/seidel-tanning-interview
- Seidel Tanning address and history (Patina Project) — https://www.patinaproject.com/seidel
- Highline Aftermarket + Warren Distribution merger — https://www.aftermarketnews.com/highline-aftermarket-to-become-highline-warren-after-acquisition/
- About Advanced Plating Technologies — https://advancedplatingtech.com/about-advanced-plating-technologies-milwaukee/
- EPA adds 1-bromopropane to the hazardous air pollutant list (AIHA) — https://www.aiha.org/news/220113-epa-adds-1-bromopropane-to-list-of-hazardous-air-pollutants
- EPA 1-BP listing fact sheet — https://www.epa.gov/system/files/documents/2021-12/fact-sheet-1-bp-listing-action-12-22-21.pdf
- EPA proposed 1-BP risk management rule (Federal Register, Aug 8 2024) — https://www.govinfo.gov/content/pkg/FR-2024-08-08/html/2024-17204.htm
- Milwaukee Estuary $450M cleanup (EPA via Urban Milwaukee) — https://urbanmilwaukee.com/pressrelease/biden-harris-administration-announces-largest-ever-clean-up-under-epas-great-lakes-restoration-initiative-to-address-milwaukee-area-of-concern/
- Milwaukee Estuary AOC cleanup agreement (Urban Milwaukee) — https://urbanmilwaukee.com/pressrelease/dnr-epa-sign-agreement-to-proceed-on-milwaukee-estuary-cleanup-to-eliminate-32-year-old-area-of-concern-designation/
- PCB fish advisories, Milwaukee and Menomonee rivers (USGS) — https://pubs.usgs.gov/sir/2007/5084/page16.html
- DNR impaired water: Kinnickinnic River — https://apps.dnr.wi.gov/water/impairedDetail.aspx?key=9973
- Southeast Wisconsin ozone reclassified "serious" (BizTimes) — https://biztimes.com/epa-slaps-serious-nonattainment-air-pollution-zone-classification-on-southeast-wisconsin
- Court pauses the reclassification (BizTimes) — https://biztimes.com/court-ruling-pauses-epas-stricter-air-rules-for-southeastern-wisconsin/
- DNR nonattainment permitting — https://dnr.wisconsin.gov/topic/AirPermits/Nonattainment.html
- Milwaukee Water Works treatment — https://city.milwaukee.gov/water/about/WaterTreatment
- MMSD facilities — https://mmsd.com/about-us/facilities
- MMSD combined discharge permit notice (DNR) — https://dnr.wisconsin.gov/sites/default/files/topic/Wastewater/pn/MilwaukeeMetroSewDistrictCombined-PN.pdf
- Milwaukee beach advisories — https://city.milwaukee.gov/Recreational-Water/Beach-Advisories.htm
- Bradford Beach E. coli effort (Urban Milwaukee) — https://urbanmilwaukee.com/2025/02/27/mke-county-effort-aims-to-reduce-e-coli-closures-at-bradford-beach/
- August 2025 Bradford / McKinley closure (Milwaukee Health Department) — https://city.milwaukee.gov/health/news/2025-news-releases1/august/2025/public-notice-bradford-beach--mckinley-beach-closure-extended
- River distances: USGS National Hydrography Dataset — https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer
