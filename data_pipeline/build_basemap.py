"""Build the 3D diorama basemap (Wisconsin + Lake Michigan) for the home page.

Inputs (data/raw/geo/):
  cb_2023_us_county_500k.zip    US Census cartographic boundary counties (shoreline-clipped, detailed)
  cb_2023_us_state_5m.zip       US Census cartographic boundary states (neighbors)
  ne_10m_lakes.geojson          Natural Earth lakes (inland lakes drawn on top of land)
  ne_10m_rivers.geojson         Natural Earth river centerlines
Output:
  web/src/data/basemap.json     imported by the Next.js app (src/lib/diorama.ts)

Coordinates are kilometres on a local equirectangular projection centred on the map frame:
x = east, y = north (the 3D viewer maps y to -z).
"""
import json
import math
import random
from pathlib import Path

import shapefile
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon, box, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "data" / "raw" / "geo"
OUT = ROOT / "web" / "src" / "data" / "basemap.json"

# Map frame (lon/lat)
W_LON, E_LON, S_LAT, N_LAT = -93.4, -84.4, 41.55, 47.35
LON0, LAT0 = (W_LON + E_LON) / 2, (S_LAT + N_LAT) / 2
KM_PER_DEG = 111.32
COS0 = math.cos(math.radians(LAT0))
FRAME = box(W_LON, S_LAT, E_LON, N_LAT)

NEIGHBORS = {"MN", "IA", "IL", "MI", "IN"}
GREAT_LAKES = {"Lake Michigan", "Lake Superior", "Lake Huron", "Whitefish Bay", "St. Marys River"}
RIVERS = {"Wisconsin", "Fox", "Mississippi", "St. Croix", "Namekagon"}
TREE_COUNT = 2400
TREE_SPACING_KM = 4.2
CITIES = [  # label anchors (city centers) and the county each sits in
    {"name": "Green Bay", "lat": 44.5133, "lon": -88.0133, "county": "Brown", "facilities": 5},
    {"name": "Manitowoc", "lat": 44.0886, "lon": -87.6576, "county": "Manitowoc", "facilities": 5},
    {"name": "Sheboygan", "lat": 43.7508, "lon": -87.7145, "county": "Sheboygan", "facilities": 5},
]


def km(lon, lat):
    return round((lon - LON0) * COS0 * KM_PER_DEG, 2), round((lat - LAT0) * KM_PER_DEG, 2)


def flat_ring(coords):
    out = []
    for lon, lat in coords:
        out.extend(km(lon, lat))
    return out


def polygons(geom, min_area=0.0004):
    """Shapely (Multi)Polygon -> [[outer, hole, ...], ...] with flat [x0, y0, x1, y1, ...] rings."""
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    out = []
    for p in polys:
        if p.is_empty or p.area < min_area:
            continue
        rings = [flat_ring(p.exterior.coords)]
        rings += [flat_ring(r.coords) for r in p.interiors if Polygon(r).area > min_area]
        out.append(rings)
    return out


def lines(geom):
    parts = geom.geoms if isinstance(geom, MultiLineString) else [geom]
    return [flat_ring(ln.coords) for ln in parts if isinstance(ln, LineString) and len(ln.coords) > 1]


def read_shapes(zip_name, keep):
    sf = shapefile.Reader(str(GEO / zip_name))  # pyshp reads the zipped shapefile directly
    fields = [f[0] for f in sf.fields[1:]]
    for rec, shp in zip(sf.records(), sf.shapes()):
        attrs = dict(zip(fields, rec))
        if keep(attrs):
            yield attrs, shape(shp.__geo_interface__)


# Wisconsin counties (detailed shoreline) and the state outline built from them
counties = []
for attrs, geom in read_shapes("cb_2023_us_county_500k.zip", lambda a: a["STUSPS"] == "WI"):
    geom = geom.simplify(0.0015, preserve_topology=True)
    counties.append((attrs["NAME"], attrs["GEOID"], geom))
wisconsin = unary_union([g for _, _, g in counties]).simplify(0.0015, preserve_topology=True)

