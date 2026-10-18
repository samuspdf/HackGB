// Map labels drawn inside the WebGL scene (not an HTML overlay), so text and terrain are rendered
// in the same frame and can never drift apart. Each label is a camera-facing sprite whose on-screen
// size eases down slightly as you zoom in; labels that would collide fade out smoothly.

import * as THREE from "three";

export type LabelKind = "water" | "bay" | "state" | "neighbor" | "county" | "sign" | "facility";

interface Style {
  family: "display" | "body";
  weight: number;
  italic?: boolean;
  size: number; // px at full size
  color: string;
  glow?: string;
  shadow?: string;
  upper?: boolean;
  spacing?: number; // em
}

const STYLES: Record<LabelKind, Style> = {
  water: { family: "display", weight: 600, italic: true, size: 24, color: "#f7fbff", shadow: "rgba(40,60,120,.5)" },
  bay: { family: "display", weight: 600, italic: true, size: 15, color: "#f7fbff", shadow: "rgba(40,60,120,.55)" },
  state: { family: "display", weight: 800, size: 26, color: "#2e5e4a", glow: "#e6efb0", upper: true, spacing: 0.3 },
  neighbor: { family: "display", weight: 600, size: 14, color: "#8a6238", glow: "#f3e6c4", spacing: 0.08 },
  county: { family: "body", weight: 800, size: 11, color: "rgba(46,94,74,.85)", glow: "#eef4c4", upper: true, spacing: 0.08 },
  sign: { family: "display", weight: 700, size: 15, color: "#fff7ea" },
  facility: { family: "display", weight: 700, size: 14, color: "#fff7ea" },
};
// Board colours (edge lip, face) for the labels drawn on a sign
const BOARDS: Partial<Record<LabelKind, { lip: string; top: string; face: string }>> = {
  sign: { lip: "#7b4a33", top: "#b8723f", face: "#a8653b" },
  facility: { lip: "#a8461f", top: "#f08a48", face: "#e0703a" },
};
const PRIORITY: Record<LabelKind, number> = { facility: 6, sign: 5, water: 4, state: 3, bay: 2, neighbor: 2, county: 1 };
const TEXTURE_SCALE = 3; // draw text at 3x for crisp edges on Retina screens

export interface MapLabel<T = unknown> {
  sprite: THREE.Sprite;
  kind: LabelKind;
  /** Size in px at full scale */
  px: { w: number; h: number };
  opacity: number;
  data?: T;
}

