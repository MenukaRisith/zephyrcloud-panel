export async function action({ request }: { request: Request }) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const body = await request.text();
  const res = await apiFetchAuthed(request, "/api/sites/deploy-keys", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
