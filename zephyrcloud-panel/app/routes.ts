// app/routes.ts
import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),

  /**
   * ✅ Server-side proxy routes (so browser never calls Nest directly)
   * These match what your sites.tsx now calls:
   * - GET /api/github/apps
   * - GET /api/github/repos/:appUuid
   * - GET /api/github/branches/:appUuid/:owner/:repo
   */
  route("api/github/apps", "routes/api.github.apps.ts"),
  route("api/github/repos/:appUuid", "routes/api.github.repos.$appUuid.ts"),
  route(
    "api/github/branches/:appUuid/:owner/:repo",
    "routes/api.github.branches.$appUuid.$owner.$repo.ts",
  ),
  route("api/github/connection", "routes/api.github.connection.ts"),
  route("api/github/connected/repos", "routes/api.github.connected.repos.ts"),
  route(
    "api/github/connected/branches/:owner/:repo",
    "routes/api.github.connected.branches.$owner.$repo.ts",
  ),
  route("api/github/oauth/start", "routes/api.github.oauth.start.ts"),
  route("api/deploy-keys", "routes/api.deploy-keys.ts"),

  route("app/*", "routes/app-legacy-redirect.tsx"),

  layout("routes/app/layout.tsx", [
    index("routes/app/index.tsx"),

    // Sites list + create modal
    route("sites", "routes/app/sites.tsx"),

    // Team access overview
    route("team", "routes/app/team.tsx"),
    route("databases", "routes/app/databases.tsx"),

    // Personal integrations
    route("settings", "routes/app/settings.tsx"),
    route("settings/github/callback", "routes/app/settings.github.callback.tsx"),
    route("admin", "routes/app/admin.tsx"),

    // Site page
    route("sites/:id", "routes/app/site.$id.tsx", [
      index("routes/app/site.$id._index.tsx"),
      route("deployments", "routes/app/site.$id.deployments.tsx"),
      route("logs", "routes/app/site.$id.logs-view.tsx"),
      route("domains", "routes/app/site.$id.domains.tsx"),
      route("database", "routes/app/site.$id.database.tsx"),
      route("settings", "routes/app/site.$id.settings.tsx"),
    ]),

    // Logs resource route (loader-only)
    route("sites/:id/log-events", "routes/app/site.$id.logs.ts"),

    // Live status resource route (loader-only)
    route("sites/:id/status", "routes/app/sites.$id.status.ts"),

    // Database explorer resource routes (loader-only)
    route(
      "sites/:id/database/tables",
      "routes/app/sites.$id.database.tables.ts",
    ),
    route(
      "sites/:id/database/tables/:table",
      "routes/app/sites.$id.database.table.$table.ts",
    ),
  ]),
] satisfies RouteConfig;
