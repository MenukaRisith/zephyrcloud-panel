import { apiFetchAuthed } from "~/services/api.authed.server";

type Payload =
  | {
      ok: true;
      table: string;
      columns: string[];
      rows: Record<string, unknown>[];
      limit: number;
      offset: number;
      hasMore: boolean;
      nextOffset: number | null;
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
  const table = String(params.table ?? "").trim();
  if (!id || !table) {
    return jsonResponse<Payload>({ ok: false, error: "Missing site id or table" }, { status: 400 });
  }

  const url = new URL(request.url);
  const limit = url.searchParams.get("limit") || "25";
  const offset = url.searchParams.get("offset") || "0";

  try {
    const res = await apiFetchAuthed(
      request,
      `/api/sites/${id}/database/tables/${encodeURIComponent(table)}?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
      { method: "GET" },
    );

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
      const message = String(data?.message ?? data?.error ?? "Failed to load table rows");
      return jsonResponse<Payload>({ ok: false, error: message }, { status: res.status || 500 });
    }

    return jsonResponse<Payload>({
      ok: true,
      table: String(data?.table ?? table),
      columns: Array.isArray(data?.columns) ? data.columns.map((c: unknown) => String(c)) : [],
      rows: Array.isArray(data?.rows) ? data.rows : [],
      limit: Number(data?.limit ?? 25),
      offset: Number(data?.offset ?? 0),
      hasMore: Boolean(data?.hasMore),
      nextOffset: data?.nextOffset == null ? null : Number(data.nextOffset),
    });
  } catch (error: any) {
    return jsonResponse<Payload>(
      { ok: false, error: error?.message ? String(error.message) : "Unknown error" },
      { status: 500 },
    );
  }
}
