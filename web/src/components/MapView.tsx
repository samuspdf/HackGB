"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Assistant, { type AssistantHandle } from "@/components/Assistant";
import Forum, { type ForumHandle } from "@/components/Forum";
import { createLakeshoreMap, type MapController } from "@/lib/lakeshoreMap";
import { loadMap, type Facility, type Place } from "@/lib/scene";

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
// Share links (?focus=, ?view=, ?facility=) skip the welcome screen and open the map directly
const isDeepLink = () => /[?&](focus|view|facility)=/.test(window.location.search);

const gutter = "clamp(12px,2vw,24px)";
const chip =
  "grid cursor-pointer place-items-center rounded-[14px] bg-sand-50 text-ink shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-sand-300)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lake-500";
const icon = "size-5 fill-none stroke-current stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]";
const SOUNDTRACK = "/Soundtrack/Background_track.ogg";
const SOUNDTRACK_LOOP_END = 50; // seconds
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
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facility, setFacility] = useState<Facility | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const assistantRef = useRef<AssistantHandle>(null);
  const forumRef = useRef<ForumHandle>(null);
  // Picks made in Ruby's chat move the map and she answers in the chat (no city card or factory panel);
  // picks made on the map itself open the card / panel and leave her chat alone
  const viaRuby = useRef(false);
  const fromRuby = (go: () => void) => ((viaRuby.current = true), go(), (viaRuby.current = false));
  const [soundOn, setSoundOn] = useState(true);
  const deepLink = useSyncExternalStore(noSubscribe, isDeepLink, () => false);
  const [welcome, setWelcome] = useState<"shown" | "leaving" | "gone">("shown");
  const [buttonDue, setButtonDue] = useState(false); // the start button waits 1.5 s so the map is ready behind it

  useEffect(() => {
    const t = setTimeout(() => setButtonDue(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Soundtrack for as long as the app is open: 0:00 → 0:50, then straight back to 0:00 (a seamless Web Audio loop)
  useEffect(() => {
    const ctx = (audioRef.current = new AudioContext());
    fetch(SOUNDTRACK)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        if (ctx.state === "closed") return;
        const track = Object.assign(ctx.createBufferSource(), { buffer, loop: true, loopEnd: Math.min(SOUNDTRACK_LOOP_END, buffer.duration) });
        track.connect(ctx.destination);
        track.start();
      })
      .catch(console.error);
    return () => void ctx.close();
  }, []);

  // Sound on/off (the speaker button). Browsers keep a page silent until the visitor first clicks, taps or presses
  // a key, so while the sound is on, any interaction starts it, except pressing the speaker button itself, so that
  // turning the sound off as your first click never lets it blip on. Off pauses the music; on resumes it.
  useEffect(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    if (!soundOn) return void ctx.suspend();
    ctx.resume(); // right away if the browser allows it (it does just after pressing the speaker button)
    const resume = (e: Event) => void ((e.target as Element).closest?.("[data-sound]") || ctx.resume());
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, [soundOn]);

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
          onFocus: (p) => (setFacility(null), viaRuby.current ? (setFocused(null), p.study && assistantRef.current?.city(p.name)) : (setFocused(p), assistantRef.current?.leave())),
          onFacility: (f) => (viaRuby.current ? (setFocused(null), setFacility(null), setShowHint(false), assistantRef.current?.facility(f)) : (setFacility(f), assistantRef.current?.leave())),
          onFirstInteraction: () => setShowHint(false),
          onLeaveCity: () => (setFocused(null), setFacility(null), assistantRef.current?.leave()),
        });
        setSource(map.data.source);
        setFacilities(map.data.facilities);
        setLoaded(true);
        // Shareable links: ?focus=Green%20Bay flies to a place, ?heading=90 puts east at the top,
        // ?view=x,y,dist jumps to map coordinates in km, ?facility=<TRI ID> opens a facility
        const params = new URLSearchParams(window.location.search);
        const focus = params.get("focus");
        const heading = Number(params.get("heading"));
        const view = params.get("view")?.split(",").map(Number);
        if (isDeepLink()) assistantRef.current?.start(); // no welcome screen on share links: Ruby greets right away
        if (view?.length === 3 && view.every(Number.isFinite)) controllerRef.current.viewAt(view[0], view[1], view[2]);
        if (heading) controllerRef.current.setHeading(heading);
        if (focus) controllerRef.current.focusPlace(focus);
        if (params.get("facility")) controllerRef.current.focusFacility(params.get("facility")!);
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

  const cityFacilities = facilities.filter((f) => f.city === focused?.name);
  const showStart = buttonDue && (loaded || failed || webgl === false);
  const effects = facility?.impacts;
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
      {/* Soft fog around the screen edges, in the same warm tone as the 200-mile fog */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_78%,rgb(239_227_213/.35)_92%,rgb(239_227_213/.6)_100%)]"
      />

      {status && (
        <p className="fixed top-1/2 left-1/2 z-[4] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sand-50 px-5 py-4 text-center text-sm font-semibold text-ink-soft shadow-[0_4px_0_var(--color-sand-300)]">
          {status}
        </p>
      )}

      {/* Compass: shows where north is; N / E / S / W turn that direction to the top */}
      <div
        ref={compassRef}
        className={`fixed z-[3] size-[92px] rounded-full bg-sand-50/90 ${facility ? "hidden" : ""} shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] backdrop-blur [--heading:0deg]`}
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

      {/* Sound, zoom and reset */}
      <div
        role="toolbar"
        aria-label="Map controls"
        className="fixed z-[3] flex gap-2"
        style={{ right: gutter, bottom: gutter }}
      >
        <button type="button" data-sound aria-label={soundOn ? "Turn sound off" : "Turn sound on"} className={`${chip} size-11`} onClick={() => setSoundOn((on) => !on)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={icon}>
            <path d={`M3 8v4h3l4 3V5L6 8H3z${soundOn ? "M13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10" : "M13 8l4 4M17 8l-4 4"}`} />
          </svg>
        </button>
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
          className={`fixed z-[3] w-[min(300px,calc(100vw-120px))] rounded-2xl ${facility ? "hidden" : ""} bg-sand-50/92 px-4 pt-3 pb-3.5 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur`}
          style={{ left: gutter, top: `calc(${gutter} + 52px)` }} // below the Forum button
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
          {focused.study && (
            <ul className="mt-2.5 space-y-2 border-t border-sand-300 pt-2.5">
              {cityFacilities.map((f) => (
                <li key={f.tri_id} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#e0703a] shadow-[0_0_0_3px_rgb(224_112_58/.25)]" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => controllerRef.current?.focusFacility(f.tri_id)}
                      className="cursor-pointer text-left text-sm font-bold leading-snug text-autumn-700 underline decoration-[#e0703a]/50 underline-offset-2 hover:decoration-[#e0703a]"
                    >
                      {f.name}
                    </button>
                    <p className="text-xs text-ink-soft">
                      {f.industry} · {f.released.toLocaleString()} lb released on site (2024)
                    </p>
                  </div>
                </li>
              ))}
              <li className="text-xs font-semibold text-leaf-700">
                {cityFacilities.length} study facilities: the city&apos;s top 3 by 2024 on-site releases
              </li>
            </ul>
          )}
        </section>
      )}

      {/* What the selected facility touches in daily life */}
      {facility && (
        <aside
          aria-live="polite"
          aria-label={`What ${facility.name} affects`}
          className="fixed z-[3] flex w-[min(300px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-sand-50/95 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur"
          style={{ right: gutter, top: gutter, maxHeight: "min(42dvh, 400px)" }}
        >
          <header className="bg-linear-to-br from-[#f08a48] to-[#c9552a] px-3.5 pt-2.5 pb-3 text-sand-50">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold tracking-[.1em] uppercase opacity-85">What it affects</p>
                <h2 className="font-display text-lg leading-tight font-bold">{facility.name}</h2>
                <p className="text-xs opacity-90">{facility.industry} · {facility.city}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setFacility(null)} className="grid size-7 cursor-pointer place-items-center rounded-full bg-white/20 hover:bg-white/35">
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 fill-none stroke-sand-50 stroke-[2.4] [stroke-linecap:round]"><path d="M5 5l10 10M15 5 5 15" /></svg>
              </button>
            </div>
            <div className="mt-2 flex gap-1.5 text-[11px] font-bold">
              {facility.water > 0 && <span className="rounded-full bg-white/20 px-2.5 py-1">💧 {facility.water.toLocaleString()} lb to water</span>}
              {facility.air > 0 && <span className="rounded-full bg-white/20 px-2.5 py-1">💨 {facility.air.toLocaleString()} lb to air</span>}
            </div>
          </header>
          <div className="space-y-2 overflow-y-auto p-3">
            {effects ? (
              <>
                <p className="px-1 text-xs text-ink-soft">{effects.summary}</p>
                {effects.impacts.map((i, k) => (
                  <details key={i.title} open={k === 0} className="group rounded-xl bg-white/75 shadow-[0_2px_0_var(--color-sand-300)]">
                    <summary className="flex cursor-pointer list-none items-center gap-2.5 p-2 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-lake-500/12 text-lg">{i.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">{i.title}</span>
                        <span className="block text-xs text-ink-soft">{i.where}</span>
                      </span>
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-ink-soft stroke-[2.4] transition-transform group-open:rotate-180"><path d="m5 8 5 5 5-5" /></svg>
                    </summary>
                    <div className="px-3 pb-3">
                      <p className="text-xs leading-relaxed">{i.how}</p>
                      <p className="mt-2.5 text-[11px] font-extrabold tracking-[.08em] text-leaf-700 uppercase">How to avoid it</p>
                      <ul className="mt-1 space-y-1">
                        {i.avoid.map((a) => (
                          <li key={a} className="flex gap-2 text-xs leading-snug">
                            <span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-leaf-700 text-[9px] text-sand-50">✓</span>
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ))}
              </>
            ) : (
              <p className="px-1 text-sm text-ink-soft">Details on what this facility affects are coming soon.</p>
            )}
            <button type="button" onClick={() => forumRef.current?.open(facility.tri_id)} className="w-full cursor-pointer rounded-xl border-2 border-lake-500/40 bg-white px-3 py-2 text-sm font-bold text-lake-500 transition-colors hover:border-lake-500 hover:bg-lake-500 hover:text-white">
              Discuss {facility.name} in the forum
            </button>
            <p className="px-1 pt-1 text-[11px] text-ink-soft/80">Reported releases (EPA TRI 2024) are mostly legal under permit, not violations.</p>
          </div>
        </aside>
      )}

      {/* Welcome screen: two halves part like curtains while the map swings in behind them */}
      {!deepLink && welcome !== "gone" && (
        <div className={`fixed inset-0 z-10 ${welcome === "leaving" ? "pointer-events-none" : ""}`}>
          {["left-0", "right-0"].map((side) => (
            <div
              key={side}
              onTransitionEnd={() => setWelcome("gone")}
              className={`absolute inset-y-0 ${side} w-1/2 bg-linear-to-b from-sky-top via-sky-mid via-45% to-sand-100 transition-transform duration-[1200ms] ease-[cubic-bezier(.75,0,.2,1)] ${welcome === "leaving" ? (side === "left-0" ? "-translate-x-full" : "translate-x-full") : ""}`}
            />
          ))}
          <div className={`relative grid h-full place-items-center px-6 text-center transition duration-500 ${welcome === "leaving" ? "scale-95 opacity-0" : ""}`}>
            <div>
              <p className="text-xs font-extrabold tracking-[.3em] text-autumn-700 uppercase">Lakeshore Watch</p>
              <h2 className="mt-3 font-display text-5xl leading-none font-bold text-ink sm:text-7xl">
                Welcome to <span className="text-leaf-700">Wisconsin</span>
              </h2>
              <p className="mx-auto mt-5 max-w-md text-base text-ink-soft sm:text-lg">
                See what factories along Lake Michigan release, and what it touches in daily life.
              </p>
              <button
                type="button"
                disabled={!showStart}
                onClick={() => (setWelcome("leaving"), controllerRef.current?.intro(), assistantRef.current?.start())}
                className={`mt-9 cursor-pointer rounded-2xl bg-[#e0703a] px-8 py-4 font-display text-lg font-bold text-sand-50 shadow-[0_5px_0_#a8461f,0_14px_26px_rgb(75_79_147/.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_#a8461f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lake-500 ${showStart ? "opacity-100" : "invisible translate-y-3 opacity-0"} [transition:opacity_.5s,translate_.5s,visibility_.5s]`}
              >
                Let&apos;s get started →
              </button>
            </div>
          </div>
        </div>
      )}

      <p
        className={`pointer-events-none fixed left-1/2 z-[3] w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-ink/70 px-3.5 py-[7px] text-center text-[13px] font-bold text-sand-50 transition-opacity duration-500 sm:w-auto sm:whitespace-nowrap ${showHint && loaded ? "opacity-100" : "opacity-0"}`}
        style={{ top: gutter }}
      >
        Drag to move · Right-drag to rotate &amp; tilt · Scroll to zoom · Click a city to fly there
      </p>

      <p className="pointer-events-none fixed z-[3] m-0 hidden max-w-[40vw] text-right text-[11px] text-ink-soft/80 sm:block" style={{ right: gutter, bottom: `calc(${gutter} + 56px)` }}>
        {source}
      </p>

      <Forum ref={forumRef} facilities={facilities} />

      <Assistant
        ref={assistantRef}
        facilities={facilities}
        onCity={(name) => fromRuby(() => controllerRef.current?.focusPlace(name))}
        onFacility={(id) => fromRuby(() => controllerRef.current?.focusFacility(id))}
        onForum={(id) => forumRef.current?.open(id)}
        onExit={() => controllerRef.current?.reset()}
      />
    </>
  );
}
