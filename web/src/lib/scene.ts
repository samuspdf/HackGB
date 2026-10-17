// Map data produced by data_pipeline/build_basemap.py into public/data/.
// Coordinates are kilometres on a local projection: x = east, y = north.

/** Flat ring: [x0, y0, x1, y1, ...] */
export type Ring = number[];
/** Outer ring followed by holes */
export type Polygon = Ring[];

export interface Place {
  name: string;
  pop: number;
  county: string;
  x: number;
  y: number;
  /** One of the three study cities (Green Bay, Manitowoc, Sheboygan) */
  study: boolean;
}

export interface County {
  name: string;
  geoid: string;
  rings: Polygon[];
  label: { x: number; y: number };
}

export interface MapLabel {
  text: string;
  kind: "water" | "bay" | "state" | "neighbor";
  x: number;
  y: number;
}

export interface SceneData {
  frame: { width: number; height: number };
  terrain: { cols: number; rows: number; cell: number; exaggeration: number; file: string; texture: string; water: string };
  wisconsin: Polygon[];
  counties: County[];
  /** Border lines drawn only over land (never along the coast) */
  borders: { county: Ring[]; state: Ring[]; other: Ring[] };
  /** Real Wisconsin Lake Michigan lighthouses */
  lighthouses: { name: string; x: number; y: number }[];
  /** Flat records: x0, y0, x1, y1 (route ends), kind (0 sailboat, 1 freighter), phase */
  boats: number[];
  lakes: { name: string; level: number; rings: Polygon[] }[];
  rivers: Ring[];
  places: Place[];
  labels: MapLabel[];
  /** Flat records — see build_basemap.py for field order */
  trees: number[]; // x, y, size, kind(0 broadleaf, 1 birch)
  rocks: number[]; // x, y, size, rotation
  logs: number[]; // x, y, rotation, length
  stumps: number[]; // x, y, size
  bushes: number[]; // x, y, size
  flowers: number[]; // x, y, colour index
  barns: number[]; // x, y, rotation
  buildings: number[]; // x, y, width, depth, height, rotation, kind(0 house, 1 block, 2 tower)
  source: string;
}

export interface Terrain {
  cols: number;
  rows: number;
  cell: number;
  width: number;
  height: number;
  /** Scene heights in km, row 0 = north */
  heights: Float32Array;
  /** Bilinear ground height at (x east, y north) */
  heightAt(x: number, y: number): number;
}

export interface LoadedMap {
  data: SceneData;
  terrain: Terrain;
  /** Painted ground texture */
  textureUrl: string;
  /** Distance-from-shore texture for the water shader */
  waterUrl: string;
}

export async function loadMap(base = "/data"): Promise<LoadedMap> {
  const data: SceneData = await fetch(`${base}/scene.json`).then((r) => r.json());
  const buf = await fetch(`${base}/${data.terrain.file}`).then((r) => r.arrayBuffer());
  const { cols, rows, cell } = data.terrain;
  const n = cols * rows;
  const raw = new Int16Array(buf, 0, n);
  const heights = new Float32Array(n);
  for (let i = 0; i < n; i++) heights[i] = raw[i] / 100;
  const { width, height } = data.frame;

  const heightAt = (x: number, y: number) => {
    const c = Math.min(Math.max((x + width / 2) / cell, 0), cols - 1.001);
    const r = Math.min(Math.max((height / 2 - y) / cell, 0), rows - 1.001);
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const i = r0 * cols + c0;
    const top = heights[i] * (1 - fc) + heights[i + 1] * fc;
    const bottom = heights[i + cols] * (1 - fc) + heights[i + cols + 1] * fc;
    return top * (1 - fr) + bottom * fr;
  };

  return {
    data,
    terrain: { cols, rows, cell, width, height, heights, heightAt },
    textureUrl: `${base}/${data.terrain.texture}`,
    waterUrl: `${base}/${data.terrain.water}`,
  };
}
