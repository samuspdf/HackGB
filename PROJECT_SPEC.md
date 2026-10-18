# Project Spec: Gunk Radar

HackGB 2026 — Environment Track
Builder: Sam (CS major, Math minor, ML focus) — solo
Time limit: ~24 hours (hackathon already in progress)

> **Instructions for Claude Code:** Read this whole file before writing code. Build in the phase order below. Phase 1 must produce a working demo before anything in later phases is started. When this spec says "verify," check that the endpoint or dataset actually works before building on it, and tell Sam if it doesn't. Ask Sam before making major architecture changes.

---

## 1. The idea in one paragraph

An interactive web app, built around a map of Wisconsin's Lake Michigan shoreline, that shows industrial pollution from facilities in **four cities: Green Bay, Manitowoc, Sheboygan and Milwaukee** (Milwaukee added after the first three). Clicking a facility shows what it releases, where those releases go (air, water, land), and **what they come in contact with**: fish people eat, beaches people swim at, drinking water sources, wildlife, nearby neighborhoods and schools, and groundwater. Each facility panel ends with **actions** people can take (file a complaint with the right agency, comment on permits, follow a facility). Machine learning estimates contamination risk where official testing does not exist.

**User flow:**
1. Home page: map of Wisconsin, zoomed to the lakeshore, facilities shown as circles sized by **toxicity-weighted** releases.
2. Click a facility: side panel with what it releases, where it goes, what it touches, and what you can do.
3. Toggle layers: fish advisories, impaired waters, beaches, downstream flow paths, ML risk estimates.

---

## 2. Scientific integrity rules (non-negotiable)

These rules exist because the judges and users may know the area. Breaking them makes the app wrong, not just imperfect.

1. **Never claim a facility causes a specific harm.** Use language like "releases a chemical that is also listed in this waterbody's fish advisory — possible contributor." Never "this factory poisoned these fish."
2. **Legacy pollution is real.** Much fish contamination in this region (e.g., PCBs in the Fox River / Green Bay) comes from decades-old discharges now in sediments. Mercury in fish is largely from atmospheric deposition, often from distant sources. The UI must say when an advisory is likely due to other or historical sources.
3. **Pounds are not harm.** Size and color facilities by toxicity-weighted values (EPA RSEI scores or a toxicity weight per chemical), not raw pounds. If toxicity weights are unavailable for a chemical, show it but mark it "unweighted."
4. **Releases are not violations.** Most reported releases are legal under the facility's permit. Show "reported releases" and "permit violations" as separate, clearly labeled things.
5. **Official advice comes from officials.** Fish-eating advice, beach status, and drinking-water info are shown exactly as published by Wisconsin DNR / EPA / local agencies, with a link to the source. ML estimates are never presented as official advice.
6. **ML estimates are visually distinct.** Estimated values use a different style (hatched, faded, or dashed outline) and a label: "Estimated — not tested."
7. **Show data year and source** on every panel.

---

## 3. What pollution touches: the exposure pathways

The release medium (reported in TRI) determines what it can reach. This mapping drives the facility panel.

| Release medium | What it can come in contact with | Data to show |
|---|---|---|
| **Water** (direct discharge, or via a wastewater plant) | Fish (edibility), aquatic life, beaches/swimming, downstream drinking water sources, river/lake sediments, fish-eating wildlife (eagles, herons, gulls, otters) | Fish consumption advisories, impaired waters list, beach advisories, downstream trace |
| **Air** (stack and fugitive emissions) | Nearby residents, schools, daycares, parks; deposition onto land and water downwind | Population and schools within a radius (e.g., 1 and 3 miles); note that air pollution spreads by wind direction |
| **Land** (landfills, land application, surface impoundments) | Soil, groundwater, private wells, runoff to streams | Note groundwater/private-well relevance; link to well-testing info |
| **Underground injection** | Deep groundwater | Show amount; note it is generally regulated to isolate it from drinking water |

