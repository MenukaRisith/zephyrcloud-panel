import { apiFetchAuthed } from "~/services/api.authed.server";

type MetricsPayload =
  | {
      ok: true;
      site_id: string;
      refreshed_at: string;
      availability: { enabled: boolean; reason?: string };
      limits: { cpu_limit: number; memory_mb: number };
      current: {
        cpu_percent: number | null;
        cpu_limit_percentage: number | null;
        memory_used_mb: number | null;
        memory_percentage: number | null;
      };
      history: {
        cpu: Array<{ time: string; percent: number }>;
        memory: Array<{
          time: string;
          used_mb: number;
          total_mb: number | null;
          used_percent: number;
        }>;
      };
    }
  | { ok: false; error: string };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMetricsPayload(id: string, payload: unknown): MetricsPayload {
  if (!isRecord(payload)) {
    return { ok: false, error: "Metrics payload was not returned." };
  }

  const availability = isRecord(payload.availability)
    ? {
        enabled: payload.availability.enabled === true,
        reason:
          typeof payload.availability.reason === "string"
            ? payload.availability.reason
            : undefined,
      }
    : { enabled: false, reason: "Metrics availability details are missing." };

  const limits = isRecord(payload.limits)
    ? {
        cpu_limit:
          typeof payload.limits.cpu_limit === "number" ? payload.limits.cpu_limit : 0,
        memory_mb:
          typeof payload.limits.memory_mb === "number" ? payload.limits.memory_mb : 0,
      }
    : { cpu_limit: 0, memory_mb: 0 };

  const current = isRecord(payload.current)
    ? {
        cpu_percent:
          typeof payload.current.cpu_percent === "number" ? payload.current.cpu_percent : null,
        cpu_limit_percentage:
          typeof payload.current.cpu_limit_percentage === "number"
            ? payload.current.cpu_limit_percentage
            : null,
        memory_used_mb:
          typeof payload.current.memory_used_mb === "number"
            ? payload.current.memory_used_mb
            : null,
        memory_percentage:
          typeof payload.current.memory_percentage === "number"
            ? payload.current.memory_percentage
            : null,
      }
    : {
        cpu_percent: null,
        cpu_limit_percentage: null,
        memory_used_mb: null,
        memory_percentage: null,
      };

  const history = isRecord(payload.history)
    ? {
        cpu: Array.isArray(payload.history.cpu)
          ? payload.history.cpu.filter(isRecord).map((point) => ({
              time: typeof point.time === "string" ? point.time : new Date().toISOString(),
              percent: typeof point.percent === "number" ? point.percent : 0,
            }))
          : [],
        memory: Array.isArray(payload.history.memory)
          ? payload.history.memory.filter(isRecord).map((point) => ({
              time: typeof point.time === "string" ? point.time : new Date().toISOString(),
              used_mb: typeof point.used_mb === "number" ? point.used_mb : 0,
              total_mb: typeof point.total_mb === "number" ? point.total_mb : null,
              used_percent:
                typeof point.used_percent === "number" ? point.used_percent : 0,
            }))
          : [],
      }
    : { cpu: [], memory: [] };

  return {
    ok: true,
    site_id: typeof payload.site_id === "string" ? payload.site_id : id,
    refreshed_at:
      typeof payload.refreshed_at === "string"
        ? payload.refreshed_at
        : new Date().toISOString(),
    availability,
    limits,
    current,
    history,
  };
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
    return jsonResponse<MetricsPayload>(
      { ok: false, error: "Missing site id" },
      { status: 400 },
    );
  }

  try {
    const res = await apiFetchAuthed(request, `/api/sites/${id}/metrics`, {
      method: "GET",
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      return jsonResponse<MetricsPayload>(
        { ok: false, error: "Failed to fetch live metrics" },
        { status: res.status || 500 },
      );
    }

    return jsonResponse<MetricsPayload>(normalizeMetricsPayload(id, payload));
  } catch (error) {
    return jsonResponse<MetricsPayload>(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch live metrics",
      },
      { status: 500 },
    );
  }
}
