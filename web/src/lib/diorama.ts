// 3D diorama map of Wisconsin and Lake Michigan (three.js).
// Basemap coordinates are kilometres (x = east, y = north). In the scene, north points to -z and height is +y.

import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Basemap, Polygon, Ring } from "./basemap";

export interface DioramaController {
  zoomBy(factor: number): void;
  reset(): void;
  dispose(): void;
}

interface DioramaOptions {
  container: HTMLElement;
  labelLayer: HTMLElement;
  map: Basemap;
  reducedMotion: boolean;
  onFirstInteraction?: () => void;
}

// Vertical scale is exaggerated so the land reads as a raised diorama
const HEIGHT = { neighbor: 2.2, land: 4.5, slab: 18 };
const COLORS = {
  neighborTop: 0xe6c591,
  neighborSide: 0xcf9a63,
  landSide: 0xb7804f,
  slab: 0xc98f5c,
  foam: 0xf7fbff,
  river: 0x5f8fd8,
  lake: 0x6f9fe0,
  county: 0x2e5e4a,
  trunk: 0x7b4a33,
  birchTrunk: 0xf1ede4,
  oaks: [0x3f774f, 0x2e5e4a, 0x4f8a45, 0x5f9a4a, 0x46804a],
  birches: [0x86b84a, 0x9cc457, 0x6a9e3f],
  pin: 0xe0703a,
  wood: 0x8a5532,
};

// Tailwind classes for the HTML labels pinned to 3D points
const LABEL_CLASSES = {
  water: "font-display text-2xl font-semibold italic text-foam [text-shadow:0_2px_6px_rgb(75_79_147/.35)]",
  bay: "font-display text-[15px] font-semibold italic text-foam [text-shadow:0_1px_4px_rgb(75_79_147/.4)]",
  state:
    "font-display text-[26px] font-extrabold uppercase tracking-[.3em] text-leaf-700 [text-shadow:0_0_6px_#e6efb0,0_0_2px_#e6efb0]",
  neighbor: "font-display text-sm font-semibold tracking-[.08em] text-neighbor-ink",
  county:
    "font-body text-[11px] font-extrabold uppercase tracking-[.08em] text-leaf-700 [text-shadow:0_0_4px_#eef4c4,0_0_2px_#eef4c4]",
  city:
    "rounded-lg bg-[linear-gradient(180deg,var(--color-wood-light)_0_12%,var(--color-wood)_12%)] px-[11px] pt-1 pb-[5px] font-display text-[15px] font-bold text-[#fff7ea] shadow-[0_3px_0_var(--color-wood-dark),0_6px_12px_rgb(75_79_147/.3)]",
} as const;
type LabelClass = keyof typeof LABEL_CLASSES;

