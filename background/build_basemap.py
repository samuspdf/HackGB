"""Build the 3D map: terrain, painted ground texture, and scene objects.

Inputs:
  background/raw/terrain/z7/*.png                 elevation tiles (fetch_terrain.py)
  background/raw/geo/cb_2023_us_county_500k.zip   Census counties (Wisconsin outline + counties)
  background/raw/geo/cb_2023_us_state_5m.zip      Census states (neighbors)
  background/raw/geo/cb_2023_55_place_500k.zip    Census places (city / town footprints)
  background/raw/places/sub-est2024.csv           Census population estimates 2024
  background/raw/geo/ne_50m_land.geojson          Natural Earth land (Canada)
  background/raw/geo/ne_10m_lakes.geojson         Natural Earth lakes
  background/raw/geo/ne_10m_rivers.geojson        Natural Earth rivers
  background/raw/crops/cdl_2024_wi.png            USDA Cropland Data Layer 2024 (where corn and wheat grow)
  cities/<city>/city.json                         study cities
  cities/<city>/<company>/                        facilities drawn on the map: facility.json, model.json, impacts.json
Outputs (web/public/data/):
  terrain.bin   Int16 heights (scene km x100, row 0 = north)
  land.webp     painted ground texture covering the frame (with baked hillshade)
  water.png     distance from shore for the water shader
  fade.png      fog mask: surroundings fade out 200 miles from Wisconsin (cloud banks ring the map's edge too)
  scene.json    places, counties, lakes, rivers, labels, study facilities and scattered objects
"""
import itertools
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import shapefile
import shapely
import shapely.ops
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box, shape
from shapely.ops import linemerge, unary_union
from shapely.prepared import prep

from frame import COS0, E_LON, FRAME_H, FRAME_W, KM_PER_DEG, LAT0, LON0, N_LAT, S_LAT, W_LON, km

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "background" / "raw"
GEO = RAW / "geo"
CITIES = ROOT / "cities"
OUT = ROOT / "web" / "public" / "data"

CELL_KM = 1.5            # terrain grid spacing
EXAG = 12.0              # vertical exaggeration (scene km per real km)
LAKE_LEVEL_M = 176.0     # Lake Michigan surface; scene height 0
SHORE_LIFT = 0.35        # land never sits closer than this to the water plane (prevents z-fighting)
TEX_PX = 4096            # ground texture width
GREAT_LAKES = {"Lake Michigan", "Lake Superior", "Lake Huron", "Whitefish Bay", "St. Marys River", "Lake Erie",
               "Georgian Bay", "Lake St. Clair", "North Channel"}
STUDY_CITIES = {(c := json.loads(f.read_text()))["name"]: c["county"] for f in sorted(CITIES.glob("*/city.json"))}
# Study facilities drawn as 3D buildings: every company folder with a model.json (data from EPA TRI 2024)
read = lambda f: json.loads(f.read_text()) if f.exists() else None
FACILITIES = [{**read(d / "facility.json"), "city": read(d.parent / "city.json")["name"], "model": read(d / "model.json"),
               **({"impacts": i} if (i := read(d / "impacts.json")) else {})}
              for d in sorted(m.parent for m in CITIES.glob("*/*/model.json"))]
SITE_SHORE_KM = 0.5      # gap between a factory's edge and a river or the lakeshore
SITE_CLEAR_KM = 0.4      # generic buildings stay this far beyond a factory's edge (trees: a little further)
half = lambda f, i: f["model"]["footprint"][i] * f["model"]["scale"] / 2   # half width (i=0) / depth (i=1), km
radius = lambda f: math.hypot(half(f, 0), half(f, 1))
rng = np.random.default_rng(7)


def read_shapes(zip_name, keep=lambda a: True):
    sf = shapefile.Reader(str(GEO / zip_name))
    fields = [f[0] for f in sf.fields[1:]]
    for rec, shp in zip(sf.records(), sf.shapes()):
        attrs = dict(zip(fields, rec))
        if keep(attrs):
            yield attrs, shape(shp.__geo_interface__)


def to_km_geom(geom):
    """lon/lat geometry -> km geometry."""
    return shapely.transform(geom, lambda c: np.column_stack([(c[:, 0] - LON0) * COS0 * KM_PER_DEG,
                                                             (c[:, 1] - LAT0) * KM_PER_DEG]))


flat = lambda coords: [round(v, 2) for xy in coords for v in xy]


def polys_out(geom, min_area=0.5):
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    return [[flat(p.exterior.coords)] + [flat(r.coords) for r in p.interiors if Polygon(r).area > min_area]
            for p in polys if not p.is_empty and p.area > min_area]


def lines_out(geom, step=1.2):
    parts = geom.geoms if hasattr(geom, "geoms") else [geom]
    return [flat(shapely.segmentize(ln, step).coords) for ln in parts if isinstance(ln, LineString) and len(ln.coords) > 1]


FRAME = box(W_LON, S_LAT, E_LON, N_LAT)

# ---------------------------------------------------------------- vectors (km)
counties = [(a["NAME"], a["GEOID"], to_km_geom(g.simplify(0.0012, preserve_topology=True)))
            for a, g in read_shapes("cb_2023_us_county_500k.zip", lambda a: a["STUSPS"] == "WI")]
