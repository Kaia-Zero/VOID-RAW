import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const id = context.params.id;
  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return notFound();

  const text = await getStore("pastes").get("p-" + id);
  if (text === null) return notFound();

  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
};

export const config = { path: "/raw/:id" };
