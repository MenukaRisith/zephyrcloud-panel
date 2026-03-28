// app/routes/api.github.apps.ts
export async function loader({ request }: { request: Request }) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const res = await apiFetchAuthed(request, "/api/sites/github/apps", { method: "GET" });
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
