"use client";

// Community forum: a full-screen chat with each factory. Neighbors write from their side, and the company replies from
// the other (with its access code). Messages live on the server (/api/forum), saved per company under
// cities/<city>/<company>/forum.json.
import { Fragment, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Facility } from "@/lib/scene";

interface Message { id: string; company: string; from: "neighbor" | "company"; name: string; topic: string; text: string; at: string; replyTo?: string }
export interface ForumHandle { open(company?: string, topic?: string): void }

const gutter = "clamp(12px,2vw,24px)";
const field = "rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-lake-500";
const time = (at: string) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (at: string) => {
  const ago = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 864e5);
  return ago === 0 ? "Today" : ago === 1 ? "Yesterday" : new Date(at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
const waiting = (chat: Message[]) => chat.length - 1 - chat.findLastIndex((m) => m.from === "company"); // neighbor messages since the company last replied

// Initials in a circle: blue for a company, peach for a neighbor
function Avatar({ name, company, big }: { name: string; company?: boolean; big?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-extrabold ${big ? "size-11 text-sm" : "size-8 text-[11px]"} ${company ? "bg-[#3d5fb2] text-white" : "bg-[#fde3d3] text-[#a8461f]"}`}>
      {name.split(/[\s-]+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function Forum({ ref, facilities }: { ref?: Ref<ForumHandle>; facilities: Facility[] }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState(""); // whose chat is open ("" = none picked yet)
  const [messages, setMessages] = useState<Message[]>([]); // every company's, oldest first
  const [replies, setReplies] = useState(false); // companies can reply: the server has an access code set
  const [draft, setDraft] = useState({ name: "", topic: "", text: "" });
  const [code, setCode] = useState<string | null>(null); // null = writing as a neighbor; otherwise as the company, with its access code
  const [replyTo, setReplyTo] = useState(""); // the neighbor message the company is answering
  const [status, setStatus] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const f = facilities.find((x) => x.tri_id === company);
  const chat = messages.filter((m) => m.company === company);
  const answering = chat.find((m) => m.id === replyTo);
  const asCompany = code !== null;
  const topicIcon = (topic: string) => f?.impacts?.impacts.find((a) => a.title === topic)?.icon ?? "💬";

  const load = useCallback(async () => {
    const data = await fetch("/api/forum").then((r) => r.json()).catch(() => null);
    if (!data) return;
    setMessages(data.messages);
    setReplies(data.companyReplies);
  }, []);
  const pick = (id: string, topic = "") => (setCompany(id), setDraft((d) => ({ ...d, topic })), setReplyTo(""), setStatus(""));
  useImperativeHandle(ref, () => ({ open: (id = "", topic = "") => (setOpen(true), pick(id, topic), load()) }));

  // While it's open, replies from the other side show up by themselves
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [open, load]);
  // Keep the newest message in view. Braces matter: an effect must return nothing (or a cleanup function)
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [open, company, chat.length]);

  const send = async () => {
    setStatus("Sending…");
    const body = asCompany ? { company, text: draft.text, code, replyTo } : { company, ...draft };
    const res = await fetch("/api/forum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setStatus(res?.ok ? "" : data?.error ?? "Couldn't send just now. Please try again.");
    if (!res?.ok) return;
    setDraft((d) => ({ ...d, text: "" }));
    setReplyTo("");
    await load();
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (setOpen(true), load())}
        className="fixed z-[4] flex cursor-pointer items-center gap-2 rounded-2xl bg-sand-50 px-3.5 py-2.5 font-display text-sm font-bold text-ink shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-lake-500"
        style={{ left: gutter, top: gutter }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2] [stroke-linejoin:round]"><path d="M3 4h10v7H7l-4 3zM13 7h4v7l-3-2H8v-1" /></svg>
        Forum
      </button>

      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Community forum"
          onKeyDown={(e) => (e.stopPropagation(), e.key === "Escape" && setOpen(false))} // typing here never moves the map
          className="fixed inset-0 z-20 flex animate-[fade-in_.2s_ease-out] flex-col bg-sand-100"
        >
          <header className="flex items-center gap-3 bg-linear-to-br from-[#4f7fd1] to-[#3d5fb2] py-3 text-sand-50" style={{ paddingInline: gutter }}>
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-8 shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linejoin:round]"><path d="M3 4h10v7H7l-4 3zM13 7h4v7l-3-2H8v-1" /></svg>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl leading-tight font-bold">Community forum</h2>
              <p className="text-xs opacity-90 max-sm:hidden">Tell a factory what you noticed, or ask it a question. The company replies right here, and everyone can read along.</p>
            </div>
            <button type="button" autoFocus aria-label="Close forum" onClick={() => setOpen(false)} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-white/20 hover:bg-white/35">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-sand-50 stroke-[2.4] [stroke-linecap:round]"><path d="M5 5l10 10M15 5 5 15" /></svg>
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            {/* One chat per factory, by city: the latest message, and how many are waiting for the company to reply */}
            <nav aria-label="Factories" className={`w-full shrink-0 overflow-y-auto border-r border-sand-300/70 bg-sand-50 pb-3 md:w-[310px] ${f ? "max-md:hidden" : ""}`}>
              <p className="px-4 pt-3 text-xs text-ink-soft"><b className="text-ink">{facilities.length}</b> factories · <b className="text-ink">{messages.length}</b> message{messages.length === 1 ? "" : "s"}</p>
              {[...new Set(facilities.map((x) => x.city))].map((city) => (
                <div key={city}>
                  <h3 className="sticky top-0 z-[1] bg-sand-50 px-4 pt-3 pb-1 text-[11px] font-extrabold tracking-[.1em] text-ink-soft uppercase">{city}</h3>
                  {facilities.filter((x) => x.city === city).map((x) => {
                    const thread = messages.filter((m) => m.company === x.tri_id), last = thread.at(-1), n = waiting(thread);
                    return (
                      <button key={x.tri_id} type="button" aria-current={x.tri_id === company} onClick={() => pick(x.tri_id)} className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-white ${x.tri_id === company ? "bg-white shadow-[inset_4px_0_0_#e0703a]" : ""}`}>
                        <Avatar name={x.name} company />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{x.name}</span>
                            {last && <span className="shrink-0 text-[11px] text-ink-soft">{day(last.at) === "Today" ? time(last.at) : day(last.at)}</span>}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{last ? `${last.from === "company" ? "Company" : last.name}: ${last.text}` : x.industry}</span>
                            {n > 0 && <span title={`${n} waiting for a reply`} className="shrink-0 rounded-full bg-[#e0703a] px-1.5 text-[11px] font-bold text-sand-50">{n}</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {f ? (
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Who you're talking to */}
                <div className="flex items-start gap-3 border-b border-sand-300/70 bg-sand-50 px-4 py-3">
                  <button type="button" aria-label="All factories" onClick={() => pick("")} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-white md:hidden">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-ink stroke-[2.4] [stroke-linecap:round] [stroke-linejoin:round]"><path d="m12 5-5 5 5 5" /></svg>
                  </button>
                  <Avatar name={f.name} company big />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg leading-tight font-bold text-ink">{f.name}</h3>
                    <p className="text-xs text-ink-soft">{f.industry} · {f.city} · {f.released.toLocaleString()} lb released on site in 2024</p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5 max-sm:hidden">
                      {f.impacts?.impacts.map((a) => <span key={a.title} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink shadow-[0_1px_0_var(--color-sand-300)]">{a.icon} {a.title}</span>)}
                    </p>
                  </div>
                  <p className="hidden shrink-0 text-right text-xs text-ink-soft sm:block">
                    <b className="text-ink">{chat.length}</b> message{chat.length === 1 ? "" : "s"}
                    <br />
                    {chat.length ? (waiting(chat) ? `${waiting(chat)} waiting for a reply` : "All answered") : "No messages yet"}
                  </p>
                </div>

                {/* The chat: neighbors on one side, the company on the other (yours on the right) */}
                <div ref={log} role="log" aria-label={`Messages with ${f.name}`} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {chat.length === 0 && <p className="mx-auto max-w-sm py-10 text-center text-sm text-ink-soft">No messages yet. Tell {f.name} what you&apos;ve noticed, or ask a question: the company can reply right here.</p>}
                  {chat.map((m, i) => {
                    const fromCompany = m.from === "company", quote = chat.find((q) => q.id === m.replyTo);
                    return (
                      <Fragment key={m.id}>
                        {(i === 0 || day(m.at) !== day(chat[i - 1].at)) && <p className="pt-1 text-center text-[11px] font-extrabold tracking-[.08em] text-ink-soft uppercase">{day(m.at)}</p>}
                        <div className={`flex items-end gap-2 ${fromCompany === asCompany ? "flex-row-reverse" : ""}`}>
                          <Avatar name={fromCompany ? f.name : m.name} company={fromCompany} />
                          <div className={`max-w-[min(560px,78%)] rounded-2xl px-3.5 py-2.5 shadow-[0_2px_0_rgb(60_40_90/.12)] ${fromCompany ? "bg-white text-ink" : "bg-[#e0703a] text-sand-50"} ${fromCompany === asCompany ? "rounded-br-md" : "rounded-bl-md"}`}>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <b>{fromCompany ? f.name : m.name}</b>
                              {fromCompany && <span className="rounded-full bg-[#3d5fb2] px-1.5 py-px text-[10px] font-extrabold text-white uppercase">Company</span>}
                              {m.topic && <span className={`rounded-full px-1.5 py-px text-[11px] font-bold ${fromCompany ? "bg-sand-100" : "bg-white/20"}`}>{topicIcon(m.topic)} {m.topic}</span>}
                              <span className="opacity-75">{time(m.at)}</span>
                            </p>
                            {quote && <p className="mt-1.5 line-clamp-2 rounded-lg border-l-3 border-[#e0703a] bg-sand-50 px-2 py-1 text-xs text-ink-soft">↩ <b>{quote.name}</b>: {quote.text}</p>}
                            <p className="mt-1 text-sm leading-snug whitespace-pre-line">{m.text}</p>
                            {!fromCompany && <p className="mt-1 text-[11px] font-bold opacity-85">{i < chat.findLastIndex((x) => x.from === "company") ? "✓ The company replied" : "Waiting for a reply"}</p>}
                            {asCompany && !fromCompany && <button type="button" onClick={() => setReplyTo(m.id)} className="mt-1 cursor-pointer text-xs font-bold underline underline-offset-2">Reply to this</button>}
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>

                {/* Write: as a neighbor (with what it's about), or as the company */}
                <form onSubmit={(e) => (e.preventDefault(), send())} className="border-t border-sand-300/70 bg-sand-50 px-4 pt-2.5 pb-3">
                  {asCompany ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[#3d5fb2] px-2 py-0.5 font-extrabold text-white">Replying as {f.name}</span>
                      <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Company access code" aria-label="Company access code" className={`${field} w-44 py-1.5 text-xs`} />
                      <button type="button" onClick={() => (setCode(null), setReplyTo(""))} className="cursor-pointer font-bold text-lake-500 hover:underline">Write as a neighbor instead</button>
                      {answering ? (
                        <span className="flex w-full min-w-0 items-center gap-2 rounded-lg border-l-3 border-[#e0703a] bg-white px-2 py-1 text-ink-soft">
                          <span className="min-w-0 flex-1 truncate">↩ Answering <b>{answering.name}</b>: {answering.text}</span>
                          <button type="button" aria-label="Don't answer a specific message" onClick={() => setReplyTo("")} className="cursor-pointer px-1 font-bold">✕</button>
                        </span>
                      ) : (
                        <span className="w-full text-ink-soft">Tap “Reply to this” on a message to answer it directly.</span>
                      )}
                    </div>
                  ) : (
                    <div role="group" aria-label="What it's about" className="mb-2 flex flex-wrap items-center gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
                      <span className="shrink-0 text-xs font-bold text-ink-soft">About:</span>
                      {[...(f.impacts?.impacts ?? []), { icon: "💬", title: "Something else" }].map((a) => (
                        <button
                          key={a.title}
                          type="button"
                          aria-pressed={draft.topic === a.title}
                          onClick={() => setDraft({ ...draft, topic: draft.topic === a.title ? "" : a.title })}
                          className={`shrink-0 cursor-pointer rounded-full border-2 px-2.5 py-1 text-xs font-bold transition-colors ${draft.topic === a.title ? "border-[#e0703a] bg-[#e0703a] text-sand-50" : "border-lake-500/30 bg-white text-lake-500 hover:border-lake-500"}`}
                        >
                          {a.icon} {a.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    {!asCompany && <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} placeholder="Your name (optional)" aria-label="Your name" className={`${field} w-full sm:w-40`} />}
                    <textarea
                      value={draft.text}
                      onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), e.currentTarget.form?.requestSubmit())}
                      maxLength={1000}
                      rows={1}
                      placeholder={asCompany ? `Reply as ${f.name}…` : `Message ${f.name}…`}
                      aria-label="Your message"
                      className={`${field} max-h-32 min-h-10 min-w-0 flex-1 resize-none [field-sizing:content]`}
                    />
                    <button type="submit" aria-label="Send" disabled={!draft.text.trim() || (asCompany && !code)} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#e0703a] text-sand-50 shadow-[0_3px_0_#a8461f] disabled:cursor-default disabled:opacity-50">
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2.4] [stroke-linecap:round] [stroke-linejoin:round]"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
                    </button>
                  </div>
                  {status && <p role="status" className="mt-1.5 text-xs font-bold text-autumn-700">{status}</p>}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-soft">
                    <span>🚨 Spill, fire or someone hurt? Call 911 or the DNR 24-hour spill line, <a href="tel:+18009430003" className="font-bold underline">1-800-943-0003</a>, first.</span>
                    {replies && !asCompany && <button type="button" onClick={() => setCode("")} className="cursor-pointer font-bold text-lake-500 hover:underline">Are you from {f.name}? Reply as the company</button>}
                  </p>
                </form>
              </div>
            ) : (
              <div className="m-auto max-w-md p-6 text-center max-md:hidden">
                <p aria-hidden="true" className="text-5xl">💬</p>
                <h3 className="mt-3 font-display text-2xl font-bold text-ink">Talk to the factories</h3>
                <ol className="mt-4 space-y-2 text-left text-sm text-ink-soft">
                  <li><b className="text-ink">1.</b> Pick a factory on the left.</li>
                  <li><b className="text-ink">2.</b> Tell it what you noticed (a smell, smoke, dust or discolored water) or ask a question.</li>
                  <li><b className="text-ink">3.</b> The company replies in the same chat, and everyone can read along.</li>
                </ol>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
