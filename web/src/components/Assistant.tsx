"use client";

// Ruby, the guide: walks visitors through the study cities and their factories, reacting with her pose and
// expression. Typed questions go to Gemini through /api/chat. An original character in a flat, friendly style.
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Facility, Impacts } from "@/lib/scene";

type Pose = "idle" | "wave" | "present" | "explain" | "think";
type Mood = "happy" | "excited" | "concerned" | "thinking";
type Chips = { kind: "cities" } | { kind: "factories"; city: string } | { kind: "more"; id: string };
type Area = Impacts["impacts"][number];
interface Message { from: "ruby" | "you"; text: string; chips?: Chips; key?: string; forum?: string } // forum: the factory whose forum card shows under it ("" = any)
export interface AssistantHandle { start(): void; city(name: string): void; facility(f: Facility): void; leave(): void }

const HAIR = "#e8643a", HAIR_DARK = "#bf4527", HAIR_LIGHT = "#ff9b62";
const SKIN = "#ffc8b4", SKIN_SHADE = "#f2ab95", DRESS = "#5a3f8a", DRESS_LIGHT = "#a879f5", MOUTH = "#8f2d3d";
const EASE = "transform .55s cubic-bezier(.34,1.45,.64,1)";
const TILE = ["bg-[#fde3d3]", "bg-[#dce8fb]", "bg-[#dcefdc]"]; // peach, sky and mint tiles for the "how to avoid it" pictures

// Arm angles in degrees, [shoulder, elbow], for the arm on the viewer's left and right; positive swings outward
const POSES: Record<Pose, { l: [number, number]; r: [number, number] }> = {
  idle: { l: [-5, -45], r: [-5, -45] }, // hands clasped in front
  wave: { l: [-5, -45], r: [150, 10] },
  present: { l: [8, -10], r: [72, 32] }, // lets go of her hands and opens an arm toward the chat
  explain: { l: [-5, -45], r: [22, 138] }, // one finger raised
  think: { l: [-5, -45], r: [-70, -125] }, // hand to her chin
};
const MOODS: Record<Mood, { brows: [string, string]; head: number; gaze: [number, number] }> = {
  happy: { brows: ["none", "none"], head: 0, gaze: [0, 0] },
  excited: { brows: ["translateY(-3px) rotate(-5deg)", "translateY(-3px) rotate(5deg)"], head: -3, gaze: [0, 0] },
  concerned: { brows: ["rotate(-13deg)", "rotate(13deg)"], head: 3, gaze: [0, 1] },
  thinking: { brows: ["translateY(-3px) rotate(-6deg)", "translateY(1px) rotate(4deg)"], head: -6, gaze: [2.5, -2.5] },
};

function Arm({ mirror, angles: [a, b], wave, finger }: { mirror?: boolean; angles: [number, number]; wave?: boolean; finger?: boolean }) {
  return (
    <g style={{ transform: `translate(${mirror ? 102 : 58}px,134px) scale(${mirror ? -1 : 1},1) rotate(${a}deg)`, transformOrigin: "0 0", transition: EASE }}>
      <path d="M-8-4C-9 12-9 24-7 30H7C9 24 9 12 8-4z" fill={DRESS} />
      <g style={{ transform: `translate(0px,28px) rotate(${b}deg)`, transformOrigin: "0 0", transition: EASE }}>
        <g className={wave ? "animate-[ruby-wave_.4s_ease-in-out_infinite_alternate]" : ""} style={{ transformOrigin: "0 0" }}>
          <path d="M-7-2C-8 10-10 18-11 24c7 4 15 4 22 0C10 18 8 10 7-2z" fill={DRESS} />
          <path d="M-11 24c7 4 15 4 22 0" stroke={DRESS_LIGHT} strokeWidth={3} fill="none" />
          {finger && <rect x={-2.2} y={30} width={4.4} height={12} rx={2.2} fill={SKIN} />}
          <circle cy={31} r={7.5} fill={SKIN} />
          <circle cx={5.5} cy={27} r={3.2} fill={SKIN_SHADE} />
        </g>
      </g>
    </g>
  );
}

