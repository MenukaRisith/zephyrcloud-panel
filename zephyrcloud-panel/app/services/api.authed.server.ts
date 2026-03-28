// app/services/api.authed.server.ts
import { apiUrl } from "./api.base";
import { requireUser } from "./session.server";

export async function apiFetchAuthed(request: Request, path: string, init?: RequestInit) {
  const { token } = await requireUser(request);
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = apiUrl(p);

  const headers = new Headers(init?.headers as Record<string, string> | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, {
    ...init,
    headers,
  } as RequestInit);
}
