"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { basemap } from "@/lib/basemap";
import { createDiorama, type DioramaController } from "@/lib/diorama";

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

const toolClass =
  "grid size-11 cursor-pointer place-items-center rounded-[14px] bg-sand-50 text-ink shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-sand-300)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lake-500";
const iconClass = "size-5 fill-none stroke-current stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]";

export default function DioramaMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DioramaController | null>(null);
  const webgl = useSyncExternalStore(noSubscribe, hasWebGL, () => null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    const labelLayer = labelsRef.current;
    if (!webgl || !container || !labelLayer) return;
    controllerRef.current = createDiorama({
      container,
      labelLayer,
      map: basemap,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onFirstInteraction: () => setShowHint(false),
    });
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [webgl]);

  return (
    <>
      <div
        ref={containerRef}
        role="img"
        aria-label="3D illustrated map of Wisconsin with Lake Michigan to the east, marking Green Bay, Manitowoc and Sheboygan along the shoreline. Drag to move, scroll to zoom."
        className="fixed inset-0 z-[1] cursor-grab touch-none active:cursor-grabbing"
      >
        {!webgl && (
          <p className="absolute top-1/2 left-1/2 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sand-50 px-5 py-4 text-center text-sm text-ink-soft shadow-[0_4px_0_var(--color-sand-300)]">
            {webgl === null ? "Loading the map…" : "This map needs WebGL, which isn't available in this browser."}
          </p>
        )}
      </div>
      <div ref={labelsRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[2] overflow-hidden" />

      <div
        role="toolbar"
        aria-label="Map controls"
        className="fixed right-[clamp(16px,2.4vw,32px)] bottom-[calc(clamp(16px,2.4vw,32px)+96px)] z-[3] flex flex-col gap-2 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2"
      >
        <button type="button" aria-label="Zoom in" className={toolClass} onClick={() => controllerRef.current?.zoomBy(0.6)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={iconClass}><path d="M10 4v12M4 10h12" /></svg>
        </button>
        <button type="button" aria-label="Zoom out" className={toolClass} onClick={() => controllerRef.current?.zoomBy(1 / 0.6)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={iconClass}><path d="M4 10h12" /></svg>
        </button>
        <button type="button" aria-label="Reset view" className={toolClass} onClick={() => controllerRef.current?.reset()}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={iconClass}><path d="M4.5 9a6 6 0 1 1 1.8 5.3M4.5 4v5h5" /></svg>
        </button>
      </div>

      <p
        className={`pointer-events-none fixed bottom-[calc(clamp(16px,2.4vw,32px)+34px)] left-1/2 z-[3] w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-ink/70 px-3.5 py-[7px] text-center text-[13px] font-bold text-sand-50 transition-opacity duration-500 sm:w-auto sm:whitespace-nowrap ${showHint ? "opacity-100" : "opacity-0"}`}
      >
        Drag to move · Right-drag (or two fingers) to rotate &amp; tilt · Scroll or pinch to zoom
      </p>

      <p className="fixed bottom-[clamp(16px,2.4vw,32px)] left-1/2 z-[3] m-0 -translate-x-1/2 text-center text-[13px] font-bold whitespace-nowrap text-ink-soft">
        Wisconsin&apos;s Lake Michigan shore
        <span className="hidden font-normal opacity-80 sm:inline"> · Basemap: {basemap.source}</span>
      </p>
    </>
  );
}
