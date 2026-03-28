import { apiFetchAuthed } from "~/services/api.authed.server";

type Payload =
  | {
      ok: true;
      connected: boolean;
      database: string;
      engine: string;
      tables: Array<{ name: string; approxRows: number | null }>;
    }
  | { ok: false; error: string };

function jsonResponse<T>(data: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | undefined>;
}) {
  const id = String(params.id ?? "").trim();
  if (!id) {
    return jsonResponse<Payload>({ ok: false, error: "Missing site id" }, { status: 400 });
  }

  try {
    const res = await apiFetchAuthed(request, `/api/sites/${id}/database/tables`, { method: "GET" });
    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }

    if (!res.ok) {
      const message = String(data?.message ?? data?.error ?? "Failed to load database tables");
      return jsonResponse<Payload>({ ok: false, error: message }, { status: res.status || 500 });
    }

    return jsonResponse<Payload>({
      ok: true,
      connected: Boolean(data?.connected),
      database: String(data?.database ?? ""),
      engine: String(data?.engine ?? ""),
      tables: Array.isArray(data?.tables) ? data.tables : [],
    });
  } catch (error: any) {
    return jsonResponse<Payload>(
      { ok: false, error: error?.message ? String(error.message) : "Unknown error" },
      { status: 500 },
    );
  }
}
