// app/routes/api.github.branches.$appUuid.$owner.$repo.ts
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { appUuid?: string; owner?: string; repo?: string };
}) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const appUuid = params.appUuid || "";
  const owner = params.owner || "";
  const repo = params.repo || "";

  const res = await apiFetchAuthed(
    request,
    `/api/sites/github/branches/${encodeURIComponent(appUuid)}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
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