Science notes to display in plain language:
- **"Harms fish" ≠ "unsafe to eat fish."** Nutrients, heat, and low oxygen harm fish health. Persistent chemicals (mercury, PCBs, PFAS, dioxins) build up in fish tissue over years and make fish unsafe to eat (bioaccumulation). They also concentrate up the food chain (biomagnification), which is why fish-eating birds and mammals are affected.
- **Fish move.** A contaminated fish may have picked up contamination elsewhere.

---

## 4. Data sources

**Verify each one early (Phase 0).** URLs below are starting points and may have changed.

| Data | Source | Use |
|---|---|---|
| Facility releases by chemical and medium, with coordinates | EPA Toxics Release Inventory (TRI): Basic Data Files (CSV, yearly) or Envirofacts API (`https://data.epa.gov/efservice/`) | Core facility layer |
| Toxicity weights | EPA RSEI (Risk-Screening Environmental Indicators) | Toxicity-weighted sizing |
| Discharge permits, inspections, violations | EPA ECHO (Enforcement and Compliance History Online) web services | Violations, permit info, receiving waters |
| Fish consumption advisories | Wisconsin DNR fish consumption advisory data | Fish layer |
| Impaired waters (303(d) list) | Wisconsin DNR impaired waters list | Water-quality layer |
| Downstream flow paths | USGS NLDI (Network-Linked Data Index) API, `https://labs.waterdata.usgs.gov/api/nldi/` | Trace where discharges flow |
| Rivers, lakes, watersheds | USGS National Hydrography Dataset / Watershed Boundary Dataset | Base hydrography |
| Beaches | Wisconsin beach monitoring program data | Beach layer |
| Population, demographics | US Census (block groups) | People near facilities |
| Schools | NCES school locations or state data | Sensitive receptors near facilities |
| Wisconsin boundary, city boundaries | US Census TIGER/Line | Base map |

**Caution on drinking water intakes:** exact intake locations are often withheld for security reasons. Show drinking water at the city/utility level ("Sheboygan's water comes from Lake Michigan"), verified from the utility's public reports. Do not try to find or publish exact intake coordinates.

**Fallback rule:** if a dataset can't be accessed within ~30 minutes, skip it, note it in the README, and move on.

---

## 5. Architecture

Keep it simple and demo-proof: **no live backend required.**

```
background/            Wisconsin-wide map (Python, run offline)
  raw/                 statewide raw data (terrain, Census, Natural Earth, TRI)
  build_basemap.py     → web/public/data/ (terrain, textures, scene.json)
cities/                everything needed to make each city
  <city>/city.json, README.md, facilities.txt
  <city>/<company>/    facility.json, model.json, impacts.json, research.md, raw ECHO + school data
web/                   static site (Next.js + three.js), reads web/public/data/
```

- **Python:** pandas, geopandas, requests, scikit-learn.
- **Map:** MapLibre GL JS or Leaflet (pick whichever gets a working map fastest; Leaflet is simpler).
- **Hosting:** static (GitHub Pages, Netlify, or just open locally).
- All heavy processing happens offline; the browser only loads precomputed files.

**Geographic scope:** facilities within each of the study cities plus a buffer (e.g., 10 km), or within the counties: Brown (Green Bay), Manitowoc, Sheboygan, Milwaukee. Show the full state outline for context.

---

## 6. Build phases

**Time budget (solo, ~24 hours).** Phases 0–2 are the core demo; Phases 3–4 are strong additions; Phase 5 only if time remains. Reserve the last ~2 hours for demo prep and fixes.

| Phase | Target hours |
|---|---|
| 0 — Verify data | 0–1 |
| 1 — MVP map | 1–5 |
| 2 — What it touches | 5–11 |
| 3 — ML component | 11–17 |
| 4 — Action features | 17–20 |
| 5 — Polish | 20–22 |
| Demo prep | 22–24 |