neighbors = unary_union([g for _, g in read_shapes("cb_2023_us_state_5m.zip", lambda a: a["STUSPS"] in NEIGHBORS)])
neighbors = neighbors.intersection(FRAME).simplify(0.004, preserve_topology=True)

# Inland lakes and rivers inside Wisconsin
lakes = []
for f in json.load(open(GEO / "ne_10m_lakes.geojson"))["features"]:
    g = shape(f["geometry"])
    if f["properties"].get("name") not in GREAT_LAKES and g.intersects(wisconsin):
        lakes.append(g.intersection(wisconsin))
lakes = unary_union(lakes) if lakes else Polygon()
rivers = []
for f in json.load(open(GEO / "ne_10m_rivers.geojson"))["features"]:
    if f["properties"].get("name") in RIVERS:
        g = shape(f["geometry"]).intersection(wisconsin.buffer(-0.02))
        if not g.is_empty:
            rivers += lines(g.simplify(0.004))

# Trees: denser in the forested north, sparse in the farmed south
rng = random.Random(7)
minx, miny, maxx, maxy = wisconsin.bounds
plantable = prep(wisconsin.buffer(-0.04).difference(lakes.buffer(0.03)).difference(
    unary_union([Point(c["lon"], c["lat"]).buffer(0.11) for c in CITIES])))
trees, grid = [], {}
cell = TREE_SPACING_KM
attempts = 0
while len(trees) // 4 < TREE_COUNT and attempts < 400000:
    attempts += 1
    lon, lat = rng.uniform(minx, maxx), rng.uniform(miny, maxy)
    north = (lat - miny) / (maxy - miny)
    if rng.random() > 0.06 + 0.94 * north ** 1.6:
        continue
    if not plantable.contains(Point(lon, lat)):
        continue
    x, y = km(lon, lat)
    gx, gy = int(x // cell), int(y // cell)
    near = [grid.get((gx + i, gy + j)) for i in (-1, 0, 1) for j in (-1, 0, 1)]
    if any(p and (x - p[0]) ** 2 + (y - p[1]) ** 2 < cell ** 2 for p in near):
        continue
    grid[(gx, gy)] = (x, y)
    size = round(rng.uniform(0.75, 1.3) * (0.85 + 0.35 * north), 2)
    kind = 1 if rng.random() < 0.16 else 0  # 1 = birch
    trees += [x, y, size, kind]

frame_w, frame_h = km(E_LON, LAT0)[0] * 2, km(LON0, N_LAT)[1] * 2
label = lambda text, lon, lat, kind: {"text": text, "kind": kind, "x": km(lon, lat)[0], "y": km(lon, lat)[1]}
basemap = {
    "units": "km",
    "frame": {"width": round(frame_w, 1), "height": round(frame_h, 1)},
    "wisconsin": polygons(wisconsin),
    "neighbors": polygons(neighbors),
    "lakes": polygons(lakes, min_area=0.0002),
    "rivers": rivers,
    "counties": [
        {"name": name, "geoid": geoid, "rings": polygons(geom),
         "label": dict(zip("xy", km(*geom.representative_point().coords[0])))}
        for name, geoid, geom in sorted(counties)
    ],
    "trees": trees,  # flat [x, y, size, kind, ...]
    "cities": [{**c, **dict(zip("xy", km(c["lon"], c["lat"])))} for c in CITIES],
    "labels": [
        label("Lake Michigan", -86.85, 43.1, "water"),
        label("Lake Superior", -88.9, 47.1, "water"),
        label("Green Bay", -87.86, 44.98, "bay"),
        label("Wisconsin", -89.75, 43.35, "state"),
        label("Michigan", -85.15, 43.0, "neighbor"),
        label("Minnesota", -92.85, 46.0, "neighbor"),
        label("Iowa", -92.4, 42.05, "neighbor"),
        label("Illinois", -89.6, 41.85, "neighbor"),
    ],
    "source": "US Census Bureau cartographic boundaries (2023); Natural Earth lakes & rivers",
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(basemap, separators=(",", ":")))
print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB): frame {frame_w:.0f}x{frame_h:.0f} km, "
      f"{len(counties)} counties, {len(trees) // 4} trees, {len(rivers)} river lines")
