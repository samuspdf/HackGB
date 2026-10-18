"""Shared map frame and projection for the pipeline.

Kilometres on a local equirectangular projection centred on the frame: x = east, y = north.
"""
import math

# Map frame (lon/lat). Wider than Wisconsin so the map can fill the screen as a background.
W_LON, E_LON, S_LAT, N_LAT = -96.0, -84.5, 41.35, 49.2
LON0, LAT0 = (W_LON + E_LON) / 2, (S_LAT + N_LAT) / 2
KM_PER_DEG = 111.32
COS0 = math.cos(math.radians(LAT0))


def km(lon, lat):
    return round((lon - LON0) * COS0 * KM_PER_DEG, 2), round((lat - LAT0) * KM_PER_DEG, 2)


FRAME_W = round(km(E_LON, LAT0)[0] * 2, 1)
FRAME_H = round(km(LON0, N_LAT)[1] * 2, 1)
