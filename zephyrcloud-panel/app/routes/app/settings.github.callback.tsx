import { redirect } from "react-router";

import { apiFetchAuthed } from "~/services/api.authed.server";
import { getSession, sessionStorage } from "~/services/session.server";

function sanitizeReturnTo(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
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

function withGithubStatus(
  requestUrl: string,
  returnTo: string,
  status: string,
  message?: string,
) {
  const url = new URL(returnTo, requestUrl);
  url.searchParams.set("github", status);
  if (message) {
    url.searchParams.set("github_message", message);
  }
  return `${url.pathname}${url.search}`;
}

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request);
  const requestUrl = new URL(request.url);

  const expectedState = session.get("githubOauthState");
  const returnTo = sanitizeReturnTo(session.get("githubOauthReturnTo"));
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  session.unset("githubOauthState");
  session.unset("githubOauthReturnTo");

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirect(withGithubStatus(request.url, returnTo, "invalid-state"), {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session),
      },
    });
  }

  const redirectUri = `${requestUrl.origin}/settings/github/callback`;
  const exchangeResponse = await apiFetchAuthed(request, "/api/github/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!exchangeResponse.ok) {
    const payload = await exchangeResponse.json().catch(() => null);
    const message =
      payload && typeof payload.message === "string"
        ? payload.message
        : "GitHub connection failed.";

    return redirect(
      withGithubStatus(request.url, returnTo, "error", message),
      {
        headers: {
          "Set-Cookie": await sessionStorage.commitSession(session),
        },
      },
    );
  }

  return redirect(withGithubStatus(request.url, returnTo, "connected"), {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export default function GithubCallbackRoute() {
  return null;
}
