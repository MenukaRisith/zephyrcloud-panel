import * as React from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { Copy, Database } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CardDescription, CardTitle } from "~/components/ui/card";
import { softInsetClass } from "~/lib/ui";
import { apiFetchAuthed } from "~/services/api.authed.server";
import { requireUser } from "~/services/session.server";

type DatabaseDetails = {
  id: string;
  engine: string;
  host: string;
  port: number;
  db_name: string;
  username: string;
  password?: string;
  public_url?: string | null;
  ssl_mode?: string | null;
  source: "workspace" | "site";
  siteName?: string | null;
};

type LoaderData = {
  database: DatabaseDetails | null;
};

type ActionData =
  | { ok: true; message: string; database: DatabaseDetails | null }
  | { ok: false; error: string };

type SiteSummary = {
  id: string;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string" && payload.message.trim())
    return payload.message;
  if (
    Array.isArray(payload.message) &&
    typeof payload.message[0] === "string"
  ) {
    return payload.message[0];
  }
  if (typeof payload.error === "string" && payload.error.trim())
    return payload.error;
  return fallback;
}

async function safeJson(response: Response) {
  return response.json().catch(() => null);
}

function formatEngineLabel(engine: string) {
  if (engine === "postgresql" || engine === "postgres") return "PostgreSQL";
  if (engine === "mysql") return "MySQL";
  if (engine === "mariadb") return "MariaDB";
  return engine.toUpperCase();
}

function parseDatabaseDetails(
  payload: unknown,
  source: DatabaseDetails["source"],
  siteName?: string | null,
): DatabaseDetails | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.id !== "string") return null;
  if (typeof payload.engine !== "string") return null;
  if (typeof payload.host !== "string") return null;
  if (typeof payload.port !== "number") return null;
  if (typeof payload.db_name !== "string") return null;
  if (typeof payload.username !== "string") return null;

  return {
    id: payload.id,
    engine: payload.engine,
    host: payload.host,
    port: payload.port,
    db_name: payload.db_name,
    username: payload.username,
    password:
      typeof payload.password === "string" ? payload.password : undefined,
    public_url:
      typeof payload.public_url === "string" ? payload.public_url : null,
    ssl_mode: typeof payload.ssl_mode === "string" ? payload.ssl_mode : null,
    source,
    siteName,
  };
}

function parseSiteSummaries(payload: unknown): SiteSummary[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .filter(isRecord)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      name: typeof entry.name === "string" ? entry.name : "",
    }))
    .filter((entry) => entry.id.length > 0);
}

async function loadFirstAvailableDatabase(
  request: Request,
): Promise<DatabaseDetails | null> {
  const workspaceResponse = await apiFetchAuthed(
    request,
    "/api/sites/workspace/database",
    {
      method: "GET",
    },
  );
  const workspacePayload = workspaceResponse.ok
    ? await safeJson(workspaceResponse)
    : null;
  const workspaceDatabase = parseDatabaseDetails(workspacePayload, "workspace");
  if (workspaceDatabase) {
    return workspaceDatabase;
  }

  const sitesResponse = await apiFetchAuthed(request, "/api/sites", {
    method: "GET",
  });
  if (!sitesResponse.ok) {
    return null;
  }

  const sites = parseSiteSummaries(await safeJson(sitesResponse));
  for (const site of sites) {
    const databaseResponse = await apiFetchAuthed(
      request,
      `/api/sites/${site.id}/database`,
      {
        method: "GET",
      },
    );
    if (!databaseResponse.ok) {
      continue;
    }

    const database = parseDatabaseDetails(
      await safeJson(databaseResponse),
      "site",
      site.name || null,
    );
    if (database) {
      return database;
    }
  }

  return null;
}

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  await requireUser(request);

  return {
    database: await loadFirstAvailableDatabase(request),
  };
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<ActionData | null> {
  await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "create-workspace-database") {
    return null;
  }

  const engine = String(formData.get("engine") || "").trim();
  if (!["mariadb", "mysql", "postgresql"].includes(engine)) {
    return { ok: false, error: "Choose a valid database engine." };
  }

  const response = await apiFetchAuthed(
    request,
    "/api/sites/workspace/database",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine }),
    },
  );

  const payload = await safeJson(response);
  if (!response.ok) {
    return {
      ok: false,
      error: parseMessage(payload, "Database setup could not be started."),
    };
  }

  const label =
    engine === "postgresql"
      ? "PostgreSQL"
      : engine === "mysql"
        ? "MySQL"
        : "MariaDB";
  const database = parseDatabaseDetails(payload, "workspace");

  return {
    ok: true,
    message: database
      ? `${label} database is ready. Connection details are shown below.`
      : `${label} database setup has started. Connection details will appear here when the service is ready.`,
    database,
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
    <div
      className={`${softInsetClass} flex items-start justify-between gap-3 px-4 py-4`}
    >
      <div className="min-w-0 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {label}
        </div>
        <div className="break-all font-mono text-xs text-[var(--foreground)]">
          {value}
        </div>
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
  const { database } = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData | null;
  const displayedDatabase =
    actionData && actionData.ok && actionData.database
      ? actionData.database
      : database;
  const showingExistingSiteDatabase =
    displayedDatabase?.source === "site" && displayedDatabase.siteName;

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
            <CardTitle>
              {displayedDatabase ? "Connection details" : "Set up a database"}
            </CardTitle>
            <CardDescription>
              {displayedDatabase
                ? showingExistingSiteDatabase
                  ? `Showing the first available database from ${displayedDatabase.siteName}.`
                  : "Use these credentials to connect services inside your workspace."
                : "Provision one shared workspace database before creating sites that depend on it."}
            </CardDescription>
          </div>
          {displayedDatabase ? (
            <Badge>{formatEngineLabel(displayedDatabase.engine)}</Badge>
          ) : null}
        </div>

        {displayedDatabase ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {displayedDatabase.public_url ? (
              <CopyField
                label="Public URL"
                value={displayedDatabase.public_url}
              />
            ) : null}
            <CopyField
              label="Host"
              value={`${displayedDatabase.host}:${displayedDatabase.port}`}
            />
            <CopyField
              label="Database name"
              value={displayedDatabase.db_name}
            />
            <CopyField label="Username" value={displayedDatabase.username} />
            {displayedDatabase.password ? (
              <CopyField label="Password" value={displayedDatabase.password} />
            ) : null}
            <CopyField
              label="SSL mode"
              value={displayedDatabase.ssl_mode || "default"}
            />
          </div>
        ) : (
          <Form method="post" className="space-y-4">
            <input
              type="hidden"
              name="intent"
              value="create-workspace-database"
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--foreground)]">
                  Database type
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Choose the engine that best matches your application stack.
                </p>
              </div>
              <div className="space-y-3">
                <label className="flex items-start gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--foreground)]">
                  <input
                    type="radio"
                    name="engine"
                    value="mariadb"
                    defaultChecked
                    className="mt-1"
                  />
                  <div className="space-y-2">
                    <div className="font-medium">MariaDB</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Good default for WordPress and MySQL-compatible workloads.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--foreground)]">
                  <input
                    type="radio"
                    name="engine"
                    value="mysql"
                    className="mt-1"
                  />
                  <div className="space-y-2">
                    <div className="font-medium">MySQL</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Use when your app expects standard MySQL behavior.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--foreground)]">
                  <input
                    type="radio"
                    name="engine"
                    value="postgresql"
                    className="mt-1"
                  />
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
