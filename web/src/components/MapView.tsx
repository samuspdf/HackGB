"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createLakeshoreMap, type MapController } from "@/lib/lakeshoreMap";
import { loadMap, type Place } from "@/lib/scene";

// WebGL support never changes during a visit; null while prerendering on the server
let webglSupport: boolean | undefined;
const hasWebGL = () =>
  (webglSupport ??= (() => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  })());
const noSubscribe = () => () => {};

const gutter = "clamp(12px,2vw,24px)";
const chip =
  "grid cursor-pointer place-items-center rounded-[14px] bg-sand-50 text-ink shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-sand-300)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lake-500";
const icon = "size-5 fill-none stroke-current stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]";
const DIRECTIONS = [
  { label: "N", deg: 0, name: "north" },
  { label: "E", deg: 90, name: "east" },
  { label: "S", deg: 180, name: "south" },
  { label: "W", deg: 270, name: "west" },
];

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, () => null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [focused, setFocused] = useState<Place | null>(null);
  const [source, setSource] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!webgl || !container) return;
    let cancelled = false;
    loadMap()
      .then((map) => {
        if (cancelled) return;
        controllerRef.current = createLakeshoreMap({
          container,
          map,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          // Written straight to a CSS variable: no React re-render on every frame while rotating
          onHeading: (deg) => compassRef.current?.style.setProperty("--heading", `${deg}deg`),
          onFocus: setFocused,
          onFirstInteraction: () => setShowHint(false),
        });
        setSource(map.data.source);
        setLoaded(true);
        // Shareable links: ?focus=Green%20Bay flies to a place, ?heading=90 puts east at the top,
        // ?view=x,y,dist jumps to map coordinates in km
        const params = new URLSearchParams(window.location.search);
        const focus = params.get("focus");
        const heading = Number(params.get("heading"));
        const view = params.get("view")?.split(",").map(Number);
        if (view?.length === 3 && view.every(Number.isFinite)) controllerRef.current.viewAt(view[0], view[1], view[2]);
        if (heading) controllerRef.current.setHeading(heading);
        if (focus) controllerRef.current.focusPlace(focus);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [webgl]);

  const status = webgl === false
    ? "This map needs WebGL, which isn't available in this browser."
    : failed
      ? "The map data couldn't be loaded."
      : loaded
        ? null
        : "Loading the map…";

  return (
    <>
      <div
        ref={containerRef}
        role="application"
        aria-label="3D map of Wisconsin and Lake Michigan. Drag to move, scroll to zoom, click a city to fly there."
        className="fixed inset-0 z-[1] cursor-grab touch-none active:cursor-grabbing"
      />

      {status && (
        <p className="fixed top-1/2 left-1/2 z-[4] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sand-50 px-5 py-4 text-center text-sm font-semibold text-ink-soft shadow-[0_4px_0_var(--color-sand-300)]">
          {status}
        </p>
      )}

      {/* Compass: shows where north is; N / E / S / W turn that direction to the top */}
      <div
        ref={compassRef}
        className="fixed z-[3] size-[92px] rounded-full bg-sand-50/90 shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] backdrop-blur [--heading:0deg]"
        style={{ top: gutter, right: gutter }}
      >
          <div className="absolute inset-0 rotate-[calc(-1*var(--heading))]">
            <svg viewBox="0 0 92 92" aria-hidden="true" className="absolute inset-0">
              <circle cx="46" cy="46" r="30" fill="none" stroke="var(--color-sand-300)" strokeWidth="1.5" strokeDasharray="2 4" />
              <path d="M46 22 L52 46 L46 42 L40 46 Z" fill="var(--color-autumn-700)" />
              <path d="M46 70 L40 46 L46 50 L52 46 Z" fill="var(--color-ink-soft)" opacity=".55" />
            </svg>
            {DIRECTIONS.map((d) => (
              <button
                key={d.label}
                type="button"
                aria-label={`Turn ${d.name} to the top`}
                onClick={() => controllerRef.current?.setHeading(d.deg)}
                className={`absolute top-1/2 left-1/2 grid size-6 cursor-pointer place-items-center rounded-full font-display text-[13px] font-extrabold hover:bg-white focus-visible:outline-2 focus-visible:outline-lake-500 ${d.label === "N" ? "text-autumn-700" : "text-ink"}`}
                style={{ transform: `translate(-50%,-50%) rotate(${d.deg}deg) translateY(-34px) rotate(calc(var(--heading) - ${d.deg}deg))` }}
              >
                {d.label}
              </button>
            ))}
        </div>
      </div>

      {/* Zoom + reset */}
      <div
        role="toolbar"
        aria-label="Map controls"
        className="fixed z-[3] flex flex-col gap-2"
        style={{ right: gutter, bottom: `calc(${gutter} + 40px)` }}
      >
        <button type="button" aria-label="Zoom in" className={`${chip} size-11`} onClick={() => controllerRef.current?.zoomBy(0.5)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={icon}><path d="M10 4v12M4 10h12" /></svg>
        </button>
        <button type="button" aria-label="Zoom out" className={`${chip} size-11`} onClick={() => controllerRef.current?.zoomBy(2)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={icon}><path d="M4 10h12" /></svg>
        </button>
        <button type="button" aria-label="Back to all of Wisconsin" className={`${chip} size-11`} onClick={() => controllerRef.current?.reset()}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={icon}><path d="M4.5 9a6 6 0 1 1 1.8 5.3M4.5 4v5h5" /></svg>
        </button>
      </div>

      {/* Card for the place you flew to */}
      {focused && (
        <section
          aria-live="polite"
          className="fixed z-[3] w-[min(300px,calc(100vw-120px))] rounded-2xl bg-sand-50/92 px-4 pt-3 pb-3.5 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur"
          style={{ left: gutter, top: gutter }}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold tracking-[.1em] text-autumn-700 uppercase">
                {focused.study ? "Study city" : focused.pop >= 10000 ? "City" : "Town"}
              </p>
              <h2 className="font-display text-2xl leading-tight font-bold">{focused.name}</h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setFocused(null)}
              className="grid size-7 cursor-pointer place-items-center rounded-full bg-white/70 hover:bg-white"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 fill-none stroke-ink stroke-[2.4] [stroke-linecap:round]"><path d="M5 5l10 10M15 5 5 15" /></svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {focused.county} County · {focused.pop.toLocaleString()} people (2024 est.)
          </p>
          {focused.study && <p className="mt-1.5 text-sm font-semibold text-leaf-700">5 study facilities · facility details coming next</p>}
        </section>
      )}

      <p
        className={`pointer-events-none fixed left-1/2 z-[3] w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-ink/70 px-3.5 py-[7px] text-center text-[13px] font-bold text-sand-50 transition-opacity duration-500 sm:w-auto sm:whitespace-nowrap ${showHint && loaded ? "opacity-100" : "opacity-0"}`}
        style={{ bottom: `calc(${gutter} + 28px)` }}
      >
        Drag to move · Right-drag to rotate &amp; tilt · Scroll to zoom · Click a city to fly there
      </p>

      <p className="pointer-events-none fixed z-[3] m-0 hidden text-[11px] text-ink-soft/80 sm:block" style={{ left: gutter, bottom: gutter }}>
        {source}
      </p>
    </>
  );
}
