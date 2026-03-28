// app/routes/app/site.$id.logs.ts
import { apiFetchAuthed } from "~/services/api.authed.server";

type Ok = {
  ok: true;
  logs: string;
  lines?: number;
  updatedAt?: string;
  source?: string;
};

type Err = { ok: false; error: string };

export async function loader({ request, params }: { request: Request; params: any }) {
  const id = String(params.id);
  const url = new URL(request.url);
  const lines = url.searchParams.get("lines") || "200";

  const res = await apiFetchAuthed(
    request,
    `/api/sites/${id}/logs?lines=${encodeURIComponent(lines)}`
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const payload: Err = { ok: false, error: text || `Failed to load logs (${res.status})` };

    return new Response(JSON.stringify(payload), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await res.json();
  const payload: Ok = { ok: true, ...data };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
