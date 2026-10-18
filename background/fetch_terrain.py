"""Download elevation tiles covering the map frame.

Source: AWS Terrain Tiles (Mapzen "terrarium" encoding), public, no key.
  https://registry.opendata.aws/terrain-tiles/
  elevation_m = (R * 256 + G + B / 256) - 32768
Output: background/raw/terrain/z{ZOOM}/{x}_{y}.png
"""
import math
from pathlib import Path

import requests

from frame import E_LON, N_LAT, S_LAT, W_LON

ZOOM = 7
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
OUT = Path(__file__).resolve().parent / "raw" / "terrain" / f"z{ZOOM}"


tile_xy = lambda lon, lat: (int((lon + 180) / 360 * 2 ** ZOOM),
                           int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** ZOOM))
x0, y0 = tile_xy(W_LON, N_LAT)
x1, y1 = tile_xy(E_LON, S_LAT)
OUT.mkdir(parents=True, exist_ok=True)
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        if not (path := OUT / f"{x}_{y}.png").exists():
            (r := requests.get(URL.format(z=ZOOM, x=x, y=y), timeout=60)).raise_for_status()
            path.write_bytes(r.content)
print(f"{(x1 - x0 + 1) * (y1 - y0 + 1)} tiles in {OUT}")
