# Data Sources: Lakeshore Watch

This file lists where every piece of data in Lakeshore Watch comes from, how it was processed, and what is generated instead of measured.

All data was downloaded once during HackGB (October 2026). Statewide data lives in `background/raw/`, and everything about one city or company lives in `cities/<city>/<company>/`. The scripts in `background/` process it offline. The web app never calls a live service: it only reads the files the pipeline writes to `web/public/data/`.

---

## Step 1: Choosing the study facilities

| | |
|---|---|
| **Dataset** | EPA Toxics Release Inventory (TRI), Basic Data File, Wisconsin, reporting year 2024 |
| **Publisher** | U.S. Environmental Protection Agency |
| **Download** | `https://data.epa.gov/efservice/downloads/tri/mv_tri_basic_download/2024_WI/csv` |
| **About the data** | https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present |
| **Local file** | `background/raw/tri_2024_wi.csv` |
| **Script** | `background/select_facilities.py` (study cities come from `cities/<city>/city.json`) |
| **Output** | `cities/all_facilities.txt` and `cities/<city>/facilities.txt` |

**How it is used**
1. Keep the rows whose TRI `CITY` field is Green Bay, Manitowoc or Sheboygan.
2. Convert any releases reported in grams to pounds (÷ 453.592).
3. Add up each facility's releases across all chemicals:
   - on-site total
   - air (fugitive + stack)
   - water
   - land (on-site total − air − water)
   - total including off-site transfers
4. Rank facilities in each city by total **on-site** releases, in raw pounds. The ranking is not weighted by toxicity.
5. The top 10 per city form the shortlist, and the top 3 are the study facilities. The "Top chemicals" are the three largest on-site releases. The PBT and carcinogen flags come from TRI's own `PBT` and `CARCINOGEN` columns.

**Limitations**
- TRI numbers are self-reported by the facilities, and most releases are legal under permit. A release is not a violation.
- The ranking uses raw pounds. Once toxicity weights from EPA's RSEI model are applied, low-volume but highly toxic emitters (mercury, lead, formaldehyde) may rank higher.

---

## Step 2: Researching each facility

**Output:** a write-up for each of the 9 study facilities in `cities/<city>/<company>/research.md`, the city settings in `cities/<city>/README.md`, and the cross-city findings in `cities/README.md`. That overview's **Sources** section lists every web page cited (EPA, Wisconsin DNR, Wisconsin DHS, USGS, USFWS, DOJ, utility documents and news reports).

### Structured data used in the research

| What | Dataset / service | Local file(s) |
|---|---|---|
| Permits, inspections, violations, enforcement, nearby population and demographics | EPA ECHO Detailed Facility Report (one per facility): `https://echodata.epa.gov/echo/dfr_rest_services.get_dfr?output=JSON&p_id=<FRS ID>` | `cities/<city>/<company>/echo_facility_report.json` (9 files) |
| Water-discharge monitoring for Georgia-Pacific (permit WI0001848) and Edgewater (WI0001589) | EPA ECHO effluent charts: `https://echodata.epa.gov/echo/eff_rest_services.get_effluent_chart?p_id=<permit>` | `cities/green_bay/georgia_pacific_broadway/echo_effluent_WI0001848.json`, `cities/sheboygan/edgewater_generating_station/echo_effluent_WI0001589.json` |
| Schools within 1 and 3 miles of each facility | NCES EDGE geocoded school locations, 2023–24 (public: `EDGE_GEOCODE_PUBLICSCH_2324`; private: `EDGE_GEOCODE_PRIVATESCH_2324`) via `https://nces.ed.gov/opengis/rest/services/K12_School_Locations/` | `cities/<city>/<company>/schools_nearby.json` |

### Where specific research claims come from

- **River conditions** (impaired-water listings, Areas of Concern, the PCB cleanup history) come from Wisconsin DNR impaired-water pages and EPA Area of Concern pages, cited per city in the report.
- **Fish advice** comes from Wisconsin DNR and DHS fish consumption guidance, including the 2026–2028 *Choose Wisely* booklet.
- **Ozone status** comes from EPA and Wisconsin DNR ozone nonattainment documents.
- **Drinking-water sources** come from the utilities' own pages.
- **Population within 1 mile** (e.g. "6,548 residents" for Georgia-Pacific) comes from the demographic profile in the ECHO Detailed Facility Report. ECHO derives it from Census American Community Survey data.

The "Open items to verify" section of `cities/README.md` lists claims that still need checking against official sources.

---

## Step 3: The 3D map (basemap)

**Script:** `background/build_basemap.py`, with `background/fetch_terrain.py` for the elevation tiles.

