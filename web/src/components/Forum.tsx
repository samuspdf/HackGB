"use client";

// Community forum (top-left): visitors comment on a company's actions, and the company can reply.
// Comments live on the server (/api/forum), saved per company under cities/<city>/<company>/forum.json.
import { useImperativeHandle, useState, type Ref } from "react";
import type { Facility } from "@/lib/scene";

interface Post { id: string; company: string; name: string; text: string; at: string; replies: { text: string; at: string }[] }
export interface ForumHandle { open(company?: string): void }

const gutter = "clamp(12px,2vw,24px)";
const field = "w-full rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus-visible:ring-2 focus-visible:ring-lake-500";
const orange = "cursor-pointer rounded-xl bg-[#e0703a] px-3.5 py-2 text-sm font-bold text-sand-50 shadow-[0_3px_0_#a8461f] disabled:cursor-default disabled:opacity-50";
const when = (at: string) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Forum({ ref, facilities }: { ref?: Ref<ForumHandle>; facilities: Facility[] }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState(""); // "" = all companies
  const [posts, setPosts] = useState<Post[]>([]);
  const [companyReplies, setCompanyReplies] = useState(false);
  const [draft, setDraft] = useState({ name: "", text: "" });
  const [reply, setReply] = useState<{ postId: string; text: string; code: string } | null>(null);
  const [status, setStatus] = useState("");
  const nameOf = (id: string) => facilities.find((f) => f.tri_id === id)?.name ?? "";

  const load = async (id: string) => {
    setCompany(id);
    const data = await fetch(`/api/forum${id ? `?company=${id}` : ""}`).then((r) => r.json()).catch(() => null);
    setPosts(data?.posts ?? []);
    setCompanyReplies(!!data?.companyReplies);
  };
  const send = async (body: object) => {
    setStatus("Posting…");
    const res = await fetch("/api/forum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setStatus(res?.ok ? "" : data?.error ?? "Couldn't post just now. Please try again.");
    if (res?.ok) await load(company);
    return !!res?.ok;
  };

  useImperativeHandle(ref, () => ({ open: (id = "") => (setOpen(true), load(id)) }));

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : (setOpen(true), load(company)))}
        className="fixed z-[4] flex cursor-pointer items-center gap-2 rounded-2xl bg-sand-50 px-3.5 py-2.5 font-display text-sm font-bold text-ink shadow-[0_4px_0_var(--color-sand-300),0_10px_18px_rgb(75_79_147/.2)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-lake-500"
        style={{ left: gutter, top: gutter }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2] [stroke-linejoin:round]"><path d="M3 4h10v7H7l-4 3zM13 7h4v7l-3-2H8v-1" /></svg>
        Forum
      </button>

      {open && (
        <section
          aria-label="Community forum"
          onKeyDown={(e) => e.stopPropagation()} // typing here never moves the map
          className="fixed z-[4] flex w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-sand-50/97 shadow-[0_5px_0_var(--color-sand-300),0_14px_26px_rgb(75_79_147/.22)] backdrop-blur animate-[bubble-in_.25s_ease-out]"
          style={{ left: gutter, top: `calc(${gutter} + 52px)`, maxHeight: `calc(100dvh - 2 * ${gutter} - 52px)` }}
        >
          <header className="flex items-start gap-2 bg-linear-to-br from-[#4f7fd1] to-[#3d5fb2] px-4 pt-3 pb-3 text-sand-50">
            <div className="flex-1">
              <h2 className="font-display text-lg leading-tight font-bold">Community forum</h2>
              <p className="text-xs opacity-90">Tell the companies what you think. They can reply here.</p>
            </div>
            <button type="button" aria-label="Close forum" onClick={() => setOpen(false)} className="grid size-7 cursor-pointer place-items-center rounded-full bg-white/20 hover:bg-white/35">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 fill-none stroke-sand-50 stroke-[2.4] [stroke-linecap:round]"><path d="M5 5l10 10M15 5 5 15" /></svg>
            </button>
          </header>

          <div className="space-y-3 overflow-y-auto p-3">
            <select aria-label="Company" value={company} onChange={(e) => load(e.target.value)} className={`${field} font-bold`}>
              <option value="">All companies</option>
              {[...new Set(facilities.map((f) => f.city))].map((city) => (
                <optgroup key={city} label={city}>
                  {facilities.filter((f) => f.city === city).map((f) => <option key={f.tri_id} value={f.tri_id}>{f.name}</option>)}
                </optgroup>
              ))}
            </select>

            {company ? (
              <form
                onSubmit={async (e) => (e.preventDefault(), (await send({ company, ...draft })) && setDraft({ name: draft.name, text: "" }))}
                className="space-y-2 rounded-xl bg-white/60 p-2.5"
              >
                <p className="text-xs font-extrabold tracking-[.08em] text-autumn-700 uppercase">Comment on {nameOf(company)} · {facilities.find((f) => f.tri_id === company)?.city}</p>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} placeholder="Your name (optional)" aria-label="Your name" className={field} />
                <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} maxLength={1000} rows={3} placeholder="What did you notice? What would you like the company to do?" aria-label="Your comment" className={`${field} resize-none`} />
                <button type="submit" disabled={!draft.text.trim()} className={orange}>Post comment</button>
              </form>
            ) : (
              <p className="px-1 text-xs text-ink-soft">Pick a company above to add your own comment.</p>
            )}
            {status && <p role="status" className="px-1 text-xs font-bold text-autumn-700">{status}</p>}

            {posts.length === 0 && <p className="px-1 py-3 text-center text-sm text-ink-soft">No comments yet. Be the first!</p>}
            {posts.map((p) => (
              <article key={p.id} className="rounded-xl bg-white p-3 shadow-[0_2px_0_var(--color-sand-300)]">
                <p className="text-xs text-ink-soft">
                  <span className="font-bold text-ink">{p.name}</span> · {when(p.at)}
                  {!company && <> · <span className="font-bold text-lake-500">{nameOf(p.company)}</span></>}
                </p>
                <p className="mt-1 text-[13px] leading-snug whitespace-pre-line text-ink">{p.text}</p>
                {p.replies.map((r) => (
                  <div key={r.at} className="mt-2 ml-3 rounded-lg border-l-3 border-[#e0703a] bg-sand-50 px-2.5 py-2">
                    <p className="text-xs text-ink-soft">
                      <span className="rounded-full bg-[#e0703a] px-1.5 py-0.5 text-[10px] font-extrabold text-sand-50 uppercase">Company reply</span>{" "}
                      <span className="font-bold text-ink">{nameOf(p.company)}</span> · {when(r.at)}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug whitespace-pre-line text-ink">{r.text}</p>
                  </div>
                ))}
                {companyReplies && (reply?.postId === p.id ? (
                  <form onSubmit={async (e) => (e.preventDefault(), (await send({ company: p.company, postId: p.id, text: reply.text, code: reply.code })) && setReply(null))} className="mt-2 space-y-2">
                    <textarea value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value })} maxLength={1000} rows={2} placeholder={`Reply as ${nameOf(p.company)}`} aria-label="Company reply" className={`${field} resize-none`} />
                    <div className="flex gap-2">
                      <input type="password" value={reply.code} onChange={(e) => setReply({ ...reply, code: e.target.value })} placeholder="Company access code" aria-label="Company access code" className={field} />
                      <button type="submit" disabled={!reply.text.trim() || !reply.code} className={orange}>Reply</button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => setReply({ postId: p.id, text: "", code: "" })} className="mt-2 cursor-pointer text-xs font-bold text-lake-500 hover:underline">
                    Reply as the company
                  </button>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