export function createLabelLayer<T>(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const css = getComputedStyle(document.documentElement);
  const families = {
    display: css.getPropertyValue("--font-fraunces").trim() || "Georgia, serif",
    body: css.getPropertyValue("--font-nunito").trim() || "system-ui, sans-serif",
  };
  const fontOf = (s: Style, scale = 1) => `${s.italic ? "italic " : ""}${s.weight} ${s.size * scale}px ${families[s.family]}`;
  const fontsReady = Promise.all(
    Object.values(STYLES).map((s) => document.fonts.load(fontOf(s)).catch(() => [])),
  );

  const labels: MapLabel<T>[] = [];
  let viewportH = 1;
  let viewportW = 1;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  function draw(text: string, kind: LabelKind) {
    const s = STYLES[kind];
    const k = TEXTURE_SCALE;
    const str = s.upper ? text.toUpperCase() : text;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = fontOf(s, k);
    const gap = (s.spacing ?? 0) * s.size * k;
    const chars = [...str];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const textW = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    const board = BOARDS[kind];
    const sign = !!board;
    const padX = (sign ? 11 : 6) * k;
    const padY = (sign ? 5 : 4) * k;
    const lineH = s.size * 1.25 * k;
    canvas.width = Math.ceil(textW + padX * 2);
    canvas.height = Math.ceil(lineH + padY * 2 + (sign ? 3 * k : 0));
    ctx.font = fontOf(s, k);
    ctx.textBaseline = "middle";
    const midY = padY + lineH / 2;

    if (board) {
      // Painted board: dark lip underneath, lighter top edge
      const w = canvas.width;
      const h = canvas.height - 3 * k;
      const r = 8 * k;
      ctx.fillStyle = board.lip;
      roundRect(ctx, 0, 3 * k, w, h, r);
      ctx.fill();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, board.top);
      grad.addColorStop(0.12, board.top);
      grad.addColorStop(0.12, board.face);
      grad.addColorStop(1, board.face);
      ctx.fillStyle = grad;
      roundRect(ctx, 0, 0, w, h, r);
      ctx.fill();
    }

    const drawText = () => {
      let x = padX;
      chars.forEach((c, i) => {
        ctx.fillText(c, x, midY);
        x += widths[i] + gap;
      });
    };
    if (s.glow) {
      ctx.fillStyle = s.glow;
      ctx.shadowColor = s.glow;
      ctx.shadowBlur = 6 * k;
      for (let i = 0; i < 3; i++) drawText();
    }
    if (s.shadow) {
      ctx.shadowColor = s.shadow;
      ctx.shadowBlur = 6 * k;
      ctx.shadowOffsetY = 2 * k;
    }
    ctx.fillStyle = s.color;
    drawText();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    return { tex, w: canvas.width / k, h: canvas.height / k };
  }

  return {
    ready: fontsReady,
    labels,

    add(text: string, kind: LabelKind, position: THREE.Vector3, data?: T) {
      const { tex, w, h } = draw(text, kind);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(position);
      if (BOARDS[kind]) sprite.center.set(0.5, 0); // boards sit on top of their post / building
      sprite.renderOrder = 1000 + PRIORITY[kind];
      sprite.visible = false;
      scene.add(sprite);
      const label: MapLabel<T> = { sprite, kind, px: { w, h }, opacity: 0, data };
      labels.push(label);
      labels.sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind]);
      return label;
    },

    resize(width: number, height: number) {
      viewportW = width;
      viewportH = Math.max(height, 1);
    },

    /** visible(kind) says which kinds belong at this zoom; dt drives the fades */
    update(dist: number, dt: number, visible: (kind: LabelKind) => boolean) {
      // Text eases down to ~72% of its size as you zoom in, so it never crowds close-up detail
      const t = THREE.MathUtils.clamp((Math.log(dist) - Math.log(15)) / (Math.log(1200) - Math.log(15)), 0, 1);
      const zoomScale = 0.72 + 0.28 * t;
      const toWorld = (2 * tanHalf) / viewportH; // px → sprite scale (sizeAttenuation off)
      const placed: number[] = [];
      const p = new THREE.Vector3();
      const fade = Math.min(1, dt * 9);
      for (const l of labels) {
        const w = l.px.w * zoomScale;
        const h = l.px.h * zoomScale;
        l.sprite.scale.set(w * toWorld, h * toWorld, 1);
        let want = visible(l.kind);
        if (want) {
          p.copy(l.sprite.position).project(camera);
          want = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
          if (want) {
            // Screen-space box; higher-priority labels claim space first
            const sx = (p.x * 0.5 + 0.5) * viewportW;
            const sy = (-p.y * 0.5 + 0.5) * viewportH - (BOARDS[l.kind] ? h / 2 : 0);
            const hw = w / 2 + 3;
            const hh = h / 2 + 2;
            for (let b = 0; b < placed.length && want; b += 4) {
              if (Math.abs(sx - placed[b]) < hw + placed[b + 2] && Math.abs(sy - placed[b + 1]) < hh + placed[b + 3]) want = false;
            }
            if (want) placed.push(sx, sy, hw, hh);
          }
        }
        l.opacity += ((want ? 1 : 0) - l.opacity) * fade;
        if (l.opacity < 0.01 && !want) l.opacity = 0;
        (l.sprite.material as THREE.SpriteMaterial).opacity = l.opacity;
        l.sprite.visible = l.opacity > 0;
      }
    },

    /** Labels under a ray that carry data (clickable) */
    pick(raycaster: THREE.Raycaster) {
      const hits = raycaster.intersectObjects(labels.filter((l) => l.data && l.sprite.visible).map((l) => l.sprite), false);
      return hits.length ? labels.find((l) => l.sprite === hits[0].object) : undefined;
    },

    dispose() {
      for (const l of labels) {
        const mat = l.sprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
        scene.remove(l.sprite);
      }
      labels.length = 0;
    },
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
