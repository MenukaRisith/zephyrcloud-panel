// app/routes/app/sites.$id.status.tsx
import { apiFetchAuthed } from "~/services/api.authed.server";

type StatusPayload =
  | { ok: true; status: string; source: string; updatedAt: string }
  | { ok: false; error: string };

// Small helper to return JSON consistently
function jsonResponse<T>(data: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
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
    return jsonResponse<StatusPayload>(
      { ok: false, error: "Missing site id" },
      { status: 400 },
    );
  }

  try {
    const res = await apiFetchAuthed(request, `/api/sites/${id}/status`, {
      method: "GET",
    });

    // backend might return plain text or json; normalize safely
    const text = await res.text();
    let data: any = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { status: text };
      }
    }

    if (!res.ok) {
      return jsonResponse<StatusPayload>(
        { ok: false, error: String(data?.message ?? "Failed to fetch status") },
        { status: res.status || 500 },
      );
    }

    const rawStatus = String(
      data?.status ?? data?.state ?? data?.data?.status ?? "",
    ).trim();

    const status = (rawStatus ? rawStatus.toUpperCase() : "PROVISIONING") as string;

    return jsonResponse<StatusPayload>({
      ok: true,
      status,
      source:
        typeof data?.source === "string" && data.source.trim()
          ? data.source
          : "coolify",
      updatedAt:
        typeof data?.updatedAt === "string" && data.updatedAt.trim()
          ? data.updatedAt
          : new Date().toISOString(),
    });
  } catch (e: any) {
    return jsonResponse<StatusPayload>(
      { ok: false, error: e?.message ? String(e.message) : "Unknown error" },
      { status: 500 },
    );
  }
}