wisconsin = unary_union([g for _, _, g in counties])
us_land = to_km_geom(unary_union([g for _, g in read_shapes("cb_2023_us_state_5m.zip")]).intersection(FRAME))
ne_land = to_km_geom(unary_union([shape(f["geometry"]) for f in json.load(open(GEO / "ne_50m_land.geojson"))["features"]]).intersection(FRAME))
lake_feats = [(f["properties"].get("name"), shape(f["geometry"])) for f in json.load(open(GEO / "ne_10m_lakes.geojson"))["features"]]
great_lakes = to_km_geom(unary_union([g for n, g in lake_feats if n in GREAT_LAKES]).intersection(FRAME))
# Canada (and anything Census doesn't cover) comes from Natural Earth land minus the Great Lakes
land = unary_union([us_land, wisconsin, ne_land.difference(us_land.buffer(2)).difference(great_lakes)])
# Only Wisconsin gets detail: inland lakes, rivers, terrain, towns and scenery. Other states stay plain.
inland = [(n, to_km_geom(g)) for n, g in lake_feats
          if n not in GREAT_LAKES and g.intersects(FRAME) and to_km_geom(g).area > 12
          and to_km_geom(g).representative_point().within(wisconsin)]
MIN_TOWN_POP = 60000     # towns below this are left out, except the study cities

# ---------------------------------------------------------------- elevation
tiles = sorted((RAW / "terrain" / "z7").glob("*.png"))
txs = sorted({int(p.stem.split("_")[0]) for p in tiles})
tys = sorted({int(p.stem.split("_")[1]) for p in tiles})
mosaic = np.zeros((len(tys) * 256, len(txs) * 256), dtype=np.float32)
for p in tiles:
    tx, ty = map(int, p.stem.split("_"))
    a = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
    mosaic[(ty - tys[0]) * 256:(ty - tys[0] + 1) * 256, (tx - txs[0]) * 256:(tx - txs[0] + 1) * 256] = \
        a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


def elevation_m(lon, lat):
    n = 2 ** 7 * 256
    px = (lon + 180) / 360 * n - txs[0] * 256
    py = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n - tys[0] * 256
    return ndimage.map_coordinates(mosaic, [py, px], order=1, mode="nearest")


cols = int(round(FRAME_W / CELL_KM)) + 1
rows = int(round(FRAME_H / CELL_KM)) + 1
gx = np.linspace(-FRAME_W / 2, FRAME_W / 2, cols)
gy = np.linspace(FRAME_H / 2, -FRAME_H / 2, rows)          # row 0 = north
X, Y = np.meshgrid(gx, gy)
LON = X / (COS0 * KM_PER_DEG) + LON0
LAT = Y / KM_PER_DEG + LAT0
elev = ndimage.gaussian_filter(elevation_m(LON.ravel(), LAT.ravel()).reshape(rows, cols), 0.7)

# Shoreline at texture resolution (~0.2 km). Its signed distance (km, positive on land) shapes the
# ground near the coast so it crosses the water plane exactly at the real shoreline: smooth coasts,
# and land and water never lie flat on top of each other (no flicker).
TW, TH = TEX_PX, int(round(TEX_PX * FRAME_H / FRAME_W))
PX_KM = FRAME_W / TW


to_px = lambda coords: [((x + FRAME_W / 2) / FRAME_W * TW, (FRAME_H / 2 - y) / FRAME_H * TH) for x, y in coords]


def mask_of(geom):
    img = Image.new("L", (TW, TH), 0)
    d = ImageDraw.Draw(img)
    for p in (geom.geoms if isinstance(geom, MultiPolygon) else [geom]):
        d.polygon(to_px(p.exterior.coords), fill=255)
        for r in p.interiors:
            d.polygon(to_px(r.coords), fill=0)
    return np.asarray(img) > 127


land_px = mask_of(land)
wi_px = mask_of(wisconsin)
sdf_px = (ndimage.distance_transform_edt(land_px) - ndimage.distance_transform_edt(~land_px)) * PX_KM
sdf = ndimage.map_coordinates(sdf_px, [(FRAME_H / 2 - Y) / FRAME_H * TH - 0.5, (X + FRAME_W / 2) / FRAME_W * TW - 0.5],
                              order=1, mode="nearest")
is_land = sdf > 0
is_wi = shapely.contains_xy(wisconsin, X, Y)
ground_h = np.maximum((elev - LAKE_LEVEL_M) * EXAG / 1000, SHORE_LIFT)
coast_ramp = sdf * 0.3                                   # 0.3 km of height per km from the shore
PLAIN_H = 0.5                                            # other states: flat land just above the water
ground_h = np.where(is_wi, ground_h, PLAIN_H)
height = np.where(
    is_land,
    coast_ramp + (ground_h - coast_ramp) * np.clip(sdf / 2.5, 0, 1) ** 2,     # blend into real terrain inland
    np.maximum(coast_ramp, -(0.6 + 2.4 * np.clip(-sdf / 40, 0, 1))),         # lakebed deepens offshore
)

