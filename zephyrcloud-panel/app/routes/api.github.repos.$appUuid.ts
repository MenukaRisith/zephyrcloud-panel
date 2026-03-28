// app/routes/api.github.repos.$appUuid.ts
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { appUuid?: string };
}) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const appUuid = params.appUuid || "";
  const res = await apiFetchAuthed(
    request,
    `/api/sites/github/repos/${encodeURIComponent(appUuid)}`,
    { method: "GET" },
  );

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