function Ruby({ pose, mood, talking }: { pose: Pose; mood: Mood; talking: boolean }) {
  const m = MOODS[mood];
  return (
    <svg viewBox="0 0 160 190" overflow="visible" aria-hidden="true" className="size-full">
      <ellipse cx={80} cy={189} rx={44} ry={4} fill="rgb(60 40 90 / .15)" />
      <g className="animate-[ruby-breathe_3.2s_ease-in-out_infinite_alternate]">
        <path className="animate-[ruby-sway_4s_ease-in-out_infinite_alternate]" style={{ transformOrigin: "80px 20px" }} d="M44 64C42 28 62 14 80 14s38 14 36 50l2 40c0 6-4 8-10 7l-12-2V96H64v13l-12 2c-6 1-10-1-10-7z" fill={HAIR} />
        <path d="M38 190c0-30 4-56 24-62h36c20 6 24 32 24 62z" fill={DRESS} />
        <rect x={72} y={100} width={16} height={30} rx={7} fill={SKIN_SHADE} />
        <path d="M64 128c6 10 26 10 32 0l-4-3c-5 6-19 6-24 0z" fill={DRESS_LIGHT} />
        <g style={{ transform: `rotate(${m.head}deg)`, transformOrigin: "80px 106px", transition: EASE }}>
          <circle cx={50} cy={74} r={6} fill={SKIN_SHADE} />
          <circle cx={110} cy={74} r={6} fill={SKIN_SHADE} />
          <path d="M50 62c0-26 14-36 30-36s30 10 30 36v14c0 20-14 32-30 32s-30-12-30-32z" fill={SKIN} />
          {[63, 97].map((x) => <circle key={x} cx={x} cy={86} r={6} fill="#ff8e8e" opacity={mood === "excited" ? 0.55 : 0.35} />)}
          <g className="animate-[ruby-blink_4.6s_infinite]" style={{ transformOrigin: "80px 72px" }}>
            <g style={{ transform: mood === "excited" ? "scale(1.1)" : "none", transformOrigin: "80px 72px", transition: EASE }}>
              {[68, 92].map((x) => (
                <g key={x}>
                  <ellipse cx={x} cy={72} rx={7} ry={8} fill="#fff" />
                  <g style={{ transform: `translate(${m.gaze[0]}px,${m.gaze[1]}px)`, transition: EASE }}>
                    <circle cx={x + 1} cy={73} r={4.3} fill="#3a3548" />
                    <circle cx={x + 2.6} cy={71.2} r={1.5} fill="#fff" />
                  </g>
                </g>
              ))}
            </g>
          </g>
          {(["M61 61q7-4 14-1", "M85 60q7-3 14 1"] as const).map((d, i) => (
            <path key={d} d={d} stroke={HAIR_DARK} strokeWidth={3} strokeLinecap="round" fill="none" style={{ transform: m.brows[i], transformOrigin: i ? "92px 59px" : "68px 59px", transition: EASE }} />
          ))}
          <path d="M80 78q3 5 0 8" stroke="#ec9c86" strokeWidth={2.4} strokeLinecap="round" fill="none" />
          {talking ? (
            <ellipse cx={80} cy={95} rx={5.5} ry={4.5} fill={MOUTH} className="animate-[ruby-talk_.16s_ease-in-out_infinite_alternate]" style={{ transformOrigin: "80px 93px" }} />
          ) : mood === "excited" ? (
            <><path d="M70 91q10 14 20 0z" fill={MOUTH} /><path d="M75 97.5q5 3.5 10 0q-5-2.5-10 0z" fill="#f0707a" /></>
          ) : mood === "thinking" ? (
            <ellipse cx={82} cy={95} rx={3} ry={3.6} fill={MOUTH} />
          ) : (
            <path d={mood === "concerned" ? "M73 96q7-4 14 0" : "M72 93q8 7 16 0"} stroke="#b9474b" strokeWidth={3} strokeLinecap="round" fill="none" />
          )}
          <path d="M48 60C48 26 64 18 80 18s32 8 32 42c-4-10-14-16-26-14l-6 6-6-6c-12-2-22 4-26 14z" fill={HAIR} />
          <path d="M60 30q8-8 20-8" stroke={HAIR_LIGHT} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.8} />
        </g>
        <Arm angles={POSES[pose].l} />
        <Arm mirror angles={POSES[pose].r} wave={pose === "wave"} finger={pose === "explain"} />
      </g>
    </svg>
  );
}

