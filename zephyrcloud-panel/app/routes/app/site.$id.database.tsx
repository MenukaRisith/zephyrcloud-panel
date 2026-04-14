import * as React from "react";
import { useFetcher, useOutletContext, useSearchParams } from "react-router";
import { Copy, Loader2, RefreshCw } from "lucide-react";

import {
  InlineAlert,
  KeyValueField,
  SiteSectionCard,
  copyToClipboard,
  type DbRowsPayload,
  type DbTablesPayload,
  type SiteDatabaseView,
  type SiteRouteContext,
} from "./site-detail.shared";

function getDatabaseView(value: string | null): SiteDatabaseView {
  return value === "browser" ? "browser" : "credentials";
}

export default function SiteDatabasePage() {
  const { site, db, actionPath, canManageTeam } = useOutletContext<SiteRouteContext>();
  const [searchParams] = useSearchParams();
  const currentView = getDatabaseView(searchParams.get("view"));
  const dbTablesFetcher = useFetcher<DbTablesPayload>();
  const dbRowsFetcher = useFetcher<DbRowsPayload>();
  const makePublicFetcher = useFetcher();
  const [tableQuery, setTableQuery] = React.useState("");
  const [selectedTable, setSelectedTable] = React.useState("");
  const [rowLimit, setRowLimit] = React.useState<"25" | "50" | "100">("25");
  const [rowOffset, setRowOffset] = React.useState(0);

  const tablesLoading =
    dbTablesFetcher.state === "loading" || dbTablesFetcher.state === "submitting";
  const rowsLoading =
    dbRowsFetcher.state === "loading" || dbRowsFetcher.state === "submitting";
  const tableList =
    dbTablesFetcher.data && dbTablesFetcher.data.ok ? dbTablesFetcher.data.tables : [];
  const filteredTables = tableList.filter((table) =>
    table.name.toLowerCase().includes(tableQuery.trim().toLowerCase()),
  );
  const rowPayload = dbRowsFetcher.data && dbRowsFetcher.data.ok ? dbRowsFetcher.data : null;
  const publicDatabaseUrl = db?.public_url || "";
  const isPublishingDatabase =
    makePublicFetcher.state === "loading" ||
    makePublicFetcher.state === "submitting";

  React.useEffect(() => {
    if (currentView !== "browser" || !db) return;
    if (dbTablesFetcher.state !== "idle") return;
    if (!dbTablesFetcher.data) {
      dbTablesFetcher.load(`/sites/${site.id}/database/tables`);
    }
  }, [currentView, db, dbTablesFetcher, site.id]);

  React.useEffect(() => {
    if (!dbTablesFetcher.data || !dbTablesFetcher.data.ok) return;
    if (selectedTable) return;
    const firstTable = dbTablesFetcher.data.tables[0]?.name;
    if (firstTable) {
      setSelectedTable(firstTable);
      setRowOffset(0);
    }
  }, [dbTablesFetcher.data, selectedTable]);

  React.useEffect(() => {
    if (currentView !== "browser" || !selectedTable) return;
    dbRowsFetcher.load(
      `/sites/${site.id}/database/tables/${encodeURIComponent(selectedTable)}?limit=${rowLimit}&offset=${rowOffset}`,
    );
  }, [currentView, rowLimit, rowOffset, selectedTable, dbRowsFetcher, site.id]);

  const connectionString = db
    ? `${db.engine}://${db.username}:${db.password || ""}@${db.host}/${db.db_name}`
    : "";

  return (
    <div className="space-y-6">
      {!db ? (
        <SiteSectionCard title="Database" subtitle="Managed database details for this site.">
          <div className="text-xs leading-5 text-[var(--text-muted)]">
            {site.type === "wordpress"
              ? "The database is still being prepared."
              : "This site type does not include a managed database by default."}
          </div>
        </SiteSectionCard>
      ) : currentView === "credentials" ? (
        <SiteSectionCard title="Database credentials" subtitle="Use these values for direct access and migrations.">
          <div className="grid gap-3 md:grid-cols-2">
            <KeyValueField label="Engine" value={db.engine.toUpperCase()} />
            <KeyValueField label="Host" value={`${db.host}:${db.port}`} mono />
            <KeyValueField label="Database" value={db.db_name} mono />
            <KeyValueField label="Username" value={db.username} mono />
            <KeyValueField
              label="Password"
              value={db.password || "No password"}
              mono
              action={
                db.password ? (
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(db.password || "")}
                    className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                ) : null
              }
            />
            <div className="md:col-span-2">
              <KeyValueField
                label="Connection string"
                value={connectionString}
                mono
                action={
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(connectionString)}
                    className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                }
              />
            </div>
            {db.public_url ? (
              <div className="md:col-span-2">
                <KeyValueField
                  label="Public URL"
                  value={publicDatabaseUrl}
                  mono
                  action={
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(publicDatabaseUrl)}
                      className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  }
                />
              </div>
            ) : null}
            {db.ssl_mode ? (
              <KeyValueField label="SSL mode" value={db.ssl_mode} mono />
            ) : null}
            {!db.public_url && canManageTeam ? (
              <div className="md:col-span-2 border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--warning)]">
                  Public access warning
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--warning)]">
                  Making this database public exposes it to the internet. Only
                  enable this when you need external connections, and rotate
                  credentials if they were shared already.
                </p>
                <makePublicFetcher.Form
                  method="post"
                  action={actionPath}
                  className="mt-3"
                  onSubmit={(event) => {
                    if (
                      !window.confirm(
                        "This will expose the database to the public internet. Continue?",
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input
                    type="hidden"
                    name="intent"
                    value="makeDatabasePublic"
                  />
                  <button
                    type="submit"
                    disabled={isPublishingDatabase}
                    className="inline-flex min-h-9 items-center gap-2 border border-[var(--warning)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--warning)] disabled:opacity-60"
                  >
                    {isPublishingDatabase ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Make DB public
                  </button>
                </makePublicFetcher.Form>
              </div>
            ) : null}
          </div>
        </SiteSectionCard>
      ) : (
        <SiteSectionCard
          title="Database browser"
          subtitle="Inspect tables and browse row data."
          aside={
            <button
              type="button"
              onClick={() => {
                dbTablesFetcher.load(`/sites/${site.id}/database/tables`);
                if (selectedTable) {
                  dbRowsFetcher.load(
                    `/sites/${site.id}/database/tables/${encodeURIComponent(selectedTable)}?limit=${rowLimit}&offset=${rowOffset}`,
                  );
                }
              }}
              className="inline-flex min-h-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--foreground)]"
            >
              <RefreshCw className={`h-4 w-4 ${(tablesLoading || rowsLoading) ? "animate-spin" : ""}`} />
              Refresh
            </button>
          }
        >
          {dbTablesFetcher.data && !dbTablesFetcher.data.ok ? (
            <InlineAlert tone="danger">{dbTablesFetcher.data.error}</InlineAlert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
            <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
                <input
                  value={tableQuery}
                  onChange={(event) => setTableQuery(event.target.value)}
                  placeholder="Search tables"
                  className="w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
                />
                <div className="mt-3 max-h-[420px] space-y-1 overflow-auto">
                  {tablesLoading && tableList.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                      Loading tables...
                    </div>
                  ) : null}
                  {!tablesLoading && filteredTables.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                      No tables found.
                    </div>
                  ) : null}
                  {filteredTables.map((table) => (
                    <button
                      key={table.name}
                      type="button"
                      onClick={() => {
                        setSelectedTable(table.name);
                        setRowOffset(0);
                      }}
                      className={`w-full border px-3 py-2 text-left text-xs ${
                        selectedTable === table.name
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                          : "border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]"
                      }`}
                    >
                      <div className="font-medium">{table.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">
                        Rows: {table.approxRows == null ? "n/a" : table.approxRows}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
              {!selectedTable ? (
                  <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                    Select a table to view rows.
                  </div>
              ) : (
                <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs font-medium text-[var(--foreground)]">
                        Table: <span className="font-mono">{selectedTable}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={rowLimit}
                          onChange={(event) => {
                            setRowLimit(event.target.value as "25" | "50" | "100");
                            setRowOffset(0);
                          }}
                          className="min-h-9 border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)]"
                        >
                          <option value="25">25 rows</option>
                          <option value="50">50 rows</option>
                          <option value="100">100 rows</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setRowOffset(Math.max(0, rowOffset - Number(rowLimit)))}
                          disabled={rowOffset === 0 || rowsLoading}
                          className="inline-flex min-h-9 items-center border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRowOffset(
                              rowPayload && rowPayload.nextOffset != null ? rowPayload.nextOffset : rowOffset,
                            )
                          }
                          disabled={!rowPayload?.hasMore || rowsLoading}
                          className="inline-flex min-h-9 items-center border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    {dbRowsFetcher.data && !dbRowsFetcher.data.ok ? (
                      <InlineAlert tone="danger">{dbRowsFetcher.data.error}</InlineAlert>
                    ) : null}

                    <div className="mt-3 overflow-auto border border-[var(--line)] bg-[var(--surface-muted)]">
                      {rowsLoading && !rowPayload ? (
                        <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                          Loading rows...
                        </div>
                      ) : rowPayload ? (
                        rowPayload.rows.length > 0 ? (
                          <table className="min-w-full text-xs">
                            <thead className="border-b border-[var(--line)] bg-[var(--surface-muted)]">
                              <tr>
                                {rowPayload.columns.map((column) => (
                                  <th
                                    key={column}
                                    className="px-3 py-2 text-left font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]"
                                  >
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rowPayload.rows.map((row, rowIndex) => (
                                <tr
                                  key={`${rowPayload.table}-${rowIndex}`}
                                  className="border-b border-[var(--line)] last:border-b-0"
                                >
                                  {rowPayload.columns.map((column) => (
                                    <td key={`${rowIndex}-${column}`} className="px-3 py-2 align-top text-[var(--text-muted)]">
                                      <span className="block max-w-[320px] break-words font-mono">
                                        {row[column] == null ? "NULL" : String(row[column])}
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                            No rows in this table.
                          </div>
                        )
                      ) : (
                        <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                          Select a table to view data.
                        </div>
                      )}
                    </div>
                </>
              )}
            </div>
          </div>
        </SiteSectionCard>
      )}
    </div>
  );
}
