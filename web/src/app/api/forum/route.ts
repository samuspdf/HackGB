// Community forum: a chat per company. Neighbors write in it, and the company replies (with its access code).
// Each company's chat is saved in its own folder: cities/<city>/<company>/forum.json.
import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface Message { id: string; company: string; from: "neighbor" | "company"; name: string; topic: string; text: string; at: string; replyTo?: string }

const CITIES = path.join(process.cwd(), "..", "cities");
const bad = (error: string, status = 400) => Response.json({ error }, { status });
const clean = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

// TRI ID → that company's forum file (every company folder with a facility.json)
async function forumFiles() {
  const files: Record<string, string> = {};
  for (const city of await readdir(CITIES)) {
    for (const co of await readdir(path.join(CITIES, city)).catch(() => [])) {
      const facility = await readFile(path.join(CITIES, city, co, "facility.json"), "utf8").catch(() => "");
      if (facility) files[JSON.parse(facility).tri_id] = path.join(CITIES, city, co, "forum.json");
    }
  }
  return files;
}
const load = async (file: string): Promise<Message[]> => JSON.parse(await readFile(file, "utf8").catch(() => "[]"));

// GET /api/forum → every company's messages, oldest first
export async function GET() {
  const messages = (await Promise.all(Object.values(await forumFiles()).map(load))).flat();
  return Response.json({ messages: messages.sort((a, b) => a.at.localeCompare(b.at)), companyReplies: !!process.env.FORUM_COMPANY_CODE });
}

// POST { company, name, topic, text } → a neighbor's message;  POST { company, text, code, replyTo } → the company's reply
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const file = (await forumFiles())[body.company];
  const text = clean(body.text, 1000);
  if (!file) return bad("Unknown company");
  if (!text) return bad("Please write something first");
  const company = body.code !== undefined;
  if (company && (!process.env.FORUM_COMPANY_CODE || body.code !== process.env.FORUM_COMPANY_CODE)) return bad("That company access code isn't right", 403);
  const messages = await load(file);
  const replyTo = company && messages.some((m) => m.id === body.replyTo) ? { replyTo: body.replyTo } : {};
  messages.push({ id: randomUUID(), company: body.company, from: company ? "company" : "neighbor", name: company ? "" : clean(body.name, 40) || "Anonymous", topic: clean(body.topic, 60), text, at: new Date().toISOString(), ...replyTo });
  await writeFile(file, JSON.stringify(messages, null, 2) + "\n");
  return Response.json({ ok: true });
}
