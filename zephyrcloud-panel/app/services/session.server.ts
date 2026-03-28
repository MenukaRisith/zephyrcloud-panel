// app/services/session.server.ts
import { createCookieSessionStorage, redirect } from "react-router";

type SessionUser = {
  id: string | number;
  email: string;
  name?: string;
  role?: string;
  tenant_id?: string | number;
};

const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-me";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__host_panel_session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    // 7 days:
    maxAge: 60 * 60 * 24 * 7,
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function createUserSession(opts: {
  request: Request;
  accessToken: string;
  user: SessionUser;
  redirectTo: string;
}) {
  const session = await getSession(opts.request);
  session.set("accessToken", opts.accessToken);
  session.set("user", opts.user);

  const cookie = await sessionStorage.commitSession(session);
  // DEV: log redirect and cookie presence (not contents in production)
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[session] creating user session, redirectTo:", opts.redirectTo, "cookiePresent:", Boolean(cookie));
  }

  return redirect(opts.redirectTo, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

export async function requireUser(request: Request) {
  const session = await getSession(request);
  const user = session.get("user") as SessionUser | undefined;
  const token = session.get("accessToken") as string | undefined;

  if (!user || !token) throw redirect("/login");
  return { user, token };
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
