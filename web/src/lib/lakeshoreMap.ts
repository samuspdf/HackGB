// Full-screen 3D map of Wisconsin and Lake Michigan (three.js).
// Data: kilometres with x = east, y = north. Scene: north is -z, height is +y.

import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createLabelLayer, type LabelKind } from "./mapLabels";
import type { LoadedMap, Place, Polygon, Ring } from "./scene";

export interface MapController {
  zoomBy(factor: number): void;
  reset(): void;
  /** Turn the map so `deg` (0 = north, 90 = east, …) points to the top of the screen */
  setHeading(deg: number): void;
  focusPlace(name: string): void;
  /** Jump to map coordinates (km, x east / y north) at a camera distance */
  viewAt(x: number, y: number, dist: number): void;
  dispose(): void;
}

interface MapOptions {
  container: HTMLElement;
  map: LoadedMap;
  reducedMotion: boolean;
  onHeading?: (deg: number) => void;
  onFocus?: (place: Place) => void;
  onFirstInteraction?: () => void;
}

const FOV = 35;
const MAX_TILT = 1.15; // radians from straight down
const MIN_TILT = 0.0005; // a hair off vertical so the camera always knows which way it faces
const TREE_SCALE = 0.5; // trees are stylised: big enough to read from afar, not towering over houses

const PALETTE = {
  houseWalls: [0xf3e3c3, 0xe9cfa9, 0xf1d1c6, 0xd6e4ea, 0xe8e0f0, 0xf5ecd9],
  houseRoofs: [0xb8432c, 0x8a5532, 0x5b6b8c, 0x6c4f6e, 0xa85a3c, 0x4f6f58],
  blockWalls: [0xe9dfcf, 0xd9cdbd, 0xc8d2dc, 0xe3d3c0, 0xd3c4d8],
  towerWalls: [0xcfd8e6, 0xb9c6d8, 0xe2d9cc, 0xa9b8cf],
  broadleaf: [0x3f774f, 0x2e5e4a, 0x4f8a45, 0x5f9a4a, 0x46804a],
  pine: [0x2c5848, 0x234c40, 0x35614c],
  birch: [0x86b84a, 0x9cc457, 0x6a9e3f],
  rock: [0xa99c9a, 0x9a94a6, 0xb7aca3, 0x8f8a99],
  bush: [0x5f9a4a, 0x76a84f, 0x4f8a45, 0x8bb85a],
  flower: [0xe46a8c, 0xf2c94c, 0xf7f3ea, 0xa678d6],
};

