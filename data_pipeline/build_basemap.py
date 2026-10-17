"""Build the 3D map: terrain, painted ground texture, and scene objects.

Inputs:
  data/raw/terrain/z7/*.png                 elevation tiles (fetch_terrain.py)
  data/raw/geo/cb_2023_us_county_500k.zip   Census counties (Wisconsin outline + counties)
  data/raw/geo/cb_2023_us_state_5m.zip      Census states (neighbors)
  data/raw/geo/cb_2023_55_place_500k.zip    Census places (city / town footprints)
  data/raw/places/sub-est2024.csv           Census population estimates 2024
  data/raw/geo/ne_50m_land.geojson          Natural Earth land (Canada)
  data/raw/geo/ne_10m_lakes.geojson         Natural Earth lakes
  data/raw/geo/ne_10m_rivers.geojson        Natural Earth rivers
Outputs (web/public/data/):
  terrain.bin   Int16 heights (scene km x100, row 0 = north)
  land.webp     painted ground texture covering the frame (with baked hillshade)
  water.png     distance from shore for the water shader
  scene.json    places, counties, lakes, rivers, labels and scattered objects
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import shapefile
import shapely
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon, box, shape
from shapely.ops import unary_union
from shapely.prepared import prep

from frame import COS0, E_LON, FRAME_H, FRAME_W, KM_PER_DEG, LAT0, LON0, N_LAT, S_LAT, W_LON, km

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
GEO = RAW / "geo"
OUT = ROOT / "web" / "public" / "data"

CELL_KM = 1.5            # terrain grid spacing
EXAG = 12.0              # vertical exaggeration (scene km per real km)
LAKE_LEVEL_M = 176.0     # Lake Michigan surface; scene height 0
SHORE_LIFT = 0.35        # land never sits closer than this to the water plane (prevents z-fighting)
TEX_PX = 4096            # ground texture width
GREAT_LAKES = {"Lake Michigan", "Lake Superior", "Lake Huron", "Whitefish Bay", "St. Marys River", "Lake Erie",
               "Georgian Bay", "Lake St. Clair", "North Channel"}
STUDY_CITIES = {"Green Bay": "Brown", "Manitowoc": "Manitowoc", "Sheboygan": "Sheboygan"}
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


def flat(coords):
    return [round(v, 2) for xy in coords for v in xy]


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
inland = [(n, to_km_geom(g)) for n, g in lake_feats
          if n not in GREAT_LAKES and g.intersects(FRAME) and to_km_geom(g).area > 12]

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


def to_px(coords):
    return [((x + FRAME_W / 2) / FRAME_W * TW, (FRAME_H / 2 - y) / FRAME_H * TH) for x, y in coords]


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
height = np.where(
    is_land,
    coast_ramp + (ground_h - coast_ramp) * np.clip(sdf / 2.5, 0, 1) ** 2,     # blend into real terrain inland
    np.maximum(coast_ramp, -(0.6 + 2.4 * np.clip(-sdf / 40, 0, 1))),         # lakebed deepens offshore
)

# Inland lakes: flat water at their own level, lakebed carved below it
lakes_out = []
for name, g in inland:
    inside = shapely.contains_xy(g, X, Y) & is_land
    if inside.sum() < 3:
        continue
    level = float(np.median(ground_h[inside]))
    height[inside] = level - 0.45
    lakes_out.append({"name": name, "level": round(level, 2), "rings": polys_out(g.simplify(0.4), 1)})

slope = np.hypot(*np.gradient(height, CELL_KM))
region = np.where(~is_land, 0, np.where(sdf < 2.0, 3, np.where(is_wi, 1, 2))).astype(np.uint8)

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
places.sort(key=lambda q: -q["pop"])

# ---------------------------------------------------------------- rivers (also keep buildings off them)
river_geom = unary_union([to_km_geom(shape(f["geometry"])) for f in json.load(open(GEO / "ne_10m_rivers.geojson"))["features"]
                          if f["properties"].get("scalerank", 9) <= 9]).intersection(land.buffer(-1.5))
rivers = lines_out(river_geom.simplify(0.3))
no_build = prep(unary_union([river_geom.buffer(0.45)] + [g.buffer(0.2) for _, g in inland]))

# ---------------------------------------------------------------- buildings
# kind: 0 = house (pitched roof), 1 = low block, 2 = tower
buildings = []


def grid_in(poly, spacing, jitter):
    minx, miny, maxx, maxy = poly.bounds
    xs, ys = np.meshgrid(np.arange(minx, maxx, spacing), np.arange(miny, maxy, spacing))
    xs = xs.ravel() + rng.uniform(-jitter, jitter, xs.size)
    ys = ys.ravel() + rng.uniform(-jitter, jitter, ys.size)
    keep = shapely.contains_xy(poly, xs, ys) & (sample(sdf, xs, ys) > 0.4)
    return [(x, y) for x, y in zip(xs[keep], ys[keep]) if not no_build.contains(Point(x, y))]


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
                         + [Point(pl["x"], pl["y"]).buffer(1.2) for pl in places]))
north = np.clip((Y - (-140)) / 330, 0, 1)   # 0 in southern WI, 1 in the far north


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
            if built.contains(Point(x, y)):
                continue
            grid[key] = (x, y)
            out.append((x, y))
    return out


land_ok = is_land & (region != 3) & (slope < 0.9)
forest = np.where(is_wi, 0.05 + 0.95 * north ** 1.4, 0.03 + 0.55 * north ** 2.2) * land_ok
trees = [[x, y, round(rng.uniform(0.75, 1.3), 2), int(rng.random() < 0.17)]
         for x, y in scatter(12000, forest, 2.3)]

rocky = np.clip(slope * 1.6 + np.clip((height - 2.6) / 2.5, 0, 1), 0, 1) * is_land
rock_sites = scatter(420, rocky ** 1.5 + 0.004 * land_ok, 4.0)
rocks = []
for x, y in rock_sites:
    for _ in range(int(rng.integers(2, 5))):
        rocks.append([x + rng.normal(0, 0.45), y + rng.normal(0, 0.45), round(rng.uniform(0.35, 0.9), 2), round(rng.uniform(0, 6.28), 2)])

woods = forest * (forest > 0.35)
logs = [[x, y, round(rng.uniform(0, 6.28), 2), round(rng.uniform(0.8, 1.4), 2)] for x, y in scatter(420, woods, 5)]
stumps = [[x, y, round(rng.uniform(0.7, 1.2), 2)] for x, y in scatter(320, woods, 5)]
meadow = land_ok * np.where(is_wi, 0.25 + 0.6 * (1 - north), 0.08)
bushes = [[x, y, round(rng.uniform(0.6, 1.3), 2)] for x, y in scatter(2600, meadow, 2.2)]
flowers = [[x, y, int(rng.integers(0, 4))] for x, y in scatter(900, meadow * is_wi * (1 - north), 2.5)]
farmland = land_ok * is_wi * np.clip(1 - north * 1.6, 0, 1) * (slope < 0.35)
barns = [[x, y, round(rng.uniform(-0.25, 0.25), 2)] for x, y in scatter(300, farmland, 7)]

# ---------------------------------------------------------------- painted ground texture
ty_km = np.linspace(FRAME_H / 2, -FRAME_H / 2, TH)[:, None]
north_px = np.clip((ty_km - (-140)) / 330, 0, 1)


def mix(a, b, t):
    return a + (b - a) * t[..., None]


rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
# Neighbors: muted olive in the north, warm wheat in the south; Wisconsin: forest → farmland
other = mix(np.broadcast_to(rgb("#d8c48c"), (TH, TW, 3)), np.broadcast_to(rgb("#a9b979"), (TH, TW, 3)), np.broadcast_to(north_px, (TH, TW)))
wi = mix(np.broadcast_to(rgb("#c3d572"), (TH, TW, 3)), np.broadcast_to(rgb("#4f8d48"), (TH, TW, 3)), np.broadcast_to(north_px ** 0.8, (TH, TW)))
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
fa = np.asarray(fields, dtype=np.float32)
alpha = fa[..., 3:] / 255 * np.where(wi_px, 1.0, 0.45)[..., None]
tex = tex * (1 - alpha) + fa[..., :3] * alpha

# Rocky slopes and high ground turn lavender-grey; beaches are sand
up = lambda g: np.asarray(Image.fromarray(g.astype(np.float32)).resize((TW, TH), Image.BILINEAR))
rock_t = np.clip(up(slope) * 1.6 - 0.35, 0, 0.7) + np.clip((up(height) - 4.6) / 2, 0, 0.3)
tex = mix(tex, np.broadcast_to(rgb("#b4a597"), tex.shape), np.clip(rock_t, 0, 0.8))
shore_d = np.clip(sdf_px, 0, None) / PX_KM                  # pixels inland from the shore
beach = np.clip(1 - (shore_d - 1) / 5, 0, 1) * land_px
tex = mix(tex, np.broadcast_to(rgb("#efd9a7"), tex.shape), beach)

# Baked hillshade so relief reads even when looking straight down (sun from the north-west)
gy_, gx_ = np.gradient(ndimage.gaussian_filter(height, 0.8), CELL_KM)
normal = np.dstack([-gx_, gy_, np.ones_like(height)])     # x east, y north, z up
normal /= np.linalg.norm(normal, axis=2, keepdims=True)
light = np.array([-0.55, 0.45, 0.7]) / np.linalg.norm([-0.55, 0.45, 0.7])
shade = up(np.clip(normal @ light, 0, 1) / light[2])        # 1.0 on flat ground
tex *= (1 + 0.55 * (shade - 1))[..., None]
tex = np.where(land_px[..., None], tex, rgb("#5b86cf"))
Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).filter(ImageFilter.SMOOTH).save(OUT / "land.webp", quality=88, method=6)

# High-resolution distance-from-shore for the water shader (0 at the shore, 255 at 40 km out)
water_px_d = np.clip(-sdf_px, 0, None)
Image.fromarray(np.clip(water_px_d / 40 * 255, 0, 255).astype(np.uint8)).resize((TW // 2, TH // 2), Image.BILINEAR).save(OUT / "water.png", optimize=True)

# ---------------------------------------------------------------- borders (land only — never along the coast)
county_lines = unary_union([g.boundary for _, _, g in counties]).intersection(wisconsin.buffer(-0.8))
other_states = to_km_geom(unary_union([g for _, g in read_shapes("cb_2023_us_state_5m.zip", lambda a: a["STUSPS"] != "WI")]).intersection(FRAME))
state_line = wisconsin.boundary.intersection(other_states.buffer(1.0))

# ---------------------------------------------------------------- labels, scene.json
r2 = lambda v: round(float(v), 2)
lbl = lambda text, lon, lat, kind: {"text": text, "kind": kind, **dict(zip("xy", km(lon, lat)))}
scene = {
    "frame": {"width": FRAME_W, "height": FRAME_H},
    "terrain": {"cols": cols, "rows": rows, "cell": CELL_KM, "exaggeration": EXAG, "file": "terrain.bin",
                "texture": "land.webp", "water": "water.png"},
    "wisconsin": polys_out(wisconsin.simplify(0.3), 2),
    "counties": [{"name": n, "geoid": gid, "rings": polys_out(g.simplify(0.25), 0.5),
                  "label": dict(zip("xy", map(r2, g.representative_point().coords[0])))} for n, gid, g in sorted(counties)],
    "borders": {"county": lines_out(county_lines.simplify(0.25)), "state": lines_out(state_line.simplify(0.25))},
    "lakes": lakes_out,
    "rivers": rivers,
    "places": [{"name": p["name"], "pop": p["pop"], "county": p["county"], "x": r2(p["x"]), "y": r2(p["y"]),
                "study": p["name"] in STUDY_CITIES} for p in places],
    "labels": [
        lbl("Lake Michigan", -86.9, 43.2, "water"), lbl("Lake Superior", -88.6, 47.55, "water"),
        lbl("Green Bay", -87.86, 44.98, "bay"), lbl("Wisconsin", -89.9, 44.9, "state"),
        lbl("Michigan", -85.1, 43.3, "neighbor"), lbl("Minnesota", -93.6, 45.6, "neighbor"),
        lbl("Iowa", -92.8, 42.1, "neighbor"), lbl("Illinois", -89.4, 41.6, "neighbor"),
        lbl("Upper Peninsula", -86.9, 46.3, "neighbor"), lbl("Ontario", -84.3, 47.6, "neighbor"),
        lbl("Lake Huron", -82.6, 44.6, "water"), lbl("Chicago", -87.75, 41.85, "neighbor"),
    ],
    "trees": [v for t in trees for v in (r2(t[0]), r2(t[1]), t[2], t[3])],
    "rocks": [v for t in rocks for v in map(r2, t)],
    "logs": [v for t in logs for v in map(r2, t)],
    "stumps": [v for t in stumps for v in map(r2, t)],
    "bushes": [v for t in bushes for v in map(r2, t)],
    "flowers": [v for t in flowers for v in (r2(t[0]), r2(t[1]), t[2])],
    "barns": [v for t in barns for v in map(r2, t)],
    "buildings": [v for b in buildings for v in (*map(r2, b[:6]), b[6])],
    "source": "Elevation: AWS Terrain Tiles · US Census Bureau boundaries & 2024 population estimates · Natural Earth",
}
(OUT / "scene.json").write_text(json.dumps(scene, separators=(",", ":")))
size = lambda f: f"{(OUT / f).stat().st_size / 1024:.0f} KB"
print(f"terrain {cols}x{rows} ({size('terrain.bin')}), texture {TW}x{TH} ({size('land.webp')}), scene {size('scene.json')}")
print(f"{len(places)} places, {len(buildings)} buildings, {len(trees)} trees, {len(rocks)} rocks, {len(logs)} logs, "
      f"{len(stumps)} stumps, {len(bushes)} bushes, {len(flowers)} flowers, {len(barns)} barns, {len(lakes_out)} lakes, {len(rivers)} rivers")
print(f"height range {height.min():.2f}..{height.max():.2f} km (scene)")