# Inland lakes: flat water at their own level, lakebed carved below it
lakes_out = []
for _, g in inland:
    inside = shapely.contains_xy(g, X, Y) & is_land
    if inside.sum() < 3:
        continue
    level = float(np.median(ground_h[inside]))
    height[inside] = level - 0.45
    lakes_out.append({"level": round(level, 2), "rings": polys_out(g.simplify(0.4), 1)})

slope = np.hypot(*np.gradient(height, CELL_KM))

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "terrain.bin").write_bytes(np.round(height * 100).astype("<i2").tobytes())


def sample(grid, x, y):
    """Bilinear sample of a grid at km coordinates."""
    c = (np.asarray(x) + FRAME_W / 2) / CELL_KM
    r = (FRAME_H / 2 - np.asarray(y)) / CELL_KM
    return ndimage.map_coordinates(grid.astype(np.float32), [r, c], order=1, mode="nearest")


# ---------------------------------------------------------------- places (cities / towns)
pop = pd.read_csv(RAW / "places" / "sub-est2024.csv", encoding="latin-1", dtype=str)
pop = pop[(pop.STATE == "55") & (pop.SUMLEV == "162")]
pop = dict(zip("55" + pop.PLACE, pop.POPESTIMATE2024.astype(int)))
county_index = shapely.STRtree([g for _, _, g in counties])
places = []
for a, g in read_shapes("cb_2023_55_place_500k.zip"):
    p = pop.get(a["GEOID"])
    if not p or p < 300:
        continue
    gk = to_km_geom(g).intersection(land)
    if gk.is_empty:
        continue
    biggest = max(gk.geoms, key=lambda q: q.area) if isinstance(gk, MultiPolygon) else gk
    center = biggest.centroid if biggest.contains(biggest.centroid) else biggest.representative_point()
    hit = county_index.query(center, predicate="intersects")
    places.append({"name": a["NAME"], "pop": p, "geom": gk, "x": center.x, "y": center.y,
                   "county": counties[hit[0]][0] if len(hit) else ""})
places = sorted((p for p in places if p["pop"] >= MIN_TOWN_POP or p["name"] in STUDY_CITIES), key=lambda q: -q["pop"])

# ---------------------------------------------------------------- rivers (also keep buildings off them)
river_geom = unary_union([to_km_geom(shape(f["geometry"])) for f in json.load(open(GEO / "ne_10m_rivers.geojson"))["features"]
                          if f["properties"].get("scalerank", 9) <= 9]).intersection(wisconsin.buffer(-1.5))
rivers = lines_out(river_geom.simplify(0.3))

# Factory sites: nudged off the water (the real plants sit right on the bank), long side along the shore
shores = unary_union([river_geom, land.boundary])


def off_water(f, x, y):
    p = Point(x, y)
    near = shapely.ops.nearest_points(shores, p)[0]
    d = math.dist(p.coords[0], near.coords[0]) * (1 if land.contains(p) else -1) or 1.0   # negative: out in the lake
    ax, ay = (p.x - near.x) / d, (p.y - near.y) / d
    if d < (gap := half(f, 1) + SITE_SHORE_KM):
        p = Point(near.x + ax * gap, near.y + ay * gap)
    # rot turns the model so its local +z points away from the water (scene rotation.y)
    return {"x": p.x, "y": p.y, "rot": math.atan2(ax, -ay)}


sites = [{**f, **off_water(f, *km(f["lon"], f["lat"]))} for f in FACILITIES]
# Neighbouring factories (some are under 1 km apart) step aside until their footprints don't touch,
# without being pushed back into the water
for _ in range(50):
    for a, b in itertools.combinations(sites, 2):
        dx, dy = b["x"] - a["x"], b["y"] - a["y"]
        if (d := math.hypot(dx, dy) or 1e-3) < (need := radius(a) + radius(b) + 0.3):
            k = (need - d) / 2 / d
            a["x"], a["y"], b["x"], b["y"] = a["x"] - dx * k, a["y"] - dy * k, b["x"] + dx * k, b["y"] + dy * k
    for f in sites:
        f.update(off_water(f, f["x"], f["y"]))

no_build = prep(unary_union([river_geom.buffer(0.45)] + [g.buffer(0.2) for _, g in inland]
                            + [Point(f["x"], f["y"]).buffer(radius(f) + SITE_CLEAR_KM) for f in sites]))
# No scenery (trees, rocks, bushes, barns…) in or right beside lakes and rivers
wet = prep(unary_union([river_geom.buffer(0.8)] + [g.buffer(0.5) for _, g in inland]))

