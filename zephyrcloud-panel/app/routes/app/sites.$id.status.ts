// app/routes/app/sites.$id.status.tsx
import { apiFetchAuthed } from "~/services/api.authed.server";

type StatusPayload =
  | { ok: true; status: string; source: string; updatedAt: string }
  | { ok: false; error: string };

type DeploymentLike = {
  status?: string;
  created_at?: string;
  createdAt?: string;
};

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

function normalizeRuntimeStatus(rawStatus: string) {
  const status = rawStatus.trim().toLowerCase();

  if (!status) return "PROVISIONING";
  if (
    status.includes("fail") ||
    status.includes("error") ||
    status.includes("crash") ||
    status.includes("unhealthy")
  ) {
    return "ERROR";
  }
  if (
    status.includes("not running") ||
    status.includes("not_running") ||
    status.includes("stop") ||
    status.includes("down") ||
    status.includes("exited") ||
    status.includes("removed")
  ) {
    return "STOPPED";
  }
  if (
    status.includes("run") ||
    status.includes("healthy") ||
    status.includes("ready") ||
    status === "up"
  ) {
    return "RUNNING";
  }
  if (
    status.includes("build") ||
    status.includes("deploy") ||
    status.includes("queue") ||
    status.includes("progress") ||
    status.includes("pull")
  ) {
    return "BUILDING";
  }
  if (
    status.includes("provision") ||
    status.includes("restart") ||
    status.includes("prepar") ||
    status.includes("starting") ||
    status.includes("pending") ||
    status.includes("creat")
  ) {
    return "PROVISIONING";
  }

  return "UNKNOWN";
}

function normalizeDeploymentStatus(rawStatus: string) {
  const status = rawStatus.trim().toLowerCase();

  if (!status) return null;
  if (
    status.includes("success") ||
    status.includes("finish") ||
    status.includes("complete") ||
    status.includes("ready") ||
    status.includes("done")
  ) {
    return "RUNNING";
  }
  if (
    status.includes("fail") ||
    status.includes("error") ||
    status.includes("cancel") ||
    status.includes("abort")
  ) {
    return "ERROR";
  }
  if (
    status.includes("queue") ||
    status.includes("pending") ||
    status.includes("build") ||
    status.includes("deploy") ||
    status.includes("progress") ||
    status.includes("running") ||
    status.includes("start") ||
    status.includes("process")
  ) {
    return "BUILDING";
  }

  return null;
}

function latestDeploymentFrom(payload: unknown): DeploymentLike | null {
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as any).deployments)
      ? (payload as any).deployments
      : payload && typeof payload === "object" && Array.isArray((payload as any).data)
        ? (payload as any).data
        : [];

  if (!Array.isArray(items) || items.length === 0) return null;

  const deployments = items.filter(
    (item): item is DeploymentLike => item && typeof item === "object",
  );

  deployments.sort((left, right) => {
    const leftDate = Date.parse(left.created_at || left.createdAt || "");
    const rightDate = Date.parse(right.created_at || right.createdAt || "");
    if (Number.isNaN(leftDate) && Number.isNaN(rightDate)) return 0;
    if (Number.isNaN(leftDate)) return 1;
    if (Number.isNaN(rightDate)) return -1;
    return rightDate - leftDate;
  });

  return deployments[0] ?? null;
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
    let status = normalizeRuntimeStatus(rawStatus);
    let source =
      typeof data?.source === "string" && data.source.trim()
        ? data.source
        : "coolify";

    if (
      status === "BUILDING" ||
      status === "PROVISIONING" ||
      status === "UNKNOWN"
    ) {
      try {
        const deploymentsRes = await apiFetchAuthed(
          request,
          `/api/sites/${id}/deployments`,
          { method: "GET" },
        );

        if (deploymentsRes.ok) {
          const deploymentsPayload = await deploymentsRes.json().catch(() => null);
          const latestDeployment = latestDeploymentFrom(deploymentsPayload);
          const deploymentStatus = normalizeDeploymentStatus(
            String(latestDeployment?.status || ""),
          );

          if (deploymentStatus === "BUILDING") {
            status = "BUILDING";
            source = "deployments";
          } else if (deploymentStatus === "RUNNING") {
            status = "RUNNING";
            source = "deployments";
          } else if (deploymentStatus === "ERROR") {
            status = "ERROR";
            source = "deployments";
          }
        }
      } catch {
        // Ignore deployment reconciliation errors and return the runtime status.
      }
    }

    return jsonResponse<StatusPayload>({
      ok: true,
      status,
      source,
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