export function createDiorama({ container, labelLayer, map, reducedMotion, onFirstInteraction }: DioramaOptions): DioramaController {
  const W = map.frame.width;
  const H = map.frame.height;
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // ---------- Renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "block size-full outline-none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf3d9dc, 1700, 3600);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 8000);
  // Starting view: whole diorama on wide screens; on tall, narrow screens favour the lakeshore cities
  const narrow = container.clientWidth / Math.max(container.clientHeight, 1) < 0.8;
  const home = narrow
    ? { target: new THREE.Vector3(10, 0, 30), position: new THREE.Vector3(30, 1250, 1080) }
    : { target: new THREE.Vector3(-60, 0, 30), position: new THREE.Vector3(10, 900, 850) };
  camera.position.copy(home.position);

  const controls = new MapControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minDistance = 22;
  controls.maxDistance = 1500;
  controls.maxPolarAngle = 1.3;
  controls.zoomSpeed = 1.2;

  // ---------- Lights: warm sun from the upper left, cool lavender fill ----------
  scene.add(new THREE.HemisphereLight(0xd8d2ff, 0xf2d3a5, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
  sun.position.set(-420, 620, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -560, right: 560, top: 560, bottom: -560, near: 10, far: 2400 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);

  // ---------- Materials ----------
  const ramp = track(new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat));
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const toon = (opts: THREE.MeshToonMaterialParameters) =>
    track(new THREE.MeshToonMaterial({ gradientMap: ramp, ...opts }));

  // Deterministic randomness so the scene looks the same every load
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = false) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    draw(canvas.getContext("2d")!, size);
    const tex = track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  const add = <T extends THREE.Object3D>(obj: T): T => {
    scene.add(obj);
    return obj;
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[]) => add(new THREE.Mesh(track(geo), mat));

  // ---------- Diorama slab + water ----------
  const slab = mesh(new THREE.BoxGeometry(W, HEIGHT.slab, H), toon({ color: COLORS.slab }));
  slab.position.y = -HEIGHT.slab / 2 - 0.05;

  const waterTex = canvasTexture(1024, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s * 0.4, s);
    g.addColorStop(0, "#86b6ee");
    g.addColorStop(0.55, "#5888d8");
    g.addColorStop(1, "#3f66ba");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  const water = mesh(new THREE.PlaneGeometry(W, H), toon({ map: waterTex }));
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;

  // Drifting wave marks: a transparent, tiling overlay just above the water
  const waveTex = canvasTexture(
    512,
    (ctx, s) => {
      ctx.strokeStyle = "rgba(247, 251, 255, 0.55)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 0; i < 22; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const w = 14 + rand() * 10;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x - w / 2, y - 7, x, y);
        ctx.quadraticCurveTo(x + w / 2, y + 7, x + w, y);
        ctx.stroke();
      }
    },
    true,
  );
  waveTex.repeat.set(W / 70, H / 70);
  const waves = mesh(
    new THREE.PlaneGeometry(W, H),
    track(new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, depthWrite: false })),
  );
  waves.rotation.x = -Math.PI / 2;
  waves.position.y = 0.06;

  // ---------- Land ----------
  const neighbors = mesh(extrude(map.neighbors, HEIGHT.neighbor), [
    toon({ color: COLORS.neighborTop }),
    toon({ color: COLORS.neighborSide }),
  ]);
  neighbors.receiveShadow = true;

  // Wisconsin's top is painted in world space: forest green in the north fading to patchwork farmland in the south
  const landTex = canvasTexture(2048, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0.0, "#55904a");
    g.addColorStop(0.45, "#76a84f");
    g.addColorStop(0.75, "#a6c95e");
    g.addColorStop(1.0, "#c9d872");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const fields = ["#e9d47c", "#b7d064", "#d8c96e", "#9fc25a", "#ecd890"];
    for (let i = 0; i < 2600; i++) {
      const y = s * (0.35 + 0.65 * Math.sqrt(rand()));
      const x = rand() * s;
      const south = (y / s - 0.35) / 0.65;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.42 + (rand() - 0.5) * 0.3);
      ctx.globalAlpha = 0.18 + 0.4 * south;
      ctx.fillStyle = fields[Math.floor(rand() * fields.length)];
      ctx.fillRect(0, 0, 10 + rand() * 22, 6 + rand() * 12);
      ctx.restore();
    }
  });
  landTex.repeat.set(1 / W, 1 / H);
  landTex.offset.set(0.5, 0.5);
  const wisconsin = mesh(extrude(map.wisconsin, HEIGHT.land), [toon({ map: landTex }), toon({ color: COLORS.landSide })]);
  wisconsin.castShadow = true;
  wisconsin.receiveShadow = true;

  // Foam where land meets the lake
  const foamMat = track(new THREE.MeshBasicMaterial({ color: COLORS.foam, transparent: true, opacity: 0.75, depthWrite: false }));
  mesh(mergeGeometries([...map.wisconsin, ...map.neighbors].map((poly) => ribbon(poly[0], 2.6, 0.1, true))), foamMat);

  // Inland lakes and rivers on top of Wisconsin
  const lakeGeo = new THREE.ShapeGeometry(map.lakes.map(toShape));
  lakeGeo.rotateX(-Math.PI / 2);
  lakeGeo.translate(0, HEIGHT.land + 0.06, 0);
  mesh(lakeGeo, toon({ color: COLORS.lake })).receiveShadow = true;
  mesh(mergeGeometries(map.rivers.map((line) => ribbon(line, 1.4, HEIGHT.land + 0.05))), toon({ color: COLORS.river }));

  // County borders: fade in as you zoom closer
  const countyPos: number[] = [];
  for (const county of map.counties) {
    for (const poly of county.rings) {
      const pts = ringPoints(poly[0]);
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length];
        countyPos.push(a.x, HEIGHT.land + 0.08, -a.y, b.x, HEIGHT.land + 0.08, -b.y);
      });
    }
  }
  const countyGeo = track(new THREE.BufferGeometry());
  countyGeo.setAttribute("position", new THREE.Float32BufferAttribute(countyPos, 3));
  const countyMat = track(new THREE.LineBasicMaterial({ color: COLORS.county, transparent: true, opacity: 0 }));
  add(new THREE.LineSegments(countyGeo, countyMat));

  // ---------- Trees (instanced, cel-shaded) ----------
  const treeKinds = [
    {
      canopy: blobs([[0, 2.7, 0, 1.5], [-0.95, 2.15, 0.35, 1.05], [0.95, 2.2, -0.3, 1.1], [0.15, 3.45, 0.2, 0.95]]),
      trunk: new THREE.CylinderGeometry(0.2, 0.3, 1.9, 6).translate(0, 0.95, 0),
      trunkColor: COLORS.trunk,
      palette: COLORS.oaks,
    },
    {
      canopy: blobs([[0, 3.3, 0, 1.05], [-0.6, 2.8, 0.25, 0.8], [0.55, 2.9, -0.2, 0.8], [0, 4.0, 0, 0.7]]),
      trunk: new THREE.CylinderGeometry(0.15, 0.2, 2.8, 6).translate(0, 1.4, 0),
      trunkColor: COLORS.birchTrunk,
      palette: COLORS.birches,
    },
  ];
  const treesByKind: [number, number, number][][] = [[], []];
  for (let i = 0; i < map.trees.length; i += 4) {
    treesByKind[map.trees[i + 3]].push([map.trees[i], map.trees[i + 1], map.trees[i + 2]]);
  }
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  treeKinds.forEach((kind, k) => {
    const list = treesByKind[k];
    const canopy = new THREE.InstancedMesh(track(kind.canopy), toon({ color: 0xffffff }), list.length);
    const trunk = new THREE.InstancedMesh(track(kind.trunk), toon({ color: kind.trunkColor }), list.length);
    list.forEach(([x, y, s], i) => {
      dummy.position.set(x, HEIGHT.land, -y);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      canopy.setMatrixAt(i, dummy.matrix);
      trunk.setMatrixAt(i, dummy.matrix);
      canopy.setColorAt(i, color.setHex(kind.palette[Math.floor(rand() * kind.palette.length)]));
    });
    for (const m of [canopy, trunk]) {
      m.castShadow = true;
      m.receiveShadow = true;
      add(m);
    }
  });

  // ---------- Clouds drifting over the lake ----------
  const cloudMat = toon({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const clouds: { mesh: THREE.Mesh; speed: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const n = 4 + Math.floor(rand() * 3);
    const puffs: [number, number, number, number][] = [];
    for (let b = 0; b < n; b++) puffs.push([(b - n / 2) * 9, rand() * 4, (rand() - 0.5) * 8, 7 + rand() * 6]);
    const cloud = mesh(blobs(puffs), cloudMat);
    cloud.scale.y = 0.55;
    cloud.position.set((rand() - 0.5) * W, 120 + rand() * 40, (rand() - 0.5) * H);
    clouds.push({ mesh: cloud, speed: 2 + rand() * 3 });
  }

  // ---------- Cities: signpost, pin and pulsing ring ----------
  const pulses: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  const postMat = toon({ color: COLORS.wood });
  const pinMat = toon({ color: COLORS.pin });
  for (const city of map.cities) {
    const post = mesh(new THREE.BoxGeometry(0.7, 9, 0.7), postMat);
    post.position.set(city.x, HEIGHT.land + 4.5, -city.y);
    post.castShadow = true;
    mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 24), pinMat).position.set(city.x, HEIGHT.land + 0.3, -city.y);
    const pulse = new THREE.Mesh(
      track(new THREE.RingGeometry(1.6, 2.4, 32).rotateX(-Math.PI / 2)),
      track(new THREE.MeshBasicMaterial({ color: COLORS.pin, transparent: true, depthWrite: false })),
    );
    pulse.position.set(city.x, HEIGHT.land + 0.35, -city.y);
    pulses.push(add(pulse));
  }

  // ---------- HTML labels pinned to 3D points ----------
  const labels: { el: HTMLDivElement; kind: LabelClass; point: THREE.Vector3; visible: boolean }[] = [];
  function addLabel(text: string, kind: LabelClass, point: THREE.Vector3) {
    const el = document.createElement("div");
    el.className = `pointer-events-none absolute top-0 left-0 whitespace-nowrap opacity-0 transition-opacity duration-200 will-change-transform ${LABEL_CLASSES[kind]}`;
    el.textContent = text;
    labelLayer.appendChild(el);
    labels.push({ el, kind, point, visible: false });
  }
  const labelHeight = { water: 0.5, bay: 0.5, state: HEIGHT.land, neighbor: HEIGHT.neighbor };
  map.labels.forEach((l) => addLabel(l.text, l.kind, new THREE.Vector3(l.x, labelHeight[l.kind], -l.y)));
  map.counties.forEach((c) => {
    if (!map.cities.some((city) => city.county === c.name)) {
      addLabel(c.name, "county", new THREE.Vector3(c.label.x, HEIGHT.land + 0.5, -c.label.y));
    }
  });
  map.cities.forEach((c) => addLabel(c.name, "city", new THREE.Vector3(c.x, HEIGHT.land + 9.5, -c.y)));

  const projected = new THREE.Vector3();
  function updateLabels(distance: number) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    // Zoom tiers: counties appear when close; the state and neighbor names step back
    const tier: Partial<Record<LabelClass, number>> = {
      county: THREE.MathUtils.clamp((300 - distance) / 90, 0, 1),
      state: THREE.MathUtils.clamp((distance - 160) / 120, 0, 1),
      neighbor: THREE.MathUtils.clamp((distance - 120) / 120, 0, 1),
    };
    for (const label of labels) {
      projected.copy(label.point).project(camera);
      const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      const opacity = onScreen ? (tier[label.kind] ?? 1) : 0;
      if (opacity <= 0.01) {
        if (label.visible) {
          label.el.style.opacity = "0";
          label.visible = false;
        }
        continue;
      }
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      label.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${label.kind === "city" ? "-100%" : "-50%"})`;
      label.el.style.opacity = String(opacity);
      label.visible = true;
    }
  }

  // ---------- Camera behaviour ----------
  // Keep the camera over the diorama
  const clampTarget = () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, -W / 2, W / 2);
    const cz = THREE.MathUtils.clamp(t.z, -H / 2, H / 2);
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x;
      camera.position.z += cz - t.z;
      t.set(cx, t.y, cz);
    }
  };
  controls.addEventListener("change", clampTarget);
  const handleStart = () => {
    onFirstInteraction?.();
    controls.removeEventListener("start", handleStart);
  };
  controls.addEventListener("start", handleStart);

  let flight: { from: { p: THREE.Vector3; t: THREE.Vector3 }; to: { p: THREE.Vector3; t: THREE.Vector3 }; start: number; ms: number } | null = null;
  function flyTo(position: THREE.Vector3, target: THREE.Vector3, ms = 700) {
    flight = {
      from: { p: camera.position.clone(), t: controls.target.clone() },
      to: { p: position, t: target },
      start: performance.now(),
      ms: reducedMotion ? 0 : ms,
    };
  }

  // ---------- Resize + render loop ----------
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(clock.getDelta(), 0.1);

    if (flight) {
      const t = flight.ms ? Math.min((now - flight.start) / flight.ms, 1) : 1;
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(flight.from.p, flight.to.p, e);
      controls.target.lerpVectors(flight.from.t, flight.to.t, e);
      if (t === 1) flight = null;
    }
    controls.update();

    if (!reducedMotion) {
      waveTex.offset.x += dt * 0.012;
      waveTex.offset.y += dt * 0.004;
      for (const cloud of clouds) {
        cloud.mesh.position.x += cloud.speed * dt;
        if (cloud.mesh.position.x > W / 2 + 40) cloud.mesh.position.x = -W / 2 - 40;
      }
      const p = ((now / 1000) % 2.2) / 2.2;
      for (const pulse of pulses) {
        pulse.scale.setScalar(1 + p * 2.2);
        pulse.material.opacity = 0.8 * (1 - p);
      }
    }

    const distance = camera.position.distanceTo(controls.target);
    countyMat.opacity = THREE.MathUtils.clamp((420 - distance) / 200, 0, 0.6);
    // Clouds thin out as you dive in, so they never block the details
    cloudMat.opacity = 0.9 * THREE.MathUtils.clamp((distance - 380) / 300, 0, 1);
    for (const cloud of clouds) cloud.mesh.visible = cloudMat.opacity > 0.01;
    updateLabels(distance);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    zoomBy(factor) {
      const offset = camera.position.clone().sub(controls.target);
      const dist = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
      flyTo(controls.target.clone().add(offset.setLength(dist)), controls.target.clone(), 450);
    },
    reset() {
      flyTo(home.position.clone(), home.target.clone());
    },
    dispose() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.removeEventListener("change", clampTarget);
      controls.removeEventListener("start", handleStart);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labels.forEach((l) => l.el.remove());
    },
  };

  // ---------- Geometry helpers ----------
  function extrude(polys: Polygon[], depth: number) {
    const geo = new THREE.ExtrudeGeometry(polys.map(toShape), { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function blobs(spheres: [number, number, number, number][]) {
    return mergeGeometries(
      spheres.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)),
    );
  }

  // Flat ribbon along a polyline (rivers, foam), lying at height h
  function ribbon(flat: Ring, width: number, h: number, closed = false) {
    const pts = ringPoints(flat);
    if (closed) pts.push(pts[0]);
    const pos: number[] = [];
    const idx: number[] = [];
    const dir = new THREE.Vector2();
    pts.forEach((p, i) => {
      dir.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      const nx = (-dir.y * width) / 2;
      const ny = (dir.x * width) / 2;
      pos.push(p.x + nx, h, -(p.y + ny), p.x - nx, h, -(p.y - ny));
      if (i > 0) {
        const a = 2 * (i - 1);
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
}

function ringPoints(flat: Ring) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (pts.length > 2 && pts[0].equals(pts[pts.length - 1])) pts.pop();
  return pts;
}

function toShape([outer, ...holes]: Polygon) {
  const shape = new THREE.Shape(ringPoints(outer));
  holes.forEach((h) => shape.holes.push(new THREE.Path(ringPoints(h))));
  return shape;
}
