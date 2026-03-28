// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

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

  route("app", "routes/app/layout.tsx", [
    index("routes/app/index.tsx"),

    // Sites list + create modal
    route("sites", "routes/app/sites.tsx"),

    // Team access overview
    route("team", "routes/app/team.tsx"),

    // Site page
    route("sites/:id", "routes/app/site.$id.tsx"),

    // Logs resource route (loader-only)
    route("sites/:id/logs", "routes/app/site.$id.logs.ts"),

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