If a phase runs more than ~2 hours over, cut its remaining scope rather than delaying the next phase.

### Phase 0 — Verify data (first hour)
- Confirm TRI data downloads for Wisconsin and filter to the three counties. Report how many facilities there are.
- Confirm ECHO, DNR fish advisory, and NLDI access. Report what works.

### Phase 1 — MVP map (must work before anything else)
- Wisconsin map zoomed to the lakeshore.
- Facility circles sized by toxicity-weighted total releases (raw pounds as a fallback, clearly labeled).
- Click facility → panel: name, industry, top chemicals released, amounts by medium (air/water/land), data year, source link.
- Legend explaining the circle size.

### Phase 2 — "What it touches" panel
- For water releases: receiving waterbody, downstream trace on the map (NLDI), fish advisories and impaired-water status for that waterbody, nearby beaches.
- "Possible contributor" flag when the facility releases the same contaminant listed in a downstream advisory or impairment; otherwise say the advisory is likely due to other or historical sources.
- For air releases: population and schools within 1 and 3 miles.
- For land releases: groundwater/private well note with a well-testing link.
- Fish-eating wildlife note where persistent, bioaccumulative chemicals are involved.

### Phase 3 — ML component
**Goal:** estimate contamination risk for waterbodies the DNR hasn't tested.

- **Labels:** waterbodies with fish advisories (and the contaminant), from DNR data.
- **Features per waterbody:** upstream facility releases (toxicity-weighted, by chemical class), number of upstream facilities, upstream land use (cropland, urban), watershed size, waterbody type (river, inland lake, Great Lakes bay), distance to legacy contaminated sites if available.
- **Model:** start with logistic regression as a baseline, then gradient boosting (scikit-learn `HistGradientBoostingClassifier`). Keep it interpretable; show top feature contributions in the panel.
- **Validation:** spatial cross-validation (hold out whole watersheds or regions, not random rows) so the model can't memorize neighbors. Report the metric honestly, even if modest.
- **Scope:** train on all Wisconsin waterbodies with data (more labels), then display estimates around the study cities.
- **Display:** untested waterbodies get an "Estimated risk — not tested" style. Never show estimates as official advice.
- **Known limitation to state in the pitch:** labels are sparse and advisories reflect legacy contamination and atmospheric mercury that facility features can't capture. The model is a screening tool for "where should someone test next."

### Phase 4 — Action features
In each facility panel, a "What you can do" section:
1. **File a complaint:** button links to the official Wisconsin DNR / EPA environmental violation reporting pages, with facility name and permit number shown for the user to copy. (Do not auto-submit anything. Link only.)
2. **Permit comment info:** show the facility's permit and explain that renewal includes a public comment period; link to where Wisconsin DNR posts public notices.
3. **Follow a facility:** stretch goal; can be a mock UI for the demo, clearly labeled.
4. **Protect yourself:** links to official fish advisory, beach status, and well-testing resources.

Wording rule: complaints are for suspected **violations**; permit comments and contacting representatives are for "the legal limit seems too high."

### Phase 5 — Polish (only if time remains)
- Apply Sam's art style.
- Layer toggles, search by city, mobile layout.
- About page: data sources, methods, limitations.

---

## 7. Demo script (3 minutes)

1. Open the map: "Here's industrial pollution along Wisconsin's Lake Michigan shore, sized by toxicity, not just pounds."
2. Click a facility on a river: show releases → trace downstream → fish advisory → beaches.
3. Show the honest link: "possible contributor" vs. legacy pollution.
4. Toggle the ML layer: "These waters were never tested; our model flags where testing should happen next."
5. Show the action section: "Here's how any resident can act."

---

## 8. Open items for Sam
- Art style: TBD, Sam will provide.
- Project name: Gunk Radar (decided).
- Team size and time limit: solo, ~24 hours (decided). Scope follows the time budget in Section 6.
- Hackathon has started; all code is written during the event.
