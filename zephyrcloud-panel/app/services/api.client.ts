// app/services/api.client.ts
import { apiUrl } from "./api.base";

export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: any;
};

async function parseError(res: Response): Promise<ApiError> {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ignore
  }

  return {
    status: res.status,
    message: payload?.message || payload?.detail || `Request failed (${res.status})`,
    code: payload?.code,
    details: payload?.details,
  };
}

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType?: "bearer";
  user: {
    id: string | number;
    email: string;
    name?: string;
    role?: "admin" | "tenant_owner" | "tenant_member" | "user";
    tenant_id?: string | number;
  };
};

/**
 * Calls: POST {API_BASE_URL}/login
 */
export async function apiLogin(body: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // IMPORTANT: if your backend sets cookies, add credentials: "include"
    // credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as LoginResponse;
}

// DEV: diagnostic logging to help debug SSR import shape
if (process.env.NODE_ENV !== "production") {
  try {
    // eslint-disable-next-line no-console
    console.debug("[api.client] module loaded - exports keys:", Object.keys({ apiLogin }));
    // eslint-disable-next-line no-console
    console.debug("[api.client] apiLogin typeof:", typeof apiLogin, "value:", apiLogin);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug("[api.client] debug failed:", err);
  }
}

// Snapshot-friendly default export to avoid interop/getter issues in some SSR builds
export const apiClient = { apiLogin };
export default apiClient;
