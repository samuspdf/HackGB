// Community forum: visitors comment on a company, and the company can reply (with its access code).
// Each company's thread is saved in its own folder: cities/<city>/<company>/forum.json.
import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface Post { id: string; company: string; name: string; text: string; at: string; replies: { text: string; at: string }[] }

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
const load = async (file: string): Promise<Post[]> => JSON.parse(await readFile(file, "utf8").catch(() => "[]"));

// GET /api/forum?company=<TRI ID> (or every company), newest first
export async function GET(request: Request) {
  const files = await forumFiles();
  const company = new URL(request.url).searchParams.get("company");
  const posts = (await Promise.all((company ? [files[company]] : Object.values(files)).filter(Boolean).map(load))).flat();
  return Response.json({ posts: posts.sort((a, b) => b.at.localeCompare(a.at)), companyReplies: !!process.env.FORUM_COMPANY_CODE });
}

// POST { company, name, text } → new comment;  POST { company, postId, text, code } → company reply
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const file = (await forumFiles())[body.company];
  const text = clean(body.text, 1000);
  if (!file) return bad("Unknown company");
  if (!text) return bad("Please write something first");
  const posts = await load(file);
  const at = new Date().toISOString();
  if (body.postId) {
    if (!process.env.FORUM_COMPANY_CODE || body.code !== process.env.FORUM_COMPANY_CODE) return bad("That company access code isn't right", 403);
    const post = posts.find((p) => p.id === body.postId);
    if (!post) return bad("That comment no longer exists", 404);
    post.replies.push({ text, at });
  } else {
    posts.push({ id: randomUUID(), company: body.company, name: clean(body.name, 40) || "Anonymous", text, at, replies: [] });
  }
  await writeFile(file, JSON.stringify(posts, null, 2) + "\n");
  return Response.json({ ok: true });
}
