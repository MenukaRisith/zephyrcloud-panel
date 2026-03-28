// app/services/api.base.ts
/**
 * Single place for the API base URL.
 * - In development, set VITE_API_BASE_URL or process.env.API_BASE_URL depending on your tooling.
 * - In production, set this via env vars.
 */
export const API_BASE_URL =
  (typeof window !== "undefined"
    ? (window as any).__API_BASE_URL__ // optional: inject at runtime if you want
    : process.env.API_BASE_URL) ||
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_BACKEND_ORIGIN ||
  "http://localhost:8000";

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}
