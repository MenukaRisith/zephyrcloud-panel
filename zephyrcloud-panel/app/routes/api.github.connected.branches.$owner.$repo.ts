export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { owner: string; repo: string };
}) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const res = await apiFetchAuthed(
    request,
    `/api/github/branches/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}`,
    {
      method: "GET",
    },
  );

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
