"use client";

import { useState } from "react";

const stats = [
  { label: "Facilities", value: "15" },
  { label: "Cities", value: "3" },
  { label: "EPA data", value: "2024" },
];

export default function IntroPanel() {
  const [open, setOpen] = useState(true);

  return (
    <section
      aria-labelledby="title"
      className="fixed top-[clamp(16px,2.4vw,32px)] left-[clamp(16px,2.4vw,32px)] z-[3] w-[min(400px,calc(100vw-32px))] rounded-3xl bg-sand-50/85 px-3.5 pt-3 pb-3.5 shadow-[0_6px_0_var(--color-sand-300),0_18px_34px_rgb(75_79_147/.22)] backdrop-blur-md sm:px-5 sm:pt-4 sm:pb-[18px]"
    >
      <header className="flex items-center gap-2.5">
        <svg viewBox="0 0 40 40" aria-hidden="true" className="size-[34px] flex-none">
          <circle cx="20" cy="20" r="19" fill="var(--color-sand-100)" />
          <path d="M5 26c5-3 10-3 15 0s10 3 15 0v8a19 19 0 0 1-30 0z" fill="var(--color-lake-400)" />
          <path d="M8 29c4-2 8-2 12 0s8 2 12 0" stroke="var(--color-foam)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="20" cy="15" r="8" fill="var(--color-leaf-500)" />
          <circle cx="17" cy="12.5" r="4.5" fill="var(--color-leaf-300)" />
          <rect x="19" y="20" width="2.4" height="6" rx="1" fill="var(--color-bark)" />
        </svg>
        <span className="font-display text-xl font-bold tracking-[-.01em]">Lakeshore Watch</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="panel-body"
          aria-label={open ? "Hide intro" : "Show intro"}
          onClick={() => setOpen((o) => !o)}
          className="ml-auto grid size-8 cursor-pointer place-items-center rounded-full bg-white/60 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lake-500"
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`size-4 fill-none stroke-ink stroke-[2.2] transition-transform [stroke-linecap:round] [stroke-linejoin:round] ${open ? "" : "rotate-180"}`}
          >
            <path d="M5 12l5-5 5 5" />
          </svg>
        </button>
      </header>

      <div id="panel-body" hidden={!open} className="mt-3.5">
        <p className="mb-2 text-xs font-extrabold tracking-[.12em] text-autumn-700 uppercase">HackGB 2026 · Environment Track</p>
        <h1
          id="title"
          className="font-display text-2xl leading-[1.08] font-bold tracking-[-.015em] text-balance [font-variation-settings:'SOFT'_100] sm:text-[clamp(26px,2.5vw,34px)]"
        >
          What our shoreline factories release, <em className="font-semibold text-leaf-700">and what it touches.</em>
        </h1>
        <p className="mt-3 hidden text-[15px] text-ink-soft sm:block">
          Reported pollution from 15 facilities in Green Bay, Manitowoc and Sheboygan, followed into the air, the rivers and
          Lake Michigan.
        </p>
        <dl className="mt-4 flex gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex-1 rounded-xl bg-sand-50 px-3 pt-2 pb-1.5 shadow-[0_3px_0_var(--color-sand-300)]">
              <dt className="text-[11px] font-extrabold tracking-[.06em] text-ink-soft uppercase">{s.label}</dt>
              <dd className="m-0 font-display text-[22px] leading-[1.15] font-bold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