# ---------------------------------------------------------------- city parks: a lawn with a pond and trees
parks = []   # x, y, radius, pond x, pond y, pond radius
for pl in (q for q in places if q["pop"] >= 8000):
    for _ in range(1 + pl["pop"] // 40000):
        for _ in range(200):
            x, y = rng.uniform(*pl["geom"].bounds[0::2]), rng.uniform(*pl["geom"].bounds[1::2])
            r = rng.uniform(0.5, 0.85)
            if (pl["geom"].contains(Point(x, y)) and sample(sdf, [x], [y])[0] > r + 0.5 and not wet.contains(Point(x, y))
                    and all(math.dist((x, y), (f["x"], f["y"])) > radius(f) + r + 0.5 for f in sites)
                    and all(math.dist((x, y), q[:2]) > q[2] + r + 0.4 for q in parks)):
                a = rng.uniform(0, 2 * math.pi)
                parks.append([x, y, r, x + math.cos(a) * r * 0.4, y + math.sin(a) * r * 0.4, r * 0.32])
                break
park_zone = prep(unary_union([Point(q[0], q[1]).buffer(q[2] + 0.15) for q in parks]))

# ---------------------------------------------------------------- buildings
# kind: 0 = house (pitched roof), 1 = low block, 2 = tower
buildings = []


def grid_in(poly, spacing, jitter):
    minx, miny, maxx, maxy = poly.bounds
    xs, ys = np.meshgrid(np.arange(minx, maxx, spacing), np.arange(miny, maxy, spacing))
    xs = xs.ravel() + rng.uniform(-jitter, jitter, xs.size)
    ys = ys.ravel() + rng.uniform(-jitter, jitter, ys.size)
    keep = shapely.contains_xy(poly, xs, ys) & (sample(sdf, xs, ys) > 0.4)
    return [(x, y) for x, y in zip(xs[keep], ys[keep]) if not no_build.contains(Point(x, y)) and not park_zone.contains(Point(x, y))]


for pl in places:
    poly, p = pl["geom"], pl["pop"]
    cx, cy = pl["x"], pl["y"]
    if p >= 8000:
        core_r = 1.3 * math.sqrt(p / 40000) + 0.7
        peak = 0.9 + 1.3 * max(0.0, math.log10(p / 20000))
        for x, y in grid_in(poly, 0.72 if p >= 40000 else 0.78, 0.1):
            if rng.random() > 0.84:
                continue
            core = math.exp(-((math.hypot(x - cx, y - cy) / core_r) ** 2))
            if core > 0.45 and p >= 40000 and rng.random() < 0.55:
                kind, h, w = 2, 0.8 + peak * core * rng.uniform(0.6, 1.25), rng.uniform(0.4, 0.55)
            elif core > 0.12 or rng.random() < 0.18:
                kind, h, w = 1, rng.uniform(0.25, 0.55) + 0.5 * core, rng.uniform(0.38, 0.58)
            else:
                kind, h, w = 0, rng.uniform(0.18, 0.26), rng.uniform(0.3, 0.42)
            buildings.append([x, y, w, w * rng.uniform(0.75, 1.0), h, rng.uniform(-0.06, 0.06), kind])
    else:
        # Villages: a tidy cluster of houses on a spaced grid around the centre
        n = int(np.clip(p / 90, 5, 80))
        area = poly.union(Point(cx, cy).buffer(1.2))
        spots = sorted(grid_in(area, 0.55, 0.08), key=lambda q: math.hypot(q[0] - cx, q[1] - cy))[:n]
        for x, y in spots:
            central = math.hypot(x - cx, y - cy) < 0.6 and rng.random() < 0.35
            w = rng.uniform(0.36, 0.5) if central else rng.uniform(0.3, 0.4)
            h = rng.uniform(0.24, 0.4) if central else rng.uniform(0.18, 0.25)
            buildings.append([x, y, w, w * rng.uniform(0.75, 1.0), h, rng.uniform(-0.25, 0.25), int(central)])

# ---------------------------------------------------------------- scattered nature
built = prep(unary_union([pl["geom"].buffer(0.4) for pl in places if pl["pop"] >= 1500]
                         + [Point(pl["x"], pl["y"]).buffer(1.2) for pl in places]
                         + [Point(f["x"], f["y"]).buffer(radius(f) + SITE_CLEAR_KM + 0.8) for f in sites]))
north = np.clip((Y - (-140)) / 330, 0, 1)   # 0 in southern WI, 1 in the far north
corn_zone = prep(Point(9e9, 9e9).buffer(1))   # filled in once the corn fields exist


def scatter(count, density, min_gap, tries=60):
    """Rejection-sample points where `density` (grid in 0..1) allows, keeping a minimum gap."""
    out, grid = [], {}
    for _ in range(tries):
        if len(out) >= count:
            break
        cand_x = rng.uniform(-FRAME_W / 2, FRAME_W / 2, 20000)
        cand_y = rng.uniform(-FRAME_H / 2, FRAME_H / 2, 20000)
        ok = rng.random(cand_x.size) < sample(density, cand_x, cand_y)
        for x, y in zip(cand_x[ok], cand_y[ok]):
            if len(out) >= count:
                break
            key = (int(x // min_gap), int(y // min_gap))
            if any((q := grid.get((key[0] + i, key[1] + j))) and (x - q[0]) ** 2 + (y - q[1]) ** 2 < min_gap ** 2
                   for i in (-1, 0, 1) for j in (-1, 0, 1)):
                continue
            if built.contains(Point(x, y)) or wet.contains(Point(x, y)) or corn_zone.contains(Point(x, y)):
                continue
            grid[key] = (x, y)
            out.append((x, y))
    return out


land_ok = is_land & is_wi & (sdf >= 2.0) & (slope < 0.9)   # scenery only inside Wisconsin, off the beach

# Crop fields where the USDA Cropland Data Layer (2024) shows corn or wheat, only in Door County and the
# southern half of Wisconsin. Fields are tiles on one grid, so neighbouring tiles join into large fields.
# (x, y, length, width, rotation, kind: 0 corn, 1 wheat)
CDL_BBOX = (-92.9, 42.4, -86.7, 47.1)            # lon/lat window of cdl_2024_wi.png
CROP_TILE_KM = 2.4                               # one field tile
CROP_MIN_SHARE = 0.3                             # a tile becomes a field where corn + wheat cover this much of it
MID_WI_LAT = 44.75                               # fields only south of here (plus Door County)
cdl = np.asarray(Image.open(RAW / "crops" / "cdl_2024_wi.png").convert("RGB")).astype(int)
cdl_is = lambda *rgbs: np.any([np.all(cdl == c, axis=-1) for c in rgbs], axis=0).astype(np.float32)
CORN, WHEAT = (255, 212, 0), [(168, 112, 0), (216, 181, 107)]   # CDL class colours: corn; winter + spring wheat
cdl_px = (cdl.shape[1] / (CDL_BBOX[2] - CDL_BBOX[0]) * CROP_TILE_KM / (COS0 * KM_PER_DEG),
          cdl.shape[0] / (CDL_BBOX[3] - CDL_BBOX[1]) * CROP_TILE_KM / KM_PER_DEG)          # tile size in pixels
tile_mean = lambda m: ndimage.uniform_filter(m, size=(max(1, round(cdl_px[1])), max(1, round(cdl_px[0]))))
corn_share, wheat_share = tile_mean(cdl_is(CORN)), tile_mean(cdl_is(*WHEAT))
door = next(g for n, _, g in counties if n == "Door")
gxs, gys = np.meshgrid(np.arange(-FRAME_W / 2, FRAME_W / 2, CROP_TILE_KM), np.arange(-FRAME_H / 2, FRAME_H / 2, CROP_TILE_KM))
lon, lat = gxs / (COS0 * KM_PER_DEG) + LON0, gys / KM_PER_DEG + LAT0
px = (lon - CDL_BBOX[0]) / (CDL_BBOX[2] - CDL_BBOX[0]) * cdl.shape[1]
py = (CDL_BBOX[3] - lat) / (CDL_BBOX[3] - CDL_BBOX[1]) * cdl.shape[0]
c_share = ndimage.map_coordinates(corn_share, [py, px], order=1, cval=0)
w_share = ndimage.map_coordinates(wheat_share, [py, px], order=1, cval=0)
keep = ((c_share + w_share >= CROP_MIN_SHARE) & ((lat < MID_WI_LAT) | shapely.contains_xy(door, gxs, gys))
        & shapely.contains_xy(wisconsin, gxs, gys) & (sample(sdf, gxs, gys) > 1.5) & (sample(slope, gxs, gys) < 0.4))
corn = [[x, y, CROP_TILE_KM - 0.1, CROP_TILE_KM - 0.1, 0, int(ws > cs), cs + ws]
        for x, y, cs, ws in zip(gxs[keep], gys[keep], c_share[keep], w_share[keep])
        if not built.contains(Point(x, y)) and not wet.contains(Point(x, y))]
CROP_DROP = 0.25                                 # leave out the quarter of tiles with the least corn + wheat
corn = [c[:6] for c in sorted(corn, key=lambda c: -c[6])[:round(len(corn) * (1 - CROP_DROP))]]
corn_area = sum(c[2] * c[3] for c in corn)
corn_poly = lambda c: box(c[0] - c[2] / 2, c[1] - c[3] / 2, c[0] + c[2] / 2, c[1] + c[3] / 2)
crop_land = unary_union([corn_poly(c).buffer(0.1, join_style="mitre") for c in corn])
corn_zone = prep(crop_land.buffer(0.5))   # no trees, bushes or rocks in or right beside a field
fence_line = crop_land.buffer(0.08, join_style="mitre").boundary   # one fence around each block of fields
forest = (0.05 + 0.95 * north ** 1.4) * land_ok
trees = [[x, y, round(rng.uniform(0.75, 1.3), 2), int(rng.random() < 0.17)]
         for x, y in scatter(9000, forest, 2.3)]
# Park trees ring each lawn, clear of its pond
for x, y, r, px, py, pr in parks:
    for _ in range(int(rng.integers(5, 9))):
        a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.3, 0.8) * r
        if math.dist((x + math.cos(a) * d, y + math.sin(a) * d), (px, py)) > pr + 0.15:
            trees.append([x + math.cos(a) * d, y + math.sin(a) * d, round(rng.uniform(0.55, 0.85), 2), int(rng.random() < 0.3)])

rocky = np.clip(slope * 1.6 + np.clip((height - 2.6) / 2.5, 0, 1), 0, 1) * is_land * is_wi
rock_sites = scatter(650, rocky ** 1.5 + 0.004 * land_ok, 4.0)
rocks = []
for x, y in rock_sites:
    for _ in range(int(rng.integers(2, 5))):
        rx, ry = x + rng.normal(0, 0.45), y + rng.normal(0, 0.45)
        if not wet.contains(Point(rx, ry)):   # clustered rocks must stay out of the water too
            rocks.append([rx, ry, round(rng.uniform(0.35, 0.9), 2), round(rng.uniform(0, 6.28), 2)])
# Small stones along Wisconsin's beaches
for x, y in scatter(500, (is_land & is_wi & (sdf > 0.25) & (sdf < 1.8)).astype(np.float32), 1.5):
    rocks.append([x, y, round(rng.uniform(0.2, 0.45), 2), round(rng.uniform(0, 6.28), 2)])

woods = forest * (forest > 0.35)
logs = [[x, y, round(rng.uniform(0, 6.28), 2), round(rng.uniform(0.8, 1.4), 2)] for x, y in scatter(420, woods, 5)]
stumps = [[x, y, round(rng.uniform(0.7, 1.2), 2)] for x, y in scatter(320, woods, 5)]
meadow = land_ok * (0.25 + 0.6 * (1 - north))
bushes = [[x, y, round(rng.uniform(0.6, 1.3), 2)] for x, y in scatter(2600, meadow, 2.2)]
flowers = [[x, y, int(rng.integers(0, 4))] for x, y in scatter(900, meadow * is_wi * (1 - north), 2.5)]
farmland = land_ok * is_wi * np.clip(1 - north * 1.6, 0, 1) * (slope < 0.35)
barns = [[x, y, round(rng.uniform(-0.25, 0.25), 2)] for x, y in scatter(300, farmland, 7)]

# ---------------------------------------------------------------- painted ground texture
ty_km = np.linspace(FRAME_H / 2, -FRAME_H / 2, TH)[:, None]
north_px = np.clip((ty_km - (-140)) / 330, 0, 1)


mix = lambda a, b, t: a + (b - a) * t[..., None]


rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
# Neighbors: muted olive in the north, warm wheat in the south; Wisconsin: forest → farmland
other = np.broadcast_to(rgb("#d6c99f"), (TH, TW, 3))     # other states: one plain, muted colour
wi =mix(np.broadcast_to(rgb("#c3d572"), (TH, TW, 3)), np.broadcast_to(rgb("#4f8d48"), (TH, TW, 3)), np.broadcast_to(north_px ** 0.8, (TH, TW)))
tex = np.where(wi_px[..., None], wi, other)

# Field patches in southern Wisconsin (and lighter ones next door)
fields = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
fd = ImageDraw.Draw(fields)
palette = ["#e9d47c", "#b7d064", "#d8c96e", "#9fc25a", "#ecd890", "#c9d978"]
for _ in range(16000):
    x, y = rng.uniform(0, TW), rng.uniform(TH * 0.35, TH)
    s = (y / TH - 0.35) / 0.65
    w, h = rng.uniform(5, 16), rng.uniform(4, 11)
    a = rng.uniform(-0.15, 0.15) - 0.05
    pts = [(x + dx * math.cos(a) - dy * math.sin(a), y + dx * math.sin(a) + dy * math.cos(a))
           for dx, dy in ((0, 0), (w, 0), (w, h), (0, h))]
    col = palette[int(rng.integers(0, len(palette)))]
    fd.polygon(pts, fill=col + format(int(60 + 120 * s), "02x"))
for c in corn:   # corn fields: warm gold-green under the 3D rows
    fd.polygon(to_px(corn_poly(c).exterior.coords), fill="#c8c25ae6")
fa = np.asarray(fields, dtype=np.float32)
alpha = fa[..., 3:] / 255 * wi_px[..., None]
tex = tex * (1 - alpha) + fa[..., :3] * alpha

# Rocky slopes and high ground turn lavender-grey; beaches are sand
up = lambda g: np.asarray(Image.fromarray(g.astype(np.float32)).resize((TW, TH), Image.BILINEAR))
rock_t = np.clip(up(slope) * 1.6 - 0.35, 0, 0.7) + np.clip((up(height) - 4.6) / 2, 0, 0.3)
tex = mix(tex, np.broadcast_to(rgb("#b4a597"), tex.shape), np.clip(rock_t, 0, 0.8) * wi_px)
shore_d = np.clip(sdf_px, 0, None) / PX_KM                  # pixels inland from the shore
beach = np.clip(1 - (shore_d - 1) / 5, 0, 1) * wi_px
tex = mix(tex, np.broadcast_to(rgb("#efd9a7"), tex.shape), beach)

# Baked hillshade so relief reads even when looking straight down (sun from the north-west)
gy_, gx_ = np.gradient(ndimage.gaussian_filter(height, 0.8), CELL_KM)
normal = np.dstack([-gx_, gy_, np.ones_like(height)])     # x east, y north, z up
normal /= np.linalg.norm(normal, axis=2, keepdims=True)
light = np.array([-0.55, 0.45, 0.7]) / np.linalg.norm([-0.55, 0.45, 0.7])
shade = up(np.clip(normal @ light, 0, 1) / light[2])        # 1.0 on flat ground
tex *= (1 + 0.55 * (shade - 1) * wi_px)[..., None]
tex = np.where(land_px[..., None], tex, rgb("#5b86cf"))
Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).filter(ImageFilter.SMOOTH).save(OUT / "land.webp", quality=88, method=6)

# High-resolution distance-from-shore for the water shader (0 at the shore, 255 at 40 km out)
water_px_d = np.clip(-sdf_px, 0, None)
Image.fromarray(np.clip(water_px_d / 40 * 255, 0, 255).astype(np.uint8)).resize((TW // 2, TH // 2), Image.BILINEAR).save(OUT / "water.png", optimize=True)

# Only show the surroundings out to 200 miles from Wisconsin; beyond that the map fades into fog.
# fade.png: 0 = fully shown, 255 = fully fogged
REACH_KM = 322                       # 200 miles
FADE_KM = 70                         # width of the soft edge
wi_dist = ndimage.distance_transform_edt(~wi_px) * PX_KM
fade = np.clip((wi_dist - (REACH_KM - FADE_KM)) / FADE_KM, 0, 1)
fade = fade * fade * (3 - 2 * fade)  # smoothstep
Image.fromarray((fade * 255).astype(np.uint8)).resize((TW // 4, TH // 4), Image.BILINEAR).save(OUT / "fade.png", optimize=True)

# Cloud banks fixed around the edge of the map: they start this far outside Wisconsin and thicken outward
EDGE_CLOUD_KM = (70, 220)
EDGE_CLOUD_AMOUNT = 0.7   # share of the full cloud bank to draw (1 = a solid wall)
cgx, cgy = np.meshgrid(np.arange(-FRAME_W / 2, FRAME_W / 2, 22.0), np.arange(-FRAME_H / 2, FRAME_H / 2, 22.0))
cgx, cgy = cgx + rng.uniform(-9, 9, cgx.shape), cgy + rng.uniform(-9, 9, cgy.shape)
c_out = ndimage.map_coordinates(wi_dist, [(FRAME_H / 2 - cgy) / FRAME_H * TH, (cgx + FRAME_W / 2) / FRAME_W * TW], order=1, mode="nearest")
c_t = np.clip((c_out - EDGE_CLOUD_KM[0]) / (EDGE_CLOUD_KM[1] - EDGE_CLOUD_KM[0]), 0, 1)
c_keep = (c_out > EDGE_CLOUD_KM[0]) & (rng.random(cgx.shape) < (0.35 + 0.65 * c_t) * EDGE_CLOUD_AMOUNT)
edge_clouds = [[x, y, (14 + 34 * t + rng.uniform(0, 10)) * (0.5 + 0.5 * EDGE_CLOUD_AMOUNT)]
               for x, y, t in zip(cgx[c_keep], cgy[c_keep], c_t[c_keep])]

# ---------------------------------------------------------------- borders (land only — never along the coast)
county_lines = unary_union([g.boundary for _, _, g in counties]).intersection(wisconsin.buffer(-0.8))
others = [to_km_geom(g) for _, g in read_shapes("cb_2023_us_state_5m.zip", lambda a: a["STUSPS"] != "WI")]
state_line = wisconsin.boundary.intersection(unary_union(others).intersection(to_km_geom(FRAME)).buffer(1.0))
# Borders between the other states, plus the US–Canada land border (coastlines excluded)
other_lines = unary_union([g.boundary for g in others] + [us_land.boundary]).intersection(land.buffer(-0.8)).difference(wisconsin.buffer(0.6))
# Neighbouring states share each border, so the union is chopped at every vertex: merge it back into
# continuous runs, then drop slivers where the coastline datasets disagree
other_lines = linemerge([ln for ln in getattr(other_lines, "geoms", [other_lines]) if isinstance(ln, LineString)])
other_lines = unary_union([ln for ln in getattr(other_lines, "geoms", [other_lines]) if ln.length > 4])
other_lines = other_lines.intersection(wisconsin.buffer(REACH_KM - FADE_KM / 2))   # stop inside the fog edge

# ---------------------------------------------------------------- lighthouses (real Wisconsin Lake Michigan lights)
LIGHTHOUSES = [
    ("Kenosha Southport Light", 42.5893, -87.8122),
    ("Wind Point Light", 42.7808, -87.7586),
    ("Milwaukee Breakwater Light", 43.0270, -87.8826),
    ("Sheboygan Breakwater Light", 43.7493, -87.6936),
    ("Manitowoc Breakwater Light", 44.0927, -87.6438),
    ("Rawley Point Light", 44.2115, -87.5093),
    ("Kewaunee Pierhead Light", 44.4570, -87.4937),
    ("Sturgeon Bay Ship Canal Light", 44.7953, -87.3125),
    ("Cana Island Light", 45.0880, -87.0469),
    ("Green Bay Harbor Entrance Light", 44.6537, -87.9017),
    ("Pottawatomie Light", 45.4271, -86.8285),
]
lighthouses = [dict(zip("xy", km(lon, lat))) for _, lat, lon in LIGHTHOUSES]

# ---------------------------------------------------------------- boats: back-and-forth routes in open Lake Michigan
michigan = to_km_geom(unary_union([g for n, g in lake_feats if n == "Lake Michigan"])).intersection(to_km_geom(FRAME))
open_water = prep(michigan.buffer(-5))
boats = []
while len(boats) < 32:
    x, y = rng.uniform(*michigan.bounds[0::2]), rng.uniform(*michigan.bounds[1::2])
    if not open_water.contains(Point(x, y)):
        continue
    ang = rng.uniform(0, math.pi)
    dx, dy = math.cos(ang), math.sin(ang)
    ends = []
    for s in (1, -1):
        d = 0.0
        while d < 90 and open_water.contains(Point(x + s * dx * (d + 1), y + s * dy * (d + 1))):
            d += 1
        ends.append((x + s * dx * d, y + s * dy * d))
    if math.dist(*ends) < 25:
        continue
    kind = 1 if len(boats) % 3 == 0 else 0   # 1 = freighter, 0 = sailboat
    boats.append([*ends[0], *ends[1], kind, round(rng.uniform(0, 1), 2)])

# ---------------------------------------------------------------- labels, scene.json
r2 = lambda v: round(float(v), 2)
lbl = lambda text, lon, lat, kind: {"text": text, "kind": kind, **dict(zip("xy", km(lon, lat)))}
scene = {
    "frame": {"width": FRAME_W, "height": FRAME_H},
    "terrain": {"cols": cols, "rows": rows, "cell": CELL_KM, "file": "terrain.bin",
                "texture": "land.webp", "water": "water.png", "fade": "fade.png"},
    "wisconsin": polys_out(wisconsin.simplify(0.3), 2),
    "counties": [{"name": n, "rings": polys_out(g.simplify(0.25), 0.5),
                  "label": dict(zip("xy", map(r2, g.representative_point().coords[0])))} for n, _, g in sorted(counties)],
    "borders": {"county": lines_out(county_lines.simplify(0.25)), "state": lines_out(state_line.simplify(0.25)),
                "other": lines_out(other_lines.simplify(0.3), 2.0)},
    "facilities": [{k: (r2(v) if k in ("x", "y", "rot") else v) for k, v in f.items() if k not in ("lon", "lat")}
                   for f in sites],
    "lighthouses": lighthouses,
    "boats": [v for b in boats for v in map(r2, b)],
    "lakes": lakes_out,
    "rivers": rivers,
    "places": [{"name": p["name"], "pop": p["pop"], "county": p["county"], "x": r2(p["x"]), "y": r2(p["y"]),
                "study": p["name"] in STUDY_CITIES} for p in places],
    "labels": [
        lbl("Lake Michigan", -86.9, 43.2, "water"), lbl("Lake Superior", -88.6, 47.55, "water"),
        lbl("Green Bay", -87.86, 44.98, "bay"), lbl("Wisconsin", -89.9, 44.9, "state"),
        lbl("Michigan", -85.6, 43.6, "neighbor"), lbl("Minnesota", -93.6, 45.6, "neighbor"),
        lbl("Iowa", -92.8, 42.1, "neighbor"), lbl("Illinois", -89.4, 42.05, "neighbor"),
    ],
    "trees": [v for t in trees for v in (r2(t[0]), r2(t[1]), t[2], t[3])],
    "rocks": [v for t in rocks for v in map(r2, t)],
    "logs": [v for t in logs for v in map(r2, t)],
    "stumps": [v for t in stumps for v in map(r2, t)],
    "bushes": [v for t in bushes for v in map(r2, t)],
    "flowers": [v for t in flowers for v in (r2(t[0]), r2(t[1]), t[2])],
    "barns": [v for t in barns for v in map(r2, t)],
    "corn": [v for c in corn for v in (*map(r2, c[:5]), c[5])],
    "fences": lines_out(fence_line, 0.4),
    "edgeClouds": [v for c in edge_clouds for v in map(r2, c)],
    "parks": [v for q in parks for v in map(r2, q)],
    "buildings": [v for b in buildings for v in (*map(r2, b[:6]), b[6])],
    "source": "Elevation: AWS Terrain Tiles · US Census Bureau boundaries & 2024 population estimates · Natural Earth",
}
(OUT / "scene.json").write_text(json.dumps(scene, separators=(",", ":")))
size = lambda f: f"{(OUT / f).stat().st_size / 1024:.0f} KB"
print(f"terrain {cols}x{rows} ({size('terrain.bin')}), texture {TW}x{TH} ({size('land.webp')}), scene {size('scene.json')}")
print(f"{len(edge_clouds)} edge cloud banks, {len(fence_line.geoms) if hasattr(fence_line, 'geoms') else 1} fences, {len(corn)} field tiles ({corn_area / wisconsin.area:.1%} of Wisconsin, {sum(c[5] for c in corn)} wheat), {len(parks)} parks, {len(boats)} boats")
print(f"{len(places)} places, {len(buildings)} buildings, {len(trees)} trees, {len(rocks)} rocks, {len(logs)} logs, "
      f"{len(stumps)} stumps, {len(bushes)} bushes, {len(flowers)} flowers, {len(barns)} barns, {len(lakes_out)} lakes, {len(rivers)} rivers")
print(f"height range {height.min():.2f}..{height.max():.2f} km (scene)")
