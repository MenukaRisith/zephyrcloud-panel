import * as React from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { Copy, Database } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CardDescription, CardTitle } from "~/components/ui/card";
import { softInsetClass } from "~/lib/ui";
import { apiFetchAuthed } from "~/services/api.authed.server";
import { requireUser } from "~/services/session.server";

type WorkspaceDatabase = {
  id: string;
  engine: "mariadb" | "mysql" | "postgresql";
  host: string;
  port: number;
  db_name: string;
  username: string;
  password: string;
  public_url: string;
  ssl_mode?: string | null;
};

type LoaderData = {
  workspaceDatabase: WorkspaceDatabase | null;
};

type ActionData =
  | { ok: true; message: string }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  if (Array.isArray(payload.message) && typeof payload.message[0] === "string") {
    return payload.message[0];
  }
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  return fallback;
}

async function safeJson(response: Response) {
  return response.json().catch(() => null);
}

function formatEngineLabel(engine: WorkspaceDatabase["engine"]) {
  if (engine === "postgresql") return "PostgreSQL";
  if (engine === "mysql") return "MySQL";
  return "MariaDB";
}

export async function loader({ request }: { request: Request }): Promise<LoaderData> {
  await requireUser(request);

  const response = await apiFetchAuthed(request, "/api/sites/workspace/database", {
    method: "GET",
  });
  const payload = response.ok ? await safeJson(response) : null;

  return {
    workspaceDatabase: payload && typeof payload === "object" ? (payload as WorkspaceDatabase) : null,
  };
}

export async function action({ request }: { request: Request }): Promise<ActionData | null> {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "create-workspace-database") {
    return null;
  }

  const engine = String(formData.get("engine") || "").trim();
  if (!["mariadb", "mysql", "postgresql"].includes(engine)) {
    return { ok: false, error: "Choose a valid database engine." };
  }

  const response = await apiFetchAuthed(request, "/api/sites/workspace/database", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine }),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    return {
      ok: false,
      error: parseMessage(payload, "Database setup could not be started."),
    };
  }

  const label = engine === "postgresql" ? "PostgreSQL" : engine === "mysql" ? "MySQL" : "MariaDB";

  return {
    ok: true,
    message: `${label} database setup has started. Connection details will appear here when the service is ready.`,
  };
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`${softInsetClass} flex items-start justify-between gap-3 px-4 py-4`}>
      <div className="min-w-0 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {label}
        </div>
        <div className="break-all font-mono text-xs text-[var(--foreground)]">{value}</div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex shrink-0 items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)]"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function DatabasesPage() {
  const { workspaceDatabase } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | null;

  return (
    <div className="space-y-4 pb-8">
      {actionData ? (
        <div
          className={`border px-4 py-3 text-xs ${
            actionData.ok
              ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
              : "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
          }`}
        >
          {actionData.ok ? actionData.message : actionData.error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <CardTitle>{workspaceDatabase ? "Connection details" : "Set up a database"}</CardTitle>
            <CardDescription>
              {workspaceDatabase
                ? "Use these credentials to connect services inside your workspace."
                : "Provision one shared workspace database before creating sites that depend on it."}
            </CardDescription>
          </div>
          {workspaceDatabase ? <Badge>{formatEngineLabel(workspaceDatabase.engine)}</Badge> : null}
        </div>

        {workspaceDatabase ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CopyField label="Public URL" value={workspaceDatabase.public_url} />
            <CopyField label="Host" value={`${workspaceDatabase.host}:${workspaceDatabase.port}`} />
            <CopyField label="Database name" value={workspaceDatabase.db_name} />
            <CopyField label="Username" value={workspaceDatabase.username} />
            <CopyField label="Password" value={workspaceDatabase.password} />
            <CopyField label="SSL mode" value={workspaceDatabase.ssl_mode || "default"} />
          </div>
        ) : (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create-workspace-database" />

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--foreground)]">Database type</div>
                <p className="text-xs text-[var(--text-muted)]">
                  Choose the engine that best matches your application stack.
                </p>
              </div>
              <div className="space-y-3">
                <label className="flex items-start gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--foreground)]">
                  <input type="radio" name="engine" value="mariadb" defaultChecked className="mt-1" />
                  <div className="space-y-2">
                    <div className="font-medium">MariaDB</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Good default for WordPress and MySQL-compatible workloads.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--foreground)]">
                  <input type="radio" name="engine" value="mysql" className="mt-1" />
                  <div className="space-y-2">
                    <div className="font-medium">MySQL</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Use when your app expects standard MySQL behavior.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--foreground)]">
                  <input type="radio" name="engine" value="postgresql" className="mt-1" />
                  <div className="space-y-2">
                    <div className="font-medium">PostgreSQL</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Choose this for Postgres-native frameworks and tooling.
                    </div>
                  </div>
                </label>
              </div>
              <Button type="submit">
                <Database className="h-3.5 w-3.5" />
                Create database
              </Button>
            </div>
          </Form>
        )}
      </section>
    </div>
  );
}
