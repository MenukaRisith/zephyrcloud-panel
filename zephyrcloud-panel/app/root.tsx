import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { PANEL_DESCRIPTION, PANEL_NAME } from "./lib/brand";
import { themeInitScript } from "./lib/theme";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700;800&display=swap",
  },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/logo-b.png" },
];

export const meta: Route.MetaFunction = () => [
  { title: PANEL_NAME },
  { name: "description", content: PANEL_DESCRIPTION },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-[var(--foreground)]">
      <h1 className="text-3xl font-semibold">{message}</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{details}</p>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto border border-[var(--line)] bg-[var(--surface)] p-4 text-xs text-[var(--text-muted)]">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
