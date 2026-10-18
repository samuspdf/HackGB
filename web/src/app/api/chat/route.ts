// Ruby's free-text answers: Gemini, grounded in the study notes under cities/ (read on the server, so the
// API key never reaches the browser). Needs GEMINI_API_KEY in web/.env.local; GEMINI_MODEL is optional.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const CITIES = path.join(process.cwd(), "..", "cities");

const RULES = `You are Ruby, the friendly guide inside Gunk Radar, an interactive map of industrial pollution along Wisconsin's Lake Michigan shore. It covers four cities (Green Bay, Manitowoc, Sheboygan, Milwaukee) and the top 3 factories in each by 2024 on-site releases (EPA Toxics Release Inventory). Answer the visitor using the study notes below.

How to answer
- Be warm, curious and conversational, like a knowledgeable local guide. Give real detail: usually 4 to 8 sentences (about 80 to 180 words), or a short intro followed by a few lines starting with "• ". Plain text only: no asterisks, markdown or headings. You've already greeted the visitor, so don't welcome them again; get straight to the answer.
- Include the specific facts that answer the question: amounts with units and year, which chemicals, where they go, who lives nearby, and the compliance record. Say where a fact comes from when it helps (for example "EPA's 2024 Toxics Release Inventory" or "EPA's ECHO compliance records").
- You may go beyond the notes with general, well-established knowledge: what a chemical is, how it affects health or wildlife, how pollution moves through air and water, how permits work, and practical things people can do. Introduce it as general background ("In general, ..."), and never invent facts about these specific factories, places or people.
- End with a short, natural follow-up suggestion or question when it fits.

Accuracy
- Use numbers exactly as the notes give them. Don't add up, round differently or estimate new figures unless you say so. If the notes call something disputed, unverified or to be confirmed, say that too.
- If the notes don't cover something specific to these factories or places, say you don't know rather than guessing, and suggest where to look (EPA ECHO, the Wisconsin DNR, the local health department).

Fairness and safety
- Never say a factory causes a specific harm. If it releases something linked to a local problem, call it a "possible contributor", and say so when a problem comes mainly from older or distant sources.
- Reported releases are not violations (most are legal under permit), and pounds are not the same as harm.
- For fish, beach and drinking-water advice, point people to the Wisconsin DNR and local health departments instead of making up rules.
- If the visitor wants to report a concern (a smell, smoke, dust, noise, discolored water, sick fish or birds, anything about a factory), or to complain about or praise a company, send them to the community forum: a chat where they message the company directly and the company replies. A button to open it appears under your answer. If something is happening right now (a spill, a fire, someone hurt), tell them to call 911 or the DNR 24-hour spill line (1-800-943-0003) first.
- Stay on topic: these cities, their factories, pollution, health, nature and what residents can do.`;

const read = (...parts: string[]) => readFile(path.join(CITIES, ...parts), "utf8").catch(() => "");
const dirs = async (...parts: string[]) =>
  (await readdir(path.join(CITIES, ...parts), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

// Overview, each city's notes, and every mapped factory's data, impacts and research (loaded once)
let notes: Promise<string> | undefined;
async function loadNotes() {
  const parts = [await read("README.md")];
  for (const city of await dirs()) {
    parts.push(await read(city, "README.md"));
    for (const co of await dirs(city)) {
      parts.push(...(await Promise.all(["facility.json", "impacts.json", "research.md"].map((f) => read(city, co, f)))));
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no-key" }, { status: 503 });
  const { messages, place } = (await request.json()) as { messages: { from: "ruby" | "you"; text: string }[]; place?: string };
  notes ??= loadNotes();

  // Gemini wants a conversation that starts with the user and alternates turns: merge runs of the same speaker
  const turns: { role: "user" | "model"; parts: { text: string }[] }[] = [{ role: "user", parts: [{ text: "Hi Ruby!" }] }];
  for (const m of messages.slice(-12)) {
    const role = m.from === "you" ? "user" : "model";
    const text = String(m.text).slice(0, 2000);
    if (turns.at(-1)!.role === role) turns.at(-1)!.parts.push({ text });
    else turns.push({ role, parts: [{ text }] });
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${RULES}\n\nThe visitor is looking at: ${place || "the whole map"}.\n\nSTUDY NOTES\n${await notes}` }] },
      contents: turns,
      generationConfig: { maxOutputTokens: 900 },
    }),
  }).catch((err) => (console.error("Gemini unreachable", err.cause?.code ?? err), null)); // e.g. offline: she apologizes instead of the route crashing
  const data = await res?.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").replace(/\*\*|__/g, "").trim(); // she's told to write plain text; drop any stray markdown bold
  if (!res?.ok || !text) {
    if (res) console.error("Gemini request failed", res.status, JSON.stringify(data).slice(0, 400));
    return Response.json({ error: "gemini" }, { status: 502 });
  }
  return Response.json({ text });
}
