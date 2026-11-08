import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const MAX_BYTES = 1048576;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id);
const randId = () => Math.random().toString(36).slice(2, 10);

function authed(req) {
  const pw = process.env.ADMIN_PASSWORD || "";
  const given = req.headers.get("x-admin-password") || "";
  const a = Buffer.from(pw), b = Buffer.from(given);
  return pw.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  if (!process.env.ADMIN_PASSWORD) return json({ error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD" }, 500);
  if (!authed(req)) return json({ error: "รหัสผ่านไม่ถูกต้อง" }, 401);

  const store = getStore("pastes");
  const path = new URL(req.url).pathname;
  const meta = (await store.get("meta", { type: "json" })) || {};

  if (path === "/api/list") return json(meta);

  if (path === "/api/get") {
    const id = new URL(req.url).searchParams.get("id");
    if (!validId(id) || !meta[id]) return json({ error: "ไม่พบรายการ" }, 404);
    return json({ id, title: meta[id].title, content: (await store.get("p-" + id)) || "" });
  }

  if (path === "/api/save" && req.method === "POST") {
    const b = await req.json();
    const content = String(b.content || "").replace(/\r\n/g, "\n");
    let id = String(b.id || "").trim();
    const title = String(b.title || "").trim();
    if (!content) return json({ error: "กรุณาใส่เนื้อหา" }, 400);
    if (Buffer.byteLength(content) > MAX_BYTES) return json({ error: "เนื้อหาใหญ่เกิน 1 MB" }, 400);
    if (id && !validId(id)) return json({ error: "ชื่อลิงก์ใช้ได้เฉพาะ A-Z a-z 0-9 _ - (ไม่เกิน 40 ตัว)" }, 400);
    if (!b.editing && id && meta[id]) return json({ error: "ชื่อลิงก์นี้ถูกใช้แล้ว" }, 409);
    if (!id) { do { id = randId(); } while (meta[id]); }
    await store.set("p-" + id, content);
    meta[id] = { title: title || id, ts: meta[id]?.ts || Date.now() };
    await store.setJSON("meta", meta);
    return json({ ok: true, id });
  }

  if (path === "/api/delete" && req.method === "POST") {
    const { id } = await req.json();
    if (!validId(id)) return json({ error: "id ไม่ถูกต้อง" }, 400);
    await store.delete("p-" + id);
    delete meta[id];
    await store.setJSON("meta", meta);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
};

export const config = { path: "/api/*" };
