// Ruby's free-text answers: Gemini, grounded in the study notes under cities/ (read on the server, so the
// API key never reaches the browser). Needs GEMINI_API_KEY in web/.env.local; GEMINI_MODEL is optional.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const CITIES = path.join(process.cwd(), "..", "cities");

const RULES = `You are Ruby, the friendly guide inside Lakeshore Watch, an interactive map of industrial pollution along Wisconsin's Lake Michigan shore. It covers three cities (Green Bay, Manitowoc, Sheboygan) and the top 3 factories in each by 2024 on-site releases (EPA Toxics Release Inventory). Answer the visitor using the study notes below.
- Keep answers short: 2 to 4 sentences of plain, warm language. No markdown, lists or headings.
- Never say a factory causes a specific harm. If it releases something linked to a local problem, call it a "possible contributor", and say so when a problem comes mainly from older or distant sources.
- Reported releases are not violations (most are legal under permit), and pounds are not the same as harm.
- For fish, beach and drinking-water advice, point people to the Wisconsin DNR and local health departments instead of making up rules.
- If the notes don't cover something, say you don't know. Stay on topic: these cities, their factories, pollution, health and what residents can do.`;

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
    const text = String(m.text).slice(0, 800);
    if (turns.at(-1)!.role === role) turns.at(-1)!.parts.push({ text });
    else turns.push({ role, parts: [{ text }] });
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${RULES}\n\nThe visitor is looking at: ${place || "the whole map"}.\n\nSTUDY NOTES\n${await notes}` }] },
      contents: turns,
    }),
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!res.ok || !text) {
    console.error("Gemini request failed", res.status, JSON.stringify(data).slice(0, 400));
    return Response.json({ error: "gemini" }, { status: 502 });
  }
  return Response.json({ text });
}