export function createLakeshoreMap(opts: MapOptions): MapController {
  const { container, map, reducedMotion } = opts;
  let disposed = false;
  const { data, terrain } = map;
  const W = data.frame.width;
  const H = data.frame.height;
  const ground = terrain.heightAt;
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => (disposables.push(item), item);

  // Deterministic randomness so the map looks the same on every visit
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

  // ---------------------------------------------------------------- renderer + camera
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Retina at 1.5x keeps gestures smooth
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the sun never moves: re-render shadows only when the view changes
  renderer.domElement.className = "block size-full outline-none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0xf1dbe0);
  scene.fog = new THREE.Fog(fogColor, 1500, 4000);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 6000);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  // Home view: straight down over Wisconsin, nudged east to include the lakeshore
  const wiBounds = new THREE.Box2();
  data.wisconsin.forEach((poly) => forPoints(poly[0], (x, y) => wiBounds.expandByPoint(new THREE.Vector2(x, y))));
  const wiCenter = wiBounds.getCenter(new THREE.Vector2()).add(new THREE.Vector2(35, 0));
  const wiSize = wiBounds.getSize(new THREE.Vector2());

  const controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.6;
  controls.panSpeed = 1.1;
  controls.rotateSpeed = 0.7;
  controls.minDistance = 4;
  controls.maxPolarAngle = MAX_TILT;
  controls.keyPanSpeed = 22;
  controls.listenToKeyEvents(window);

  const home = () => {
    const aspect = camera.aspect || 1;
    const fit = Math.max((wiSize.y * 0.62) / tanHalf, (wiSize.x * 0.62) / (tanHalf * aspect));
    const dist = Math.min(fit, controls.maxDistance);
    const target = new THREE.Vector3(wiCenter.x, 0, -wiCenter.y);
    return { target, position: target.clone().add(new THREE.Vector3(0, dist, 0.001)) };
  };

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0xd8d2ff, 0xf2d3a5, 1.45));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
  const SUN_DIR = new THREE.Vector3(-0.55, 0.78, 0.3).normalize();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); // the shadow frustum follows the view, so 2048 stays crisp up close
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- materials
  const ramp = track(new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat));
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const toon = (p: THREE.MeshToonMaterialParameters = {}) => track(new THREE.MeshToonMaterial({ gradientMap: ramp, ...p }));
  const white = toon({ color: 0xffffff });

  // ---------------------------------------------------------------- terrain
  const terrainGeo = track(new THREE.PlaneGeometry(W, H, terrain.cols - 1, terrain.rows - 1));
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrain.heights[i]);
  terrainGeo.computeVertexNormals();
  const landTex = track(new THREE.TextureLoader().load(map.textureUrl, () => (renderer.shadowMap.needsUpdate = true)));
  landTex.colorSpace = THREE.SRGBColorSpace;
  landTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const terrainMesh = new THREE.Mesh(terrainGeo, toon({ map: landTex }));
  terrainMesh.castShadow = terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // ---------------------------------------------------------------- water
  // One opaque plane at height 0. The lakebed sits well below it and every shore is lifted above it,
  // so the two surfaces never share depth — that was the source of the flicker.
  const distTex = track(new THREE.TextureLoader().load(map.waterUrl));
  distTex.colorSpace = THREE.NoColorSpace;
  const waterUniforms = {
    uDist: { value: distTex },
    uTime: { value: 0 },
    uFar: { value: 1 },
    uShallow: { value: new THREE.Color(0x8fcbef) },
    uMid: { value: new THREE.Color(0x5b8fd8) },
    uDeep: { value: new THREE.Color(0x3d5fb2) },
    ...THREE.UniformsLib.fog,
  };
  const waterMat = track(
    new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      fog: true,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec2 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uDist;
        uniform float uTime;
        uniform vec3 uShallow, uMid, uDeep;
        varying vec2 vUv;
        varying vec2 vWorld;
        #include <fog_pars_fragment>
        uniform float uFar;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float waveMarks(vec2 p, float density) {
          vec2 cell = floor(p);
          vec2 f = fract(p) - 0.5 - (vec2(hash(cell), hash(cell + 7.3)) - 0.5) * 0.4;
          float arc = abs(f.y - 0.06 * sin(f.x * 14.0));
          float w = fwidth(p.y) * 1.5;
          float mark = (1.0 - smoothstep(0.012, 0.012 + w, arc)) * (1.0 - smoothstep(0.13, 0.17, abs(f.x)));
          return mark * step(density, hash(cell + 3.1));
        }
        void main() {
          float d = texture2D(uDist, vUv).r; // 0 at the shore, 1 at 40 km out
          vec3 col = mix(uShallow, uMid, smoothstep(0.0, 0.18, d));
          col = mix(col, uDeep, smoothstep(0.2, 0.9, d));
          // Painted wave marks drifting across open water: big strokes from afar, small ripples up close
          float far = waveMarks(vWorld / 16.0 + vec2(uTime * 0.025, uTime * 0.01), 0.62) * uFar;
          float near = waveMarks(vWorld / 1.4 + vec2(uTime * 0.12, uTime * 0.05), 0.55) * (1.0 - uFar);
          col = mix(col, vec3(0.97, 0.98, 1.0), max(far, near) * 0.6 * smoothstep(0.02, 0.08, d));
          // Foam along every shore, breathing slightly
          float foamEdge = 0.012 + 0.004 * sin(uTime * 1.3 + vWorld.x * 0.15 + vWorld.y * 0.1);
          col = mix(col, vec3(0.97, 0.98, 1.0), 1.0 - smoothstep(foamEdge * 0.4, foamEdge, d));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    }),
  );
  const water = new THREE.Mesh(track(new THREE.PlaneGeometry(W, H)), waterMat);
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // Inland lakes: flat water at their own level
  const lakeMat = toon({ color: 0x78a9e6 });
  for (const lake of data.lakes) {
    const g = track(new THREE.ShapeGeometry(lake.rings.map(toShape)));
    g.rotateX(-Math.PI / 2);
    g.translate(0, lake.level, 0);
    scene.add(new THREE.Mesh(g, lakeMat));
  }

  // Rivers draped over the terrain
  const riverGeos = data.rivers.map((line) => ribbon(line, 0.9, 0.14));
  if (riverGeos.length) scene.add(new THREE.Mesh(track(mergeGeometries(riverGeos)), toon({ color: 0x6b9ae0 })));

  // County and state borders, draped
  // Borders are screen-space lines: the same pixel width at every zoom
  const lineMats: LineMaterial[] = [];
  const borderLines = (rings: Ring[], lift: number, opts: ConstructorParameters<typeof LineMaterial>[0]) => {
    const mat = track(new LineMaterial({ transparent: true, depthWrite: false, ...opts }));
    lineMats.push(mat);
    const geo = track(new LineSegmentsGeometry());
    geo.setPositions(drapedSegments(rings, lift));
    const lines = new LineSegments2(geo, mat);
    if (opts?.dashed) lines.computeLineDistances();
    scene.add(lines);
    return mat;
  };
  const countyMat = borderLines(data.borders.county, 0.25, { color: 0x2e5e4a, linewidth: 1.2, opacity: 0 });
  borderLines(data.borders.state, 0.3, { color: 0x2e5e4a, linewidth: 2.4, opacity: 0.7 });
  borderLines(data.borders.other, 0.3, { color: 0x7a6440, linewidth: 1.8, opacity: 0.75, dashed: true, dashSize: 5, gapSize: 3 });

  // ---------------------------------------------------------------- instanced helpers
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  function instanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    set: (i: number, o: THREE.Object3D) => number | void,
    { shadows = true }: { shadows?: boolean } = {},
  ) {
    const mesh = new THREE.InstancedMesh(track(geo), mat, Math.max(count, 1));
    mesh.count = count;
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      const hex = set(i, dummy);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (typeof hex === "number") mesh.setColorAt(i, color.setHex(hex));
    }
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const at = (o: THREE.Object3D, x: number, y: number, lift = 0) => o.position.set(x, ground(x, y) + lift, -y);
  const records = (arr: number[], size: number) => {
    const out: number[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // ---------------------------------------------------------------- trees
  const trees = records(data.trees, 4);
  const northOf = (y: number) => THREE.MathUtils.clamp((y + 140) / 330, 0, 1);
  const kinds: { geo: THREE.BufferGeometry; trunk: THREE.BufferGeometry; trunkColor: number; palette: number[]; list: number[][] }[] = [
    {
      geo: blobs([[0, 2.7, 0, 1.5], [-0.95, 2.15, 0.35, 1.05], [0.95, 2.2, -0.3, 1.1]]),
      trunk: new THREE.CylinderGeometry(0.2, 0.3, 1.9, 6).translate(0, 0.95, 0),
      trunkColor: 0x7b4a33,
      palette: PALETTE.broadleaf,
      list: [],
    },
    {
      geo: blobs([[0, 3.3, 0, 1.05], [-0.6, 2.8, 0.25, 0.8], [0.55, 2.9, -0.2, 0.8]]),
      trunk: new THREE.CylinderGeometry(0.15, 0.2, 2.8, 6).translate(0, 1.4, 0),
      trunkColor: 0xf1ede4,
      palette: PALETTE.birch,
      list: [],
    },
    {
      geo: mergeGeometries([
        new THREE.ConeGeometry(1.25, 2.1, 7).translate(0, 1.9, 0),
        new THREE.ConeGeometry(0.95, 1.8, 7).translate(0, 3.0, 0),
        new THREE.ConeGeometry(0.62, 1.5, 7).translate(0, 4.0, 0),
      ]),
      trunk: new THREE.CylinderGeometry(0.16, 0.24, 1.2, 6).translate(0, 0.6, 0),
      trunkColor: 0x6b4330,
      palette: PALETTE.pine,
      list: [],
    },
  ];
  for (const t of trees) {
    const k = t[3] === 1 ? 1 : rand() < 0.15 + 0.5 * northOf(t[1]) ? 2 : 0;
    kinds[k].list.push(t);
  }
  for (const kind of kinds) {
    const yaw = kind.list.map(() => rand() * Math.PI * 2);
    const set = (i: number, o: THREE.Object3D) => {
      const [x, y, s] = kind.list[i];
      at(o, x, y, -0.08);
      o.rotation.y = yaw[i];
      o.scale.setScalar(s * TREE_SCALE);
    };
    instanced(kind.geo, white, kind.list.length, (i, o) => (set(i, o), pick(kind.palette)));
    instanced(kind.trunk, toon({ color: kind.trunkColor }), kind.list.length, set);
  }

  // ---------------------------------------------------------------- rocks, logs, stumps, bushes, flowers
  const rockGeo = new THREE.DodecahedronGeometry(1, 0).scale(1.25, 0.7, 1);
  const rocks = records(data.rocks, 4);
  instanced(rockGeo, white, rocks.length, (i, o) => {
    const [x, y, s, r] = rocks[i];
    at(o, x, y, 0.1 * s);
    o.rotation.set(rand() * 0.4, r, rand() * 0.4);
    o.scale.setScalar(s);
    return pick(PALETTE.rock);
  });

  const logs = records(data.logs, 4);
  const logGeo = new THREE.CylinderGeometry(0.2, 0.22, 1.7, 8).rotateZ(Math.PI / 2);
  instanced(logGeo, toon({ color: 0x8a5532 }), logs.length, (i, o) => {
    const [x, y, r, len] = logs[i];
    at(o, x, y, 0.2);
    o.rotation.y = r;
    o.scale.set(len, 1, 1);
  });
  const stumps = records(data.stumps, 3);
  instanced(new THREE.CylinderGeometry(0.28, 0.36, 0.45, 8).translate(0, 0.22, 0), toon({ color: 0x9a5a35 }), stumps.length, (i, o) => {
    const [x, y, s] = stumps[i];
    at(o, x, y, -0.05);
    o.scale.setScalar(s);
  });

  const bushes = records(data.bushes, 3);
  instanced(blobs([[0, 0.45, 0, 0.6], [0.45, 0.35, 0.1, 0.42], [-0.4, 0.32, -0.1, 0.4]]), white, bushes.length, (i, o) => {
    const [x, y, s] = bushes[i];
    at(o, x, y, -0.05);
    o.rotation.y = rand() * 6.28;
    o.scale.setScalar(s);
    return pick(PALETTE.bush);
  });

  const flowers = records(data.flowers, 3);
  // A small meadow patch: a tuft of grass dotted with blooms
  const flowerGeo = mergeGeometries([
    ...Array.from({ length: 7 }, (_, k) =>
      new THREE.IcosahedronGeometry(0.07, 0).translate(Math.cos(k * 2.4) * 0.05 * k, 0.12, Math.sin(k * 2.4) * 0.05 * k),
    ),
  ]);
  instanced(flowerGeo, white, flowers.length, (i, o) => {
    const [x, y, c] = flowers[i];
    at(o, x, y);
    o.rotation.y = rand() * 6.28;
    return PALETTE.flower[c];
  }, { shadows: false });

  // Dairy barns with silos across southern Wisconsin farmland
  const barns = records(data.barns, 3);
  const barnSet = (i: number, o: THREE.Object3D) => {
    const [x, y, r] = barns[i];
    at(o, x, y, -0.02);
    o.rotation.y = r;
  };
  instanced(new THREE.BoxGeometry(0.62, 0.36, 0.4).translate(0, 0.18, 0), toon({ color: 0xb8432c }), barns.length, barnSet);
  instanced(gableRoof().scale(0.66, 0.24, 0.44).translate(0, 0.36, 0), toon({ color: 0x5d5566 }), barns.length, barnSet);
  instanced(
    mergeGeometries([
      new THREE.CylinderGeometry(0.11, 0.11, 0.62, 10).translate(0.46, 0.31, 0.08),
      new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.46, 0.62, 0.08),
    ]),
    toon({ color: 0xe8e2d6 }),
    barns.length,
    barnSet,
  );

  // ---------------------------------------------------------------- buildings
  const buildings = records(data.buildings, 7);
  const byKind = [0, 1, 2].map((k) => buildings.filter((b) => b[6] === k));
  const bSet = (list: number[][], roof: boolean) => (i: number, o: THREE.Object3D) => {
    const [x, y, w, d, h, r] = list[i];
    at(o, x, y, -0.04);
    o.rotation.y = r;
    if (roof) {
      o.position.y += h;
      o.scale.set(w * 1.08, w * 0.5, d * 1.08);
    } else {
      o.scale.set(w, h, d);
    }
  };
  const unitBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const houses = byKind[0];
  instanced(unitBox(), white, houses.length, (i, o) => (bSet(houses, false)(i, o), pick(PALETTE.houseWalls)));
  instanced(gableRoof(), white, houses.length, (i, o) => (bSet(houses, true)(i, o), pick(PALETTE.houseRoofs)));
  for (const [list, walls] of [[byKind[1], PALETTE.blockWalls], [byKind[2], PALETTE.towerWalls]] as const) {
    instanced(unitBox(), white, list.length, (i, o) => (bSet(list, false)(i, o), pick(walls)));
    instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), toon({ color: 0x8d8597 }), list.length, (i, o) => {
      const [x, y, w, d, h, r] = list[i];
      at(o, x, y, h - 0.04);
      o.rotation.y = r;
      o.scale.set(w * 0.92, 0.035, d * 0.92);
    });
  }

  // Study cities: signpost with a pulsing pin
  const pulses: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  const postMat = toon({ color: 0x8a5532 });
  const pinMat = toon({ color: 0xe0703a });
  for (const p of data.places.filter((q) => q.study)) {
    const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 2.6, 0.22).translate(0, 1.3, 0)), postMat);
    at(post, p.x, p.y);
    post.castShadow = true;
    const pin = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 24)), pinMat);
    at(pin, p.x, p.y, 0.15);
    const pulse = new THREE.Mesh(
      track(new THREE.RingGeometry(0.45, 0.7, 32).rotateX(-Math.PI / 2)),
      track(new THREE.MeshBasicMaterial({ color: 0xe0703a, transparent: true, depthWrite: false })),
    );
    at(pulse, p.x, p.y, 0.2);
    scene.add(post, pin, pulse);
    pulses.push(pulse);
  }

  // ---------------------------------------------------------------- lighthouses
  const beams: THREE.Object3D[] = [];
  const lhWhite = toon({ color: 0xf7f3ea });
  const lhRed = toon({ color: 0xc0392b });
  const lhDark = toon({ color: 0x3a3548 });
  const pierMat = toon({ color: 0xa99c9a });
  const lampMat = track(new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
  const beamMat = track(
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  );
  const lhGeo = {
    pier: track(new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12).translate(0, 0.17, 0)),
    tower: track(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 14).translate(0, 0.65, 0)),
    band1: track(new THREE.CylinderGeometry(0.218, 0.222, 0.2, 14).translate(0, 0.45, 0)),
    band2: track(new THREE.CylinderGeometry(0.187, 0.192, 0.2, 14).translate(0, 0.95, 0)),
    gallery: track(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 14).translate(0, 1.32, 0)),
    lamp: track(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10).translate(0, 1.44, 0)),
    roof: track(new THREE.ConeGeometry(0.17, 0.2, 10).translate(0, 1.63, 0)),
    beam: track(new THREE.ConeGeometry(0.4, 3.2, 16, 1, true).rotateZ(Math.PI / 2).translate(1.6, 0, 0)),
  };
  for (const lh of data.lighthouses) {
    const g = new THREE.Group();
    const land = ground(lh.x, lh.y);
    const onPier = land < 0.3; // breakwater lights stand on a stone pier out in the water
    g.position.set(lh.x, onPier ? 0 : land, -lh.y);
    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [lhGeo.tower, lhWhite], [lhGeo.band1, lhRed], [lhGeo.band2, lhRed],
      [lhGeo.gallery, lhDark], [lhGeo.lamp, lampMat], [lhGeo.roof, lhRed],
    ];
    const tower = new THREE.Group();
    tower.position.y = onPier ? 0.35 : 0;
    for (const [geo, mat] of parts) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = mat !== lampMat;
      tower.add(m);
    }
    const beam = new THREE.Object3D();
    beam.position.y = 1.44;
    beam.rotation.y = rand() * Math.PI * 2;
    beam.add(new THREE.Mesh(lhGeo.beam, beamMat));
    tower.add(beam);
    beams.push(beam);
    if (onPier) g.add(new THREE.Mesh(lhGeo.pier, pierMat));
    g.add(tower);
    scene.add(g);
  }

  // ---------------------------------------------------------------- boats on Lake Michigan
  /** Hull outline (top view) extruded upward, bow pointing +x */
  const hull = (length: number, width: number, depth: number) => {
    const s = new THREE.Shape();
    s.moveTo(-length / 2, -width / 2);
    s.lineTo(length * 0.36, -width / 2);
    s.lineTo(length / 2, 0);
    s.lineTo(length * 0.36, width / 2);
    s.lineTo(-length / 2, width / 2);
    s.closePath();
    return track(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2));
  };
  const tri = (pts: number[]) => {
    const g = track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    return g;
  };
  const sailMat = track(new THREE.MeshToonMaterial({ gradientMap: ramp, color: 0xfbf7ee, side: THREE.DoubleSide }));
  const wakeMat = track(new THREE.MeshBasicMaterial({ color: 0xf7fbff, transparent: true, opacity: 0.55, depthWrite: false }));
  const boatGeo = {
    sailHull: hull(0.55, 0.2, 0.1),
    sail: tri([-0.17, 0.12, 0, 0.13, 0.12, 0, -0.05, 0.78, 0]),
    jib: tri([0.15, 0.12, 0, 0.25, 0.12, 0, 0.0, 0.6, 0]),
    mast: track(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5).translate(-0.04, 0.45, 0)),
    shipHull: hull(2.1, 0.3, 0.16),
    cabin: track(new THREE.BoxGeometry(0.26, 0.24, 0.26).translate(-0.82, 0.28, 0)),
    bridge: track(new THREE.BoxGeometry(0.14, 0.14, 0.24).translate(0.86, 0.23, 0)),
    stack: track(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8).translate(-0.9, 0.48, 0)),
    deck: track(new THREE.BoxGeometry(1.4, 0.02, 0.22).translate(0.02, 0.17, 0)),
    wakeSmall: tri([-0.25, 0.02, 0, -1.6, 0.02, 0.5, -1.6, 0.02, -0.5]),
    wakeBig: tri([-1.0, 0.02, 0, -4.2, 0.02, 1.1, -4.2, 0.02, -1.1]),
  };
  const boatMats = {
    sailHull: [toon({ color: 0xf2efe8 }), toon({ color: 0x2f4f7a }), toon({ color: 0xb8432c })],
    shipHull: toon({ color: 0x8e2f2a }),
    white: toon({ color: 0xf2efe8 }),
    dark: toon({ color: 0x2c2a44 }),
    deck: toon({ color: 0x6d5a4c }),
  };
  interface Boat { obj: THREE.Group; a: THREE.Vector2; b: THREE.Vector2; len: number; speed: number; phase: number; yaw: number }
  const boats: Boat[] = records(data.boats, 6).map(([x0, y0, x1, y1, kind, phase], i) => {
    const obj = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      obj.add(m);
    };
    if (kind === 1) {
      add(boatGeo.shipHull, boatMats.shipHull);
      add(boatGeo.deck, boatMats.deck);
      add(boatGeo.cabin, boatMats.white);
      add(boatGeo.bridge, boatMats.white);
      add(boatGeo.stack, boatMats.dark);
      add(boatGeo.wakeBig, wakeMat, false);
    } else {
      add(boatGeo.sailHull, boatMats.sailHull[i % 3]);
      add(boatGeo.mast, boatMats.dark);
      add(boatGeo.sail, sailMat);
      add(boatGeo.jib, sailMat);
      add(boatGeo.wakeSmall, wakeMat, false);
    }
    // Stylised scale, like the lighthouses: big enough to spot while zoomed out over the lake
    obj.scale.setScalar(kind === 1 ? 2.2 : 2.6);
    const a = new THREE.Vector2(x0, y0);
    const b = new THREE.Vector2(x1, y1);
    const len = a.distanceTo(b);
    scene.add(obj);
    return { obj, a, b, len, speed: kind === 1 ? 1.1 : 0.75, phase, yaw: 0 };
  });
  const boatPos = new THREE.Vector2();
  function updateBoats(time: number, dt: number) {
    for (const boat of boats) {
      // Sail back and forth along the route, easing into each turn
      const u = (boat.phase + (time * boat.speed) / boat.len) % 2;
      const s = u < 1 ? u : 2 - u;
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * s);
      boatPos.lerpVectors(boat.a, boat.b, eased);
      const dir = u < 1 ? 1 : -1;
      const want = Math.atan2(dir * (boat.b.y - boat.a.y), dir * (boat.b.x - boat.a.x));
      let d = want - boat.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      boat.yaw += d * Math.min(1, dt * 1.5);
      boat.obj.position.set(boatPos.x, -0.03 + Math.sin(time * 1.7 + boat.phase * 10) * 0.015, -boatPos.y);
      boat.obj.rotation.set(Math.sin(time * 1.3 + boat.phase * 7) * 0.04, boat.yaw, 0);
    }
  }
  updateBoats(0, 10);

  // ---------------------------------------------------------------- clouds + birds (over Wisconsin only)
  const sky = { minX: wiBounds.min.x, maxX: wiBounds.max.x, minZ: -wiBounds.max.y, maxZ: -wiBounds.min.y };
  const skyW = sky.maxX - sky.minX;
  const skyH = sky.maxZ - sky.minZ;
  const cloudMat = toon({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false });
  const clouds: { mesh: THREE.Mesh; speed: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const n = 4 + Math.floor(rand() * 4);
    const puffs: [number, number, number, number][] = [];
    for (let b = 0; b < n; b++) puffs.push([(b - n / 2) * 7, rand() * 3, (rand() - 0.5) * 7, 5 + rand() * 5]);
    const cloud = new THREE.Mesh(track(blobs(puffs)), cloudMat);
    cloud.scale.y = 0.5;
    cloud.position.set(sky.minX + rand() * skyW, 55 + rand() * 30, sky.minZ + rand() * skyH);
    clouds.push({ mesh: cloud, speed: 1.5 + rand() * 2.5 });
    scene.add(cloud);
  }

  const wingGeo = track(new THREE.BufferGeometry());
  wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.35, 0, 0, 0.35, 1.6, 0, 0.1], 3));
  wingGeo.computeVertexNormals();
  const birdMat = track(new THREE.MeshBasicMaterial({ color: 0x4a4560, side: THREE.DoubleSide }));
  const flocks: { origin: THREE.Vector3; dir: THREE.Vector3; offsets: THREE.Vector3[]; phase: number }[] = [];
  for (let f = 0; f < 6; f++) {
    const angle = rand() * Math.PI * 2;
    const n = 5 + Math.floor(rand() * 4);
    flocks.push({
      origin: new THREE.Vector3(sky.minX + rand() * skyW, 38 + rand() * 25, sky.minZ + rand() * skyH),
      dir: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      offsets: Array.from({ length: n }, (_, k) => {
        const side = k % 2 ? 1 : -1;
        const row = Math.ceil(k / 2);
        return new THREE.Vector3(-row * 2.4, rand() * 0.6, side * row * 2.2);
      }),
      phase: rand() * 10,
    });
  }
  const birdCount = flocks.reduce((s, f) => s + f.offsets.length, 0);
  const wings = [-1, 1].map((side) => {
    const m = new THREE.InstancedMesh(wingGeo, birdMat, birdCount);
    m.userData.side = side;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const flockQuat = new THREE.Quaternion();
  const flapQuat = new THREE.Quaternion();
  const sideQuat = new THREE.Quaternion();
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const tmpPos = new THREE.Vector3();
  function updateBirds(time: number, dt: number) {
    let i = 0;
    for (const f of flocks) {
      f.origin.addScaledVector(f.dir, dt * 9);
      // Wrap around within the skies over Wisconsin
      if (f.origin.x > sky.maxX) f.origin.x -= skyW;
      if (f.origin.x < sky.minX) f.origin.x += skyW;
      if (f.origin.z > sky.maxZ) f.origin.z -= skyH;
      if (f.origin.z < sky.minZ) f.origin.z += skyH;
      flockQuat.setFromAxisAngle(AXIS_Y, Math.atan2(-f.dir.z, f.dir.x));
      for (const off of f.offsets) {
        tmpPos.copy(off).applyQuaternion(flockQuat).add(f.origin);
        const flap = Math.sin(time * 9 + f.phase + i * 0.7) * 0.6;
        for (const w of wings) {
          // flight frame → flap about the flight axis → swing the wing out to its side
          dummy.position.copy(tmpPos);
          dummy.quaternion
            .copy(flockQuat)
            .multiply(flapQuat.setFromAxisAngle(AXIS_X, w.userData.side * flap))
            .multiply(sideQuat.setFromAxisAngle(AXIS_Y, (w.userData.side * Math.PI) / 2));
          dummy.scale.setScalar(1.3);
          dummy.updateMatrix();
          w.setMatrixAt(i, dummy.matrix);
        }
        i++;
      }
    }
    wings.forEach((w) => (w.instanceMatrix.needsUpdate = true));
  }
  updateBirds(0, 0);

  // ---------------------------------------------------------------- labels (drawn in the scene)
  const labelLayer = createLabelLayer<Place>(scene, camera);
  let labelsBuilt = false;
  labelLayer.ready.then(() => {
    if (disposed) return;
    const at3 = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);
    for (const l of data.labels) {
      const h = l.kind === "water" || l.kind === "bay" ? 0.5 : Math.max(ground(l.x, l.y), 0) + 1.5;
      labelLayer.add(l.text, l.kind, at3(l.x, l.y, h));
    }
    for (const c of data.counties) {
      if (!data.places.some((p) => p.study && p.county === c.name)) {
        labelLayer.add(c.name, "county", at3(c.label.x, c.label.y, ground(c.label.x, c.label.y) + 0.6));
      }
    }
    // Only the three study cities are named; their signs are clickable
    for (const p of data.places.filter((q) => q.study)) labelLayer.add(p.name, "sign", at3(p.x, p.y, ground(p.x, p.y) + 2.6), p);
    labelsBuilt = true;
  });
  const labelVisible = (dist: number) => (kind: LabelKind) =>
    kind === "county" ? dist < 260 : kind === "state" ? dist > 140 : kind === "neighbor" ? dist > 90 : true;

  // ---------------------------------------------------------------- camera flights
  interface Flight {
    from: { target: THREE.Vector3; dist: number; polar: number; azimuth: number };
    to: { target: THREE.Vector3; dist: number; polar: number; azimuth: number };
    start: number;
    ms: number;
    lift: number;
    done?: () => void;
  }
  let flight: Flight | null = null;
  const spherical = new THREE.Spherical();
  const currentView = () => {
    spherical.setFromVector3(camera.position.clone().sub(controls.target));
    return { target: controls.target.clone(), dist: spherical.radius, polar: spherical.phi, azimuth: spherical.theta };
  };
  function flyTo(to: Partial<Flight["to"]>, ms = 900, lift = 0, done?: () => void) {
    const from = currentView();
    const dest = { ...from, ...to, target: (to.target ?? from.target).clone() };
    // Rotate the short way round
    let dAz = dest.azimuth - from.azimuth;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    dest.azimuth = from.azimuth + dAz;
    flight = { from, to: dest, start: performance.now(), ms: reducedMotion ? 0 : ms, lift, done };
  }
  function stepFlight(now: number) {
    if (!flight) return;
    const t = flight.ms ? Math.min((now - flight.start) / flight.ms, 1) : 1;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const { from, to } = flight;
    controls.target.lerpVectors(from.target, to.target, e);
    const r = Math.min(THREE.MathUtils.lerp(from.dist, to.dist, e) + Math.sin(Math.PI * t) * flight.lift, controls.maxDistance);
    spherical.set(
      r,
      // Never exactly 0: looking perfectly straight down loses the heading
      Math.max(MIN_TILT, Math.min(THREE.MathUtils.lerp(from.polar, to.polar, e), maxTiltFor(r, controls.target))),
      THREE.MathUtils.lerp(from.azimuth, to.azimuth, e),
    );
    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.lookAt(controls.target);
    if (t === 1) {
      const done = flight.done;
      flight = null;
      done?.();
      shadowDirty = true;
    }
  }

  function focusPlace(place: Place) {
    const target = new THREE.Vector3(place.x, ground(place.x, place.y), -place.y);
    const dist = place.pop >= 100000 ? 34 : place.pop >= 20000 ? 22 : place.pop >= 5000 ? 14 : 9;
    const travel = target.distanceTo(controls.target);
    const now = currentView();
    flyTo({ target, dist, polar: 0.62 }, 1500 + Math.min(travel, 600) * 1.2, Math.max(0, travel * 0.55 - (now.dist - dist) * 0.3));
    opts.onFocus?.(place);
    hideHint();
  }

  // ---------------------------------------------------------------- interaction
  let hinted = false;
  const hideHint = () => {
    if (!hinted) {
      hinted = true;
      opts.onFirstInteraction?.();
    }
  };
  let lastMove = 0;
  controls.addEventListener("start", () => {
    flight = null;
    hideHint();
  });
  controls.addEventListener("change", () => (lastMove = performance.now()));
  controls.addEventListener("end", () => (shadowDirty = true));

  // Wheel + trackpad zoom, handled here instead of by MapControls: a MacBook pinch arrives as
  // ctrl+wheel with tiny deltas, which the stock controls turn into very slow zooming.
  // Zooms toward the point under the cursor, applied immediately for a direct feel.
  const zoomRay = new THREE.Raycaster();
  const zoomNdc = new THREE.Vector2();
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation(); // keep MapControls' own (slow) wheel zoom from also running
    flight = null;
    hideHint();
    lastMove = performance.now();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const speed = e.ctrlKey ? 0.011 : 0.0024; // pinch vs. scroll/mouse wheel
    const factor = Math.exp(THREE.MathUtils.clamp(e.deltaY * unit * speed, -0.5, 0.5));
    const offset = camera.position.clone().sub(controls.target);
    const dist = offset.length();
    const next = THREE.MathUtils.clamp(dist * factor, controls.minDistance, controls.maxDistance);
    const rect = renderer.domElement.getBoundingClientRect();
    zoomNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    zoomRay.setFromCamera(zoomNdc, camera);
    const hit = groundHit(zoomRay.ray);
    if (hit) controls.target.addScaledVector(hit.sub(controls.target), 1 - next / dist);
    camera.position.copy(controls.target).add(offset.setLength(next));
  };
  container.addEventListener("wheel", onWheel, { capture: true, passive: false });

  // Click (not drag) on the map: fly to the nearest town or city
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onUp = (e: PointerEvent) => {
    if (!down || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 350;
    down = null;
    if (moved > 5 || !quick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const sign = labelLayer.pick(raycaster);
    if (sign?.data) return focusPlace(sign.data);
    const hit = groundHit(raycaster.ray);
    if (!hit) return;
    const dist = camera.position.distanceTo(controls.target);
    const radius = Math.max(3, dist * 0.035);
    let best: Place | null = null;
    let bestD = Infinity;
    for (const p of data.places) {
      const d = Math.hypot(p.x - hit.x, p.y + hit.z) - Math.log10(p.pop) * 0.4;
      if (d < bestD) [best, bestD] = [p, d];
    }
    if (best && bestD < radius) focusPlace(best);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  // Pointer cursor over the clickable city signs
  let hoverQueued = false;
  const onHover = (e: PointerEvent) => {
    if (down || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      renderer.domElement.style.cursor = labelLayer.pick(raycaster) ? "pointer" : "";
    });
  };
  renderer.domElement.addEventListener("pointermove", onHover);

  // Ray → terrain intersection by marching the height field
  function groundHit(ray: THREE.Ray) {
    const p = new THREE.Vector3();
    if (ray.direction.y >= 0) return null;
    let t = (2 - ray.origin.y) / ray.direction.y;
    for (let k = 0; k < 6; k++) {
      ray.at(t, p);
      const h = Math.max(ground(p.x, -p.z), 0);
      t += (p.y - h) / -ray.direction.y;
    }
    return ray.at(t, p);
  }

  // ---------------------------------------------------------------- keep the view on the map
  // The view may be turned any way, so the larger half-extent of the screen must fit the smaller map side
  function updateBounds() {
    controls.maxDistance = Math.min(W, H) / 2 / (tanHalf * Math.max(camera.aspect, 1));
  }
  // Steepest tilt that keeps the far edge of the view on the map (never the sky or the map's edge)
  const vHalf = THREE.MathUtils.degToRad(FOV / 2);
  function maxTiltFor(dist: number, target: THREE.Vector3) {
    const room = Math.min(W / 2 - Math.abs(target.x), H / 2 - Math.abs(target.z));
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(camera.aspect, 1));
    const fits = (polar: number) => {
      const top = polar + vHalf;
      if (top >= 1.4) return false;
      const height = dist * Math.cos(polar);
      const far = height * Math.tan(top) - dist * Math.sin(polar);
      const side = (height / Math.cos(top)) * Math.tan(hHalf);
      return Math.hypot(far, side) <= room;
    };
    let lo = 0;
    let hi = MAX_TILT;
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function clampTarget(dist: number) {
    const half = dist * tanHalf * Math.max(camera.aspect, 1);
    const t = controls.target;
    const mx = W / 2 - half * 0.95;
    const mz = H / 2 - half * 0.95;
    const cx = THREE.MathUtils.clamp(t.x, -Math.max(mx, 0), Math.max(mx, 0));
    const cz = THREE.MathUtils.clamp(t.z, -Math.max(mz, 0), Math.max(mz, 0));
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x;
      camera.position.z += cz - t.z;
      t.set(cx, t.y, cz);
    }
    // Keep the orbit point on the ground so rotating and tilting feel anchored
    const gy = Math.max(ground(t.x, -t.z), 0);
    camera.position.y += gy - t.y;
    t.y = gy;
  }

  // ---------------------------------------------------------------- shadows follow the view
  let shadowDirty = true;
  let lastShadow = { x: 1e9, z: 1e9, half: 0 };
  function updateShadows(dist: number) {
    // Re-render the shadow map only once the view settles: gestures stay smooth
    if (flight || performance.now() - lastMove < 160) return;
    const half = THREE.MathUtils.clamp(dist * 1.1, 30, 560);
    const t = controls.target;
    const moved = Math.hypot(t.x - lastShadow.x, t.z - lastShadow.z);
    if (!shadowDirty && moved < lastShadow.half * 0.35 && Math.abs(half / lastShadow.half - 1) < 0.35) return;
    shadowDirty = false;
    lastShadow = { x: t.x, z: t.z, half };
    sun.target.position.set(t.x, 0, t.z);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, half * 3);
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: half * 0.5, far: half * 6 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
  }

  // ---------------------------------------------------------------- resize + loop
  let heading = 0;
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    lineMats.forEach((m) => m.resolution.set(w, h));
    labelLayer.resize(w, h);
    updateBounds();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  const start = home();
  controls.target.copy(start.target);
  camera.position.copy(start.position);
  controls.update();

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;
    if (flight) stepFlight(now);
    else controls.update();

    const dist = camera.position.distanceTo(controls.target);
    clampTarget(dist);
    controls.maxPolarAngle = Math.max(MIN_TILT, maxTiltFor(dist, controls.target));
    camera.near = THREE.MathUtils.clamp(dist * 0.01, 0.05, 25);
    camera.far = dist * 5 + 1200;
    camera.updateProjectionMatrix();
    (scene.fog as THREE.Fog).near = dist * 1.3 + 150;
    (scene.fog as THREE.Fog).far = dist * 4 + 600;

    if (!reducedMotion) {
      waterUniforms.uTime.value = time;
      for (const c of clouds) {
        c.mesh.position.x += c.speed * dt;
        if (c.mesh.position.x > sky.maxX) c.mesh.position.x -= skyW;
      }
      updateBirds(time, dt);
      updateBoats(time, dt);
      for (const beam of beams) beam.rotation.y += dt * 0.9;
      const p = (time % 2.2) / 2.2;
      for (const pulse of pulses) {
        pulse.scale.setScalar(1 + p * 1.4);
        pulse.material.opacity = 0.85 * (1 - p);
      }
    }
    // Clouds thin out as you dive in so they never hide detail
    cloudMat.opacity = 0.92 * THREE.MathUtils.clamp((dist - 160) / 260, 0, 1);
    clouds.forEach((c) => (c.mesh.visible = cloudMat.opacity > 0.01));
    countyMat.opacity = THREE.MathUtils.clamp((520 - dist) / 260, 0, 0.5);
    waterUniforms.uFar.value = THREE.MathUtils.clamp((dist - 50) / 150, 0, 1);

    // Heading from the camera itself, so the compass also turns during animated flights
    const az = THREE.MathUtils.radToDeg(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z));
    const newHeading = (((-az % 360) + 360) % 360);
    if (Math.abs(newHeading - heading) > 0.3) {
      heading = newHeading;
      opts.onHeading?.(heading);
    }

    updateShadows(dist);
    if (labelsBuilt) labelLayer.update(dist, dt, labelVisible(dist));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    zoomBy(factor) {
      const v = currentView();
      flyTo({ dist: THREE.MathUtils.clamp(v.dist * factor, controls.minDistance, controls.maxDistance) }, 450);
    },
    reset() {
      const h = home();
      flyTo({ target: h.target, dist: h.position.distanceTo(h.target), polar: 0.001, azimuth: 0 }, 1200);
    },
    setHeading(deg) {
      flyTo({ azimuth: THREE.MathUtils.degToRad(-deg) }, 650);
    },
    focusPlace(name) {
      const p = data.places.find((q) => q.name === name);
      if (p) focusPlace(p);
    },
    viewAt(x, y, dist) {
      flyTo({ target: new THREE.Vector3(x, Math.max(ground(x, y), 0), -y), dist, polar: 0.5 }, 0);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onHover);
      container.removeEventListener("wheel", onWheel, { capture: true });
      controls.stopListenToKeyEvents();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.dispose();
    },
  };

  // ---------------------------------------------------------------- geometry helpers
  function blobs(spheres: [number, number, number, number][]) {
    return mergeGeometries(spheres.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)));
  }

  /** Unit gable roof: 1 wide (x), 1 deep (z), 1 tall, ridge along x, base at y = 0 */
  function gableRoof() {
    const v = [
      [-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 1, 0], [-0.5, 1, 0],
      [-0.5, 0, 0.5], [0.5, 0, 0.5],
    ];
    const tri = (a: number, b: number, c: number) => [...v[a], ...v[b], ...v[c]];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([
      ...tri(0, 3, 1), ...tri(1, 3, 2), // north slope
      ...tri(4, 5, 3), ...tri(5, 2, 3), // south slope
      ...tri(0, 4, 3), ...tri(1, 2, 5), // gable ends
    ], 3));
    g.computeVertexNormals();
    return g;
  }

  /** Flat ribbon along a polyline, lifted `lift` above the terrain */
  function ribbon(flat: Ring, width: number, lift: number) {
    const pts: THREE.Vector2[] = [];
    forPoints(flat, (x, y) => pts.push(new THREE.Vector2(x, y)));
    const p: number[] = [];
    const idx: number[] = [];
    const dir = new THREE.Vector2();
    pts.forEach((pt, i) => {
      dir.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      const nx = (-dir.y * width) / 2;
      const ny = (dir.x * width) / 2;
      const h = Math.max(ground(pt.x, pt.y), 0) + lift;
      p.push(pt.x + nx, h, -(pt.y + ny), pt.x - nx, h, -(pt.y - ny));
      if (i > 0) {
        const a = 2 * (i - 1);
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** Segment pairs [x0,y0,z0, x1,y1,z1, ...] along polylines, draped over the terrain */
  function drapedSegments(rings: Ring[], lift: number) {
    const p: number[] = [];
    for (const ring of rings) {
      let prev: [number, number, number] | null = null;
      forPoints(ring, (x, y) => {
        const cur: [number, number, number] = [x, Math.max(ground(x, y), 0) + lift, -y];
        if (prev) p.push(...prev, ...cur);
        prev = cur;
      });
    }
    return p;
  }
}

function forPoints(flat: Ring, fn: (x: number, y: number) => void) {
  for (let i = 0; i < flat.length; i += 2) fn(flat[i], flat[i + 1]);
}

function toShape([outer, ...holes]: Polygon) {
  const pts = (flat: Ring) => {
    const out: THREE.Vector2[] = [];
    forPoints(flat, (x, y) => out.push(new THREE.Vector2(x, y)));
    if (out.length > 2 && out[0].equals(out[out.length - 1])) out.pop();
    return out;
  };
  const shape = new THREE.Shape(pts(outer));
  holes.forEach((h) => shape.holes.push(new THREE.Path(pts(h))));
  return shape;
}