// The tips as picture tiles; tapping one opens it in full
function Protect({ area, open, setOpen }: { area: Area; open: string; setOpen(label: string): void }) {
  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {area.avoid.map((t, i) => (
          <li key={t.label}>
            <button
              type="button"
              aria-expanded={open === t.label}
              onClick={() => setOpen(open === t.label ? "" : t.label)}
              className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center animate-[bubble-in_.4s_ease-out_both] hover:-translate-y-0.5 ${TILE[i % 3]} ${open === t.label ? "ring-2 ring-[#e0703a]" : ""}`}
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            >
              <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-white/80 text-3xl shadow-[0_3px_0_rgb(60_40_90/.08)]">{t.icon}</span>
              <span className="text-[11px] leading-tight font-bold text-ink">{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-center text-xs text-ink-soft">Tap a picture to learn more</p>
    </>
  );
}

// One tip in full: its picture, the advice and, where there is one, the official page to go to.
// "Report it" tips send you to the forum, where the company can reply
function Tip({ tip, tile, close, report }: { tip: Area["avoid"][number]; tile: string; close(): void; report(): void }) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full text-2xl ${tile}`}>{tip.icon}</span>
        <h3 className="flex-1 font-display text-base leading-tight font-bold text-ink">{tip.label}</h3>
        <button type="button" aria-label={`Close ${tip.label}`} onClick={close} className="grid size-7 shrink-0 cursor-pointer place-items-center self-start rounded-full hover:bg-white">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 fill-none stroke-ink-soft stroke-[2.4] [stroke-linecap:round]"><path d="M5 5l10 10M15 5 5 15" /></svg>
        </button>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink">{tip.text}.</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden">
        {tip.forum && <button type="button" onClick={report} className="cursor-pointer rounded-lg bg-[#e0703a] px-3 py-1.5 text-xs font-bold text-sand-50 shadow-[0_2px_0_#a8461f] hover:bg-[#cf6431]">💬 Report it in the forum →</button>}
        {tip.link && <a href={tip.link.url} target="_blank" rel="noreferrer" className={tip.forum ? "text-xs font-bold text-lake-500 underline underline-offset-2" : "rounded-lg bg-[#e0703a] px-3 py-1.5 text-xs font-bold text-sand-50 shadow-[0_2px_0_#a8461f] hover:bg-[#cf6431]"}>{tip.link.text} ↗</a>}
      </div>
    </>
  );
}

export default function Assistant({ ref, facilities, open, setOpen, onCity, onFacility, onForum, onExit }: {
  ref?: Ref<AssistantHandle>;
  facilities: Facility[];
  open: boolean; // her chat shares the left column with the city card and the forum, so the map view owns this
  setOpen(open: boolean): void;
  onCity(name: string): void;
  onFacility(id: string): void;
  onForum(id: string, topic?: string): void; // open the forum on this factory (and what it's about)
  onExit(): void; // she was closed: the map goes back to the start
}) {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pose, setPose] = useState<Pose>("wave");
  const [mood, setMood] = useState<Mood>("happy");
  const [talking, setTalking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState<Facility | null>(null); // the factory Ruby is showing: what it affects, as buttons up top
  const [area, setArea] = useState(""); // the area she's explaining ("" = none yet, so they all glow)
  const [seen, setSeen] = useState<string[]>([]); // areas already explained for this factory
  const [tip, setTip] = useState(""); // the protect-yourself picture that's open
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const place = useRef(""); // what the visitor is looking at, sent along with questions
  const figure = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cities = [...new Set(facilities.map((f) => f.city))];

  const later = (name: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  };
  // Ruby says something: new pose and expression, a little hop, and her mouth moves while the line "plays"
  const say = (text: string, [p, md]: [Pose, Mood], chips?: Chips, key?: string, forum?: string) => {
    setMessages((all) => (key && all.at(-1)?.key === key ? all : [...all, { from: "ruby", text, chips, key, forum }]));
    setPose(p);
    setMood(md);
    setTalking(true);
    later("talk", Math.min(6000, Math.max(1200, text.length * 38)), () => setTalking(false));
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      figure.current?.animate([{ translate: "0 0" }, { translate: "0 -10px", offset: 0.3 }, { translate: "0 2px", offset: 0.65 }, { translate: "0 0" }], { duration: 500, easing: "ease-out" });
    }
  };
  const you = (text: string) => setMessages((all) => [...all, { from: "you", text }]);
  // The tappable choices under her latest message: cities, a city's factories, or the other factories + "Another city"
  type Choice = { label: string; city?: string; id?: string };
  const factoryChoices = (list: Facility[]): Choice[] => list.map((f) => ({ label: f.name, id: f.tri_id }));
  const choicesFor = (c: Chips): Choice[] => {
    if (c.kind === "cities") return cities.map((city) => ({ label: city, city }));
    if (c.kind === "factories") return factoryChoices(facilities.filter((f) => f.city === c.city));
    const city = facilities.find((f) => f.tri_id === c.id)?.city;
    return [...factoryChoices(facilities.filter((f) => f.city === city && f.tri_id !== c.id)), { label: "Another city" }];
  };
  // Picking a choice echoes it as your message, then moves the map (Ruby answers when the map reports back)
  const pick = ({ label, city, id }: Choice) => {
    you(label);
    if (id) onFacility(id);
    else if (city) onCity(city);
    else say("Sure! Which city next?", ["idle", "happy"], { kind: "cities" }, "cities");
  };

  // The forum card under her message (or a "report it" tip): opens the forum on this factory, over the whole screen
  const openForum = (id: string, topic?: string) => {
    onForum(id, topic);
    say(`Here's the forum${id ? ", already set to this factory" : ""}. Write what you noticed, and the company can reply to you there!`, ["present", "happy"], id ? { kind: "more", id } : { kind: "cities" });
  };

  const greet = () => {
    say("Hi, I'm Ruby, your guide! I'll show you what the factories along Lake Michigan release, and what it touches in daily life. Which city would you like to explore?", ["wave", "happy"], { kind: "cities" }, "cities");
    later("wave", 2600, () => setPose((p) => (p === "wave" ? "idle" : p)));
  };
  // The X: clears her chat, minimizes her to "Ask Ruby" and flies the map back to the start
  const exit = () => {
    setMessages([]);
    setShown(null);
    setOpen(false);
    setPose("idle");
    setMood("happy");
    place.current = "";
    onExit();
  };

  useImperativeHandle(ref, () => ({
    start() {
      if (started) return;
      setStarted(true);
      greet();
    },
    city(name) {
      place.current = name;
      setShown(null);
      say(`Great pick! Here are the three factories I'm keeping an eye on in ${name}. Which one should we visit?`, ["present", "excited"], { kind: "factories", city: name }, `city:${name}`);
    },
    facility(f) {
      place.current = `${f.name} (${f.city})`;
      setShown(f);
      setArea("");
      setSeen([]);
      say(`${f.name} is ${/^[aeiou]/i.test(f.industry) ? "an" : "a"} ${f.industry.toLowerCase()} in ${f.city}. ${f.impacts?.summary ?? ""} Check the glowing buttons at the top: those are the areas it affects. Tap one and I'll explain it!`, ["explain", "concerned"], { kind: "more", id: f.tri_id }, `facility:${f.tri_id}`);
    },
    leave: () => setShown(null),
  }));

  // Tapping an affected area up top: Ruby explains how it's affected; how to protect yourself opens as pictures beside her.
  // Once every area has been seen, she invites you to tell the company in the forum.
  const explain = (a: Area, f: Facility) => {
    const all = [...new Set([...seen, a.title])], done = all.length === f.impacts?.impacts.length;
    setOpen(true);
    setArea(a.title);
    setSeen(all);
    setTip("");
    you(`${a.icon} ${a.title}`);
    say(`${a.title} (${a.where}): ${a.how}\n\nHow to protect yourself: tap a picture to learn more.${done ? `\n\nThat's everything ${f.name} affects! If something here bothers you, report it in the forum: the company can reply.` : ""}`, ["explain", "concerned"], { kind: "more", id: f.tri_id }, `area:${a.title}`, done ? f.tri_id : undefined);
  };

  // Typed questions: Gemini answers on the server (/api/chat); she thinks with a hand on her chin meanwhile
  const ask = async (text: string) => {
    if (!text.trim() || thinking) return;
    const history = [...messages, { from: "you" as const, text }].map(({ from, text }) => ({ from, text }));
    you(text);
    setDraft("");
    setThinking(true);
    setPose("think");
    setMood("thinking");
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, place: place.current }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setThinking(false);
    // Her answer comes with the forum card when she's on a factory, or when she sends you to the forum (to report something)
    if (data?.text) return say(data.text, [place.current ? "explain" : "idle", "happy"], shown ? { kind: "more", id: shown.tri_id } : undefined, undefined, shown?.tri_id ?? (/forum/i.test(data.text) ? "" : undefined));
    say(res?.status === 503
      ? "My chat brain isn't switched on yet: it needs a Gemini API key (see the README). You can still tap a city or a factory below!"
      : "Sorry, I couldn't reach my notes just now. Please try again in a moment.", ["idle", "concerned"], { kind: "cities" });
  };

  // Scroll to the start of the newest message (also when her chat is reopened), so long explanations read from the top.
  // Braces matter: scrollTo can return a Promise, and an effect must return nothing (or a cleanup function)
  useEffect(() => {
    list.current?.scrollTo({ top: (list.current.lastElementChild as HTMLElement | null)?.offsetTop ?? 0, behavior: "smooth" });
  }, [messages, thinking, open]);

  if (!started) return null;
  const last = messages.at(-1);
  const tips = shown?.impacts?.impacts.find((x) => x.title === area); // the area she's explaining
  const tipsMsg = tips && messages.findLast((m) => m.key === `area:${tips.title}`); // narrow screens show the pictures under it
  const at = tips?.avoid.findIndex((t) => t.label === tip) ?? -1, picked = tips?.avoid[at]; // the picture that's open
  const portrait = (
    <div ref={figure} className="aspect-[160/190] w-[84px] sm:w-[124px]">
      <Ruby pose={pose} mood={mood} talking={talking} />
    </div>
  );
  return (
    <>
      {/* How to protect yourself, beside her chat: the area's tips as pictures, and the one you tap in full in a box of its
          own to their right (above them when there's no room; both sit inside her chat on narrower screens) */}
      {open && tips && (
        <div className="fixed bottom-[clamp(12px,2vw,24px)] left-[calc(clamp(12px,2vw,24px)+376px)] z-[3] hidden flex-col-reverse items-start lg:flex xl:flex-row xl:items-end">
          <aside key={tips.title} aria-label={`How to protect yourself: ${tips.title}`} className="relative w-[320px] animate-[bubble-in_.35s_ease-out] rounded-2xl bg-sand-50/95 p-3.5 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur">
            <span aria-hidden="true" className="absolute right-full bottom-12 h-5 w-3 bg-sand-50/95 [clip-path:polygon(100%_0,100%_100%,0_50%)]" />
            <p className="text-[11px] font-extrabold tracking-[.1em] text-leaf-700 uppercase">How to protect yourself</p>
            <h3 className="mb-3 font-display text-lg leading-tight font-bold text-ink">{tips.title}</h3>
            <Protect area={tips} open={tip} setOpen={setTip} />
          </aside>
          <div aria-live="polite">
            {picked && (
              <section key={picked.label} aria-label={picked.label} className="relative mb-3 w-[300px] animate-[bubble-in_.3s_ease-out] rounded-2xl bg-sand-50/95 p-3.5 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur xl:mb-0 xl:ml-4">
                <span aria-hidden="true" className="absolute top-full left-14 h-3 w-5 bg-sand-50/95 [clip-path:polygon(0_0,100%_0,50%_100%)] xl:top-auto xl:right-full xl:bottom-12 xl:left-auto xl:h-5 xl:w-3 xl:[clip-path:polygon(100%_0,100%_100%,0_50%)]" />
                <Tip tip={picked} tile={TILE[at % 3]} close={() => setTip("")} report={() => openForum(shown?.tri_id ?? "", tips.title)} />
              </section>
            )}
          </div>
        </div>
      )}
      {/* Wide screens: in the space right of the left column (chat, card or forum). Narrow: a scrolling row under the Forum button */}
      {shown?.impacts && (
        <nav aria-label="Areas this factory affects" className="fixed inset-x-[clamp(12px,2vw,24px)] top-[calc(clamp(12px,2vw,24px)+48px)] z-[4] flex gap-2.5 overflow-x-auto py-2 [scrollbar-width:none] lg:top-[clamp(12px,2vw,24px)] lg:right-[calc(clamp(12px,2vw,24px)+104px)] lg:left-[calc(clamp(12px,2vw,24px)+392px)] lg:flex-wrap lg:justify-center lg:overflow-visible lg:py-0">
          {shown.impacts.impacts.map((a, i) => (
            <button
              key={a.title}
              type="button"
              aria-pressed={area === a.title}
              onClick={() => explain(a, shown)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 font-display text-[15px] font-bold transition-[translate,background-color,color] animate-[bubble-in_.35s_ease-out_both] hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-lake-500 ${area === a.title ? "bg-[#e0703a] text-sand-50 shadow-[0_4px_0_#a8461f,0_10px_18px_rgb(75_79_147/.2)]" : "bg-sand-50 text-ink shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)]"}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span aria-hidden="true" className={`grid size-8 place-items-center rounded-full text-lg ${area === a.title ? "bg-white/25" : "bg-[#fde3d3]"} ${area ? "" : "animate-[area-glow_1.6s_ease-in-out_infinite]"}`}>{a.icon}</span>
              {a.title}
            </button>
          ))}
        </nav>
      )}
      <div className="fixed z-[3] [animation:ruby-enter_.7s_.6s_cubic-bezier(.34,1.45,.64,1)_both]" style={{ left: "clamp(12px,2vw,24px)", bottom: "clamp(12px,2vw,24px)" }}>
        {open ? portrait : (
          <button type="button" onClick={() => (setOpen(true), messages.length || greet())} aria-label="Open chat with Ruby" className="relative cursor-pointer">
            {portrait}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#e0703a] px-2.5 py-1 text-xs font-bold text-sand-50 shadow-[0_3px_0_#a8461f]">Ask Ruby</span>
          </button>
        )}
      </div>
      {/* Her chat fills the left column, where the city card goes: from under the Forum button down to just above her.
          Pressing any of its buttons, other than the pictures, closes the tip that's open */}
      {open && (
        <section aria-label="Chat with Ruby, your guide" onClick={(e) => (e.target as Element).closest("button:not([aria-expanded])") && setTip("")} className={`fixed ${shown?.impacts ? "top-[calc(clamp(12px,2vw,24px)+128px)] lg:top-[calc(clamp(12px,2vw,24px)+52px)]" : "top-[calc(clamp(12px,2vw,24px)+52px)]"} bottom-[calc(clamp(12px,2vw,24px)+112px)] left-[clamp(12px,2vw,24px)] z-[3] flex w-[min(360px,calc(100vw-32px))] animate-[bubble-in_.3s_ease-out] flex-col rounded-2xl bg-sand-50/95 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur sm:bottom-[calc(clamp(12px,2vw,24px)+162px)]`}>
          <span aria-hidden="true" className="absolute top-full left-11 h-3 w-5 bg-sand-50/95 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          <header className="flex items-center gap-2 border-b border-sand-300/60 px-3.5 py-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-[#3fae6a] shadow-[0_0_0_3px_rgb(63_174_106/.25)]" />
            <p className="flex-1 text-xs text-ink-soft"><span className="font-display text-base font-bold text-ink">Ruby</span> · your guide</p>
            <button type="button" aria-label="Minimize chat" onClick={() => setOpen(false)} className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-white">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-ink-soft stroke-[2.4] [stroke-linecap:round] [stroke-linejoin:round]"><path d="m5 8 5 5 5-5" /></svg>
            </button>
            <button type="button" aria-label="Close Ruby and start over" title="Close Ruby and start over" onClick={exit} className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-white">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 fill-none stroke-ink-soft stroke-[2.4] [stroke-linecap:round]"><path d="M5 5l10 10M15 5 5 15" /></svg>
            </button>
          </header>
          <div ref={list} role="log" aria-live="polite" className="relative min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((msg, i) => (
              <div key={i} className={`animate-[bubble-in_.3s_ease-out] ${msg.from === "you" ? "flex justify-end" : ""}`}>
                <p className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-snug whitespace-pre-line ${msg.from === "you" ? "rounded-br-md bg-[#e0703a] text-sand-50" : "rounded-bl-md bg-white text-ink shadow-[0_1px_0_var(--color-sand-300)]"}`}>{msg.text}</p>
                {msg === tipsMsg && tips && (
                  <div className="mt-2 lg:hidden">
                    <Protect area={tips} open={tip} setOpen={setTip} />
                    <div aria-live="polite">
                      {picked && <div key={picked.label} className="mt-2 animate-[bubble-in_.25s_ease-out] rounded-xl bg-white p-3"><Tip tip={picked} tile={TILE[at % 3]} close={() => setTip("")} report={() => openForum(shown?.tri_id ?? "", tips.title)} /></div>}
                    </div>
                  </div>
                )}
                {msg === last && msg.forum !== undefined && !thinking && (
                  <div className="mt-2 rounded-xl border-2 border-[#e0703a]/40 bg-[#fde3d3]/60 p-2.5">
                    <p className="text-xs leading-snug text-ink">
                      <span aria-hidden="true">💬 </span>Have a concern about <b>{facilities.find((f) => f.tri_id === msg.forum)?.name ?? "a factory"}</b>? Report it in the community forum, where the company can reply.
                    </p>
                    <button type="button" onClick={() => openForum(msg.forum ?? "")} className="mt-2 cursor-pointer rounded-lg bg-[#e0703a] px-3 py-1.5 text-xs font-bold text-sand-50 shadow-[0_2px_0_#a8461f]">
                      Open the forum →
                    </button>
                  </div>
                )}
                {msg === last && msg.chips && !thinking && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {choicesFor(msg.chips).map((choice) => (
                      <button key={choice.label} type="button" onClick={() => pick(choice)} className="cursor-pointer rounded-full border-2 border-lake-500/35 bg-white px-2.5 py-1 text-xs font-bold text-lake-500 transition-colors hover:border-lake-500 hover:bg-lake-500 hover:text-white focus-visible:outline-2 focus-visible:outline-lake-500">
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div aria-label="Ruby is typing" className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2.5">
                {[0, 1, 2].map((d) => <span key={d} className="size-1.5 rounded-full bg-ink-soft animate-[typing-dot_1s_ease-in-out_infinite]" style={{ animationDelay: `${d * 0.15}s` }} />)}
              </div>
            )}
          </div>
          <form onSubmit={(e) => (e.preventDefault(), ask(draft))} className="flex gap-2 border-t border-sand-300/60 p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()} // arrow keys move the cursor here, not the map
              maxLength={400}
              placeholder="Ask Ruby anything…"
              aria-label="Message Ruby"
              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-lake-500"
            />
            <button type="submit" aria-label="Send" disabled={!draft.trim() || thinking} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#e0703a] text-sand-50 shadow-[0_3px_0_#a8461f] disabled:cursor-default disabled:opacity-50">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2.4] [stroke-linecap:round] [stroke-linejoin:round]"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}
