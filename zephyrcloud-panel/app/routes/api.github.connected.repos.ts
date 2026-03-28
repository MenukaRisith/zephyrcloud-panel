export async function loader({ request }: { request: Request }) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const res = await apiFetchAuthed(request, "/api/github/repos", {
    method: "GET",
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
