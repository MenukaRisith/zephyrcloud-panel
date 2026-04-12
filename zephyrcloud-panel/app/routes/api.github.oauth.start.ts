import crypto from "node:crypto";

import { redirect } from "react-router";

import { getSession, sessionStorage } from "~/services/session.server";
import { apiFetchAuthed } from "~/services/api.authed.server";

function sanitizeReturnTo(value: string | null): string {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) {
    return "/settings";
  }
  if (normalized === "/app" || normalized.startsWith("/app/")) {
    return normalized.replace(/^\/app(?=\/|$)/, "") || "/";
  }
  if (
    normalized.startsWith("/api") ||
    normalized.startsWith("/login") ||
    normalized.startsWith("/register") ||
    normalized.startsWith("/logout")
  ) {
    return "/settings";
  }
  return normalized || "/settings";
}

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request);
  const currentUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(currentUrl.searchParams.get("returnTo"));

  const configResponse = await apiFetchAuthed(request, "/api/github/oauth/config", {
    method: "GET",
  });
  const configPayload = await configResponse.json().catch(() => null);

  const clientId =
    configPayload && typeof configPayload.client_id === "string"
      ? configPayload.client_id
      : "";

  if (!configResponse.ok || !clientId) {
    return redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}github=not-configured`);
  }

  const state = crypto.randomBytes(20).toString("hex");
  const callbackUrl = `${currentUrl.origin}/settings/github/callback`;

  session.set("githubOauthState", state);
  session.set("githubOauthReturnTo", returnTo);

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("scope", "repo read:user");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("allow_signup", "true");

  return redirect(authorizeUrl.toString(), {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}