**Output (`web/public/data/`):**
- `terrain.bin`: height grid
- `land.webp`: painted ground texture
- `water.png`: distance from shore, for the water shader
- `fade.png`: the 200-mile fog mask
- `scene.json`: everything else

| Map element | Dataset | Publisher | Download | Local file |
|---|---|---|---|---|
| Terrain / elevation | AWS Terrain Tiles, "terrarium" PNG encoding, zoom 7 (36 tiles) | Mapzen / AWS Open Data | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (registry: https://registry.opendata.aws/terrain-tiles/) | `background/raw/terrain/z7/*.png` |
| Wisconsin outline and county borders | Cartographic Boundary Files 2023, counties, 1:500k | U.S. Census Bureau | `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip` | `background/raw/geo/cb_2023_us_county_500k.zip` |
| Neighbouring states and their borders | Cartographic Boundary Files 2023, states, 1:5M | U.S. Census Bureau | `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_5m.zip` | `background/raw/geo/cb_2023_us_state_5m.zip` |
| City and town footprints (where buildings are drawn) | Cartographic Boundary Files 2023, Wisconsin places, 1:500k | U.S. Census Bureau | `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_55_place_500k.zip` | `background/raw/geo/cb_2023_55_place_500k.zip` |
| City populations (which towns appear; city card) | Vintage 2024 population estimates for cities and towns (`POPESTIMATE2024`) | U.S. Census Bureau | `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv` | `background/raw/places/sub-est2024.csv` |
| Great Lakes and inland lakes (Lake Winnebago etc.) | Natural Earth 1:10m lakes | Natural Earth (public domain) | `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson` | `background/raw/geo/ne_10m_lakes.geojson` |
| Rivers (Fox, Wisconsin, …) | Natural Earth 1:10m rivers and lake centerlines | Natural Earth | `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson` | `background/raw/geo/ne_10m_rivers.geojson` |
| Corn and wheat fields | Cropland Data Layer 2024 (satellite crop classification), fetched as a 2480 × 1880 image of Wisconsin (about 250 m per pixel) | USDA National Agricultural Statistics Service, via CropScape | `https://nassgeodata.gmu.edu/CropScapeService/wms_cdlall.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=cdl_2024&SRS=EPSG:4326&BBOX=-92.9,42.4,-86.7,47.1&WIDTH=2480&HEIGHT=1880&FORMAT=image/png` | `background/raw/crops/cdl_2024_wi.png` |
| Canada and other land outside the Census files | Natural Earth 1:50m land | Natural Earth | `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson` | `background/raw/geo/ne_50m_land.geojson` |

### How each element is processed

- **Projection:** all geometry is converted from longitude/latitude to kilometres on a local flat projection centred on the map (`background/frame.py`).
- **Elevation:** decoded with the terrarium formula `(R × 256 + G + B / 256) − 32768` metres, measured relative to Lake Michigan's surface (176 m). Heights are exaggerated 12× so the relief is visible.
- **Shoreline:** the coast follows the real Census and Natural Earth land outline. Near the water, the ground is reshaped so it meets the water surface exactly at the shoreline.
- **Detail is limited to Wisconsin:** lakes, rivers and terrain are drawn only inside Wisconsin. Neighbouring states are plain flat land that fades into fog 200 miles (322 km) from Wisconsin's border.
- **Which towns appear:** places with 60,000 or more people, plus the three study cities.
- **City names:** only Green Bay, Manitowoc and Sheboygan are labelled.
- **Crop fields:** the map is divided into 2.4 km tiles. A tile becomes a field where the Cropland Data Layer shows corn or wheat on at least 30% of it. Only tiles south of 44.75°N (the middle of Wisconsin) or in Door County qualify, and never in towns, water or steep ground. Of those, the quarter with the least corn and wheat is left out. A tile is drawn as wheat where wheat outweighs corn. In 2024 this gives about 7% of Wisconsin. Neighbouring tiles join into larger fields; the rows, the fences around each block of fields and the exact field edges are illustrative.

### Hand-entered locations

**Lighthouses:** the positions of 11 real Wisconsin Lake Michigan lighthouses are typed into `background/build_basemap.py` (`LIGHTHOUSES`) from general knowledge. They aren't taken from a dataset, so they are approximate:
- Kenosha Southport
- Wind Point
- Milwaukee Breakwater
- Sheboygan Breakwater
- Manitowoc Breakwater
- Rawley Point
- Kewaunee Pierhead
- Sturgeon Bay Ship Canal
- Cana Island
- Green Bay Harbor Entrance
- Pottawatomie

---

## Step 4: The factory buildings on the map

| | |
|---|---|
| **Data** | From TRI 2024 (Step 1): name, TRI ID, latitude/longitude, industry, on-site / air / water / land release totals and top chemicals. |
| **Where it lives** | `cities/<city>/<company>/facility.json`, copied from `cities/<city>/facilities.txt`. Every company folder that has a `model.json` is drawn on the map; `background/build_basemap.py` copies them into `scene.json` → `facilities`. |
| **Facilities shown so far** | The top 3 in each city. Green Bay: Georgia-Pacific Broadway, CNG Green Bay, Green Bay Packaging Coated Products. Manitowoc: Manitowoc Public Utilities, Jagemann Plating, Eck Industries. Sheboygan: Edgewater Generating Station, Hexion Sheboygan, SACO AEI. |

**What is real and what is stylised**
- The **location** is TRI's reported latitude/longitude. The building is then moved so its edge stays at least 0.5 km from the nearest river or lakeshore, and turned so its long side runs along the water. Factories that would overlap are spread apart (some real sites are under 1 km apart).
- The **building** is a stylised model (`cities/<city>/<company>/model.json`: a list of boxes, roofs, cylinders, stacks and cones), not the real footprint. The mill and power plants are drawn 1.7× real size and the smaller plants 1.3×, so they stand out from the city.
  - Each model is shaped after its industry: paper mill with wood-chip piles, power plants with coal piles, a printing plant with rooftop vents, a coating plant with adhesive silos, a plating shop with a fume scrubber, a foundry with furnace stacks and ingots, a resin plant with reactor towers, and a polymer plant with pellet silos.
  - The smoke, orange glow and wastewater ponds are illustrative.
- The **release numbers** in the city card and in the "What it affects" panel come directly from TRI 2024.

---

## Step 5: The "What it affects" panel

| | |
|---|---|
| **File** | `cities/<city>/<company>/impacts.json` |
| **Facilities covered** | All 9 mapped facilities (top 3 per city). Each panel's figures come from that company's `research.md`. |

| Panel content | Source |
|---|---|
| Badges: lb to water and lb to air | EPA TRI 2024 (`scene.json`) |
| Release figures in "How it affects" (e.g. Georgia-Pacific's 230,000 lb of nitrates, Hexion's 6,400 lb of formaldehyde) | EPA TRI 2024, as tabulated in each company's `research.md` |
| Residents and schools within 1 mile | EPA ECHO Detailed Facility Report demographics; NCES EDGE school locations |
| Local context: where releases go (e.g. Fox River, Lake Michigan, sewer plant), impaired waters, ozone nonattainment, fish advisories, permit records | Each company's `research.md` and its city's `README.md`, from Wisconsin DNR impaired-water listings, the EPA Lower Green Bay/Fox River AOC page and the ECHO permit record |
| General health and ecology explanations (e.g. nutrients feed algae that use up oxygen, ammonia irritates the eyes and throat) | Written for this app as plain-language summaries of well-established effects. Not quoted from a single source. |
| "How to avoid it" tips | Written for this app as general public-health and stewardship advice, e.g. follow the DNR fish advisory, check AirNow and DNR Beach Health, use lead-free tackle. They point people to official sources but are **not official guidance**. Confirm them against Wisconsin DNR / DHS wording before a public launch (see open item 1 in `cities/README.md`). |

---

## Step 6: Generated content (not data)

These are procedural decoration. They are generated with fixed random seeds, so they look the same on every visit, but they **do not represent real-world features**:

- Trees, rocks, logs, stumps, bushes, flowers and barns. Their density follows the terrain (forest in the north, farmland in the south), but every individual object is random. They stay out of the crop fields.
- City parks (a lawn, a pond and trees), about one per 40,000 people in each city. Their locations are random, not real parks.
- Houses and buildings inside city footprints. The real city boundaries decide where they go; the individual buildings are random.
- Boats and their routes on Lake Michigan.
- Clouds and birds, and the ring of cloud banks around the edge of the map (starting about 70 km outside Wisconsin).
- Field patches and colours on the ground texture.

---

## Reproducing the data

```bash
python3 -m venv .venv && .venv/bin/pip install pandas pyshp shapely numpy scipy pillow requests
cd background
../.venv/bin/python fetch_terrain.py       # elevation tiles → background/raw/terrain/z7/
../.venv/bin/python select_facilities.py   # TRI → cities/<city>/facilities.txt
../.venv/bin/python build_basemap.py       # everything → web/public/data/
```

`fetch_terrain.py` is the only script that downloads anything. The other raw files listed above were downloaded once from the URLs given and are committed in `background/raw/` and `cities/`.
