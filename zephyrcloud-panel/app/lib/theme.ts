export const THEME_STORAGE_KEY = "aeon-theme";

export type ThemeMode = "dark" | "light";

export const defaultTheme: ThemeMode = "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function getStoredTheme(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : defaultTheme;
}

export function setDocumentTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  setDocumentTheme(theme);
}

export const themeInitScript = `
(() => {
  const key = ${JSON.stringify(THEME_STORAGE_KEY)};
  const fallback = ${JSON.stringify(defaultTheme)};
  try {
    const stored = window.localStorage.getItem(key);
    const theme = stored === "light" || stored === "dark" ? stored : fallback;
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = fallback;
  }
})();
`;
