import * as React from "react";
import {
  Form,
  Link,
  NavLink,
  Outlet,
  useLoaderData,
  useLocation,
  useMatches,
} from "react-router";
import {
  Boxes,
  Database,
  Github,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { PANEL_NAME } from "~/lib/brand";
import { getStoredTheme, persistTheme, type ThemeMode } from "~/lib/theme";
import { badgeClass, navRowClass, shellPanelClass } from "~/lib/ui";
import { cn } from "~/lib/utils";
import { requireUser } from "../../services/session.server";

type LoaderData = {
  user: {
    email: string;
    name?: string;
    role?: string;
    tenant_name?: string;
  };
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: string;
};

type SecondaryNavItem = {
  to: string;
  label: string;
  isActive: (pathname: string, search: string) => boolean;
};

type SecondaryNavGroup = {
  label: string;
  items: SecondaryNavItem[];
};

type SecondaryNavConfig = {
  title: string;
  groups: SecondaryNavGroup[];
};

export async function loader({
  request,
}: {
  request: Request;
}): Promise<LoaderData> {
  const { user } = await requireUser(request);
  return { user };
}

function initialsFromEmail(email: string) {
  const local = (email || "").split("@")[0] || "user";
  const parts = local.split(/[._-]+/g).filter(Boolean);
  const first = (parts[0]?.[0] || "U").toUpperCase();
  const second = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return `${first}${second}`.slice(0, 2);
}

function pageLabelFromPath(pathname: string) {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/workspace")) return "Usage";
  if (pathname.startsWith("/sites/")) {
    if (pathname.endsWith("/deployments")) return "Deployments";
    if (pathname.endsWith("/logs")) return "Logs";
    if (pathname.endsWith("/domains")) return "Domains";
    if (pathname.endsWith("/database")) return "Database";
    if (pathname.endsWith("/settings")) return "Site settings";
    return "Site details";
  }
  if (pathname.startsWith("/sites")) return "Sites";
  if (pathname.startsWith("/databases")) return "Databases";
  if (pathname.startsWith("/team")) return "Team";
  if (pathname.startsWith("/settings")) return "Integrations";
  if (pathname.startsWith("/admin")) return "Admin";
  return "Workspace";
}

function matchesPath(pathname: string, to: string, end = false) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

function SecondarySidebar({
  config,
}: {
  config: SecondaryNavConfig;
}) {
  const location = useLocation();

  return (
    <div className={cn(shellPanelClass, "flex h-full flex-col overflow-hidden")}>
      <div className="px-4 py-4 text-sm font-semibold text-[var(--foreground)]">{config.title}</div>
      <div className="aeon-scrollbar-dark min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-5">
          {config.groups.map((group) => (
            <div key={group.label}>
              <div className="px-4 pb-2 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                {group.label}
              </div>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.isActive(location.pathname, location.search);

                  return (
                    <Link key={item.to} to={item.to}>
                      <span
                        className={cn(
                          navRowClass,
                          "min-h-10 rounded-md border-l-0 px-4",
                          isActive
                            ? "bg-[var(--surface-shell-raised)] text-[var(--foreground)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--surface-shell-raised)] hover:text-[var(--foreground)]",
                        )}
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = React.useState<ThemeMode>("dark");

  React.useEffect(() => {
    const current =
      typeof document === "undefined"
        ? "dark"
        : getStoredTheme(document.documentElement.dataset.theme);
    setTheme(current);
  }, []);

  function handleToggle() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    persistTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex size-9 items-center justify-center border border-[var(--line)] bg-[var(--surface-shell-raised)] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NavigationItem({
  item,
  onSelect,
  collapsed = false,
}: {
  item: NavItem;
  onSelect?: () => void;
  collapsed?: boolean;
}) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onSelect}>
      {({ isActive }) => (
        <span
          className={cn(
            navRowClass,
            collapsed && "justify-center px-0",
            isActive
              ? "border-l-[var(--accent)] bg-[var(--surface-shell-raised)] text-[var(--foreground)]"
              : "text-[var(--text-muted)] hover:border-l-[var(--line-strong)] hover:bg-[var(--surface-shell-raised)] hover:text-[var(--foreground)]",
          )}
          title={collapsed ? item.label : undefined}
        >
          <span className="shrink-0 text-current">{item.icon}</span>
          <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
          {item.badge && !collapsed ? (
            <span className={cn(badgeClass, "border-[var(--line-strong)] bg-[var(--surface-shell)]")}>
              {item.badge}
            </span>
          ) : null}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({
  navItems,
  onSelect,
  collapsed = false,
  onToggleCollapsed,
}: {
  navItems: NavItem[];
  onSelect?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <div className={cn(shellPanelClass, "flex h-full flex-col overflow-hidden")}>
      <div className="aeon-scrollbar-dark min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className={cn("px-4 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]", collapsed && "sr-only")}>
          Workspace
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavigationItem key={item.to} item={item} onSelect={onSelect} collapsed={collapsed} />
          ))}
        </nav>
      </div>
      {onToggleCollapsed ? (
        <div className="border-t border-[var(--line-dark)] p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "flex min-h-10 w-full items-center gap-3 border border-[var(--line)] bg-[var(--surface-shell-raised)] px-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)]",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className={cn(collapsed && "sr-only")}>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AppLayout() {
  const { user } = useLoaderData() as LoaderData;
  const location = useLocation();
  const matches = useMatches();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [commandQuery, setCommandQuery] = React.useState("");
  const currentPageLabel = pageLabelFromPath(location.pathname);
  const secondaryNav = React.useMemo<SecondaryNavConfig | null>(() => {
    if (location.pathname === "/admin") {
      return {
        title: "Admin",
        groups: [
          {
            label: "Management",
            items: [
              {
                to: "/admin?tab=sites",
                label: "Sites",
                isActive: (pathname, search) => {
                  const tab = new URLSearchParams(search).get("tab");
                  return pathname === "/admin" && (!tab || tab === "sites");
                },
              },
              {
                to: "/admin?tab=users",
                label: "Users",
                isActive: (pathname, search) =>
                  pathname === "/admin" && new URLSearchParams(search).get("tab") === "users",
              },
              {
                to: "/admin?tab=plans",
                label: "Plans",
                isActive: (pathname, search) =>
                  pathname === "/admin" && new URLSearchParams(search).get("tab") === "plans",
              },
            ],
          },
          {
            label: "Platform",
            items: [
              {
                to: "/admin?tab=platform",
                label: "Platform",
                isActive: (pathname, search) =>
                  pathname === "/admin" && new URLSearchParams(search).get("tab") === "platform",
              },
            ],
          },
        ],
      };
    }

    if (location.pathname.startsWith("/sites/")) {
      const siteMatch = matches.find((match) => {
        const data = match.data as { site?: { id?: string; name?: string }; team?: { can_write?: boolean } } | undefined;
        return typeof data?.site?.id === "string";
      });
      const siteData = siteMatch?.data as
        | { site?: { id?: string; name?: string }; team?: { can_write?: boolean } }
        | undefined;
      const siteId = siteData?.site?.id;

      if (!siteId) return null;

      const canManageTeam = Boolean(siteData?.team?.can_write);
      const isSettingsRoute = matchesPath(location.pathname, `/sites/${siteId}/settings`, true);
      const isDatabaseRoute = matchesPath(location.pathname, `/sites/${siteId}/database`, true);
      const isDeploymentsRoute = matchesPath(location.pathname, `/sites/${siteId}/deployments`, true);
      const isLogsRoute = matchesPath(location.pathname, `/sites/${siteId}/logs`, true);
      const isDomainsRoute = matchesPath(location.pathname, `/sites/${siteId}/domains`, true);

      return {
        title: isSettingsRoute
          ? "Settings"
          : isDatabaseRoute
            ? "Database"
            : isDeploymentsRoute
              ? "Deployments"
              : isLogsRoute
                ? "Logs"
                : isDomainsRoute
                  ? "Domains"
                  : "Overview",
        groups: [
          {
            label: "Overview",
            items: [
              {
                to: `/sites/${siteId}`,
                label: "Overview",
                isActive: (pathname: string) => matchesPath(pathname, `/sites/${siteId}`, true),
              },
              {
                to: `/sites/${siteId}/deployments`,
                label: "Deployments",
                isActive: (pathname: string) => matchesPath(pathname, `/sites/${siteId}/deployments`, true),
              },
            ],
          },
          {
            label: "Configuration",
            items: [
              {
                to: `/sites/${siteId}/domains`,
                label: "Domains",
                isActive: (pathname: string) => matchesPath(pathname, `/sites/${siteId}/domains`, true),
              },
              ...(canManageTeam
                ? [
                    {
                      to: `/sites/${siteId}/database`,
                      label: "Database",
                      isActive: (pathname: string) => matchesPath(pathname, `/sites/${siteId}/database`, true),
                    },
                  ]
                : []),
              {
                to: `/sites/${siteId}/settings`,
                label: "Settings",
                isActive: (pathname: string) => matchesPath(pathname, `/sites/${siteId}/settings`, true),
              },
            ],
          },
          ...(isDatabaseRoute
            ? [
                {
                  label: "Database view",
                  items: [
                    {
                      to: `/sites/${siteId}/database?view=credentials`,
                      label: "Credentials",
                      isActive: (pathname: string, search: string) =>
                        matchesPath(pathname, `/sites/${siteId}/database`, true) &&
                        (new URLSearchParams(search).get("view") || "credentials") ===
                          "credentials",
                    },
                    {
                      to: `/sites/${siteId}/database?view=browser`,
                      label: "Browser",
                      isActive: (pathname: string, search: string) =>
                        matchesPath(pathname, `/sites/${siteId}/database`, true) &&
                        (new URLSearchParams(search).get("view") || "credentials") ===
                          "browser",
                    },
                  ],
                },
              ]
            : []),
          ...(isSettingsRoute
            ? [
                {
                  label: "Settings",
                  items: [
                    {
                      to: `/sites/${siteId}/settings?section=configuration`,
                      label: "Configuration",
                      isActive: (pathname: string, search: string) =>
                        matchesPath(pathname, `/sites/${siteId}/settings`, true) &&
                        (new URLSearchParams(search).get("section") || "configuration") ===
                          "configuration",
                    },
                    {
                      to: `/sites/${siteId}/settings?section=access`,
                      label: "Access",
                      isActive: (pathname: string, search: string) =>
                        matchesPath(pathname, `/sites/${siteId}/settings`, true) &&
                        (new URLSearchParams(search).get("section") || "configuration") ===
                          "access",
                    },
                    {
                      to: `/sites/${siteId}/settings?section=danger`,
                      label: "Danger zone",
                      isActive: (pathname: string, search: string) =>
                        matchesPath(pathname, `/sites/${siteId}/settings`, true) &&
                        (new URLSearchParams(search).get("section") || "configuration") ===
                          "danger",
                    },
                  ],
                },
              ]
            : []),
          ...(canManageTeam
            ? [
                {
                  label: "Operations",
                  items: [
                    {
                      to: `/sites/${siteId}/logs`,
                      label: "Logs",
                      isActive: (pathname: string) => matchesPath(pathname, `/sites/${siteId}/logs`, true),
                    },
                  ],
                },
              ]
            : []),
        ].filter((group) => group.items.length > 0),
      };
    }

    return null;
  }, [location.pathname, location.search, matches]);

  const navItems: NavItem[] = [
    {
      to: "/",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      end: true,
    },
    {
      to: "/workspace",
      label: "Usage",
      icon: <Layers3 className="h-4 w-4" />,
    },
    {
      to: "/sites",
      label: "Sites",
      icon: <Boxes className="h-4 w-4" />,
    },
    {
      to: "/databases",
      label: "Databases",
      icon: <Database className="h-4 w-4" />,
    },
    {
      to: "/settings",
      label: "Integrations",
      icon: <Github className="h-4 w-4" />,
    },
  ];

  if (user.role === "admin") {
    navItems.push({
      to: "/admin",
      label: "Admin",
      icon: <ShieldCheck className="h-4 w-4" />,
    });
  }

  const commandItems = [
    ...navItems.map((item) => ({
      label: item.label,
      to: item.to,
      description: item.end ? "Workspace dashboard" : `Open ${item.label}`,
    })),
    { label: "Create site", to: "/sites?new=1", description: "Start a new site setup" },
  ];
  const filteredCommandItems = commandItems.filter((item) => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return true;
    return `${item.label} ${item.description}`.toLowerCase().includes(query);
  });

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section className="min-h-screen bg-[var(--background)] pt-14">
      <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-[var(--line-dark)] bg-[var(--surface-shell)] text-[var(--foreground)]">
        <div className="flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-shell-raised)] text-[var(--foreground)] lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[92vw] max-w-[560px] p-0"
                showCloseButton={false}
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Open workspace routes and account actions.</SheetDescription>
                </SheetHeader>
                <div className="grid h-full min-h-0 md:grid-cols-[256px_minmax(0,1fr)]">
                  <Sidebar
                    navItems={navItems}
                    collapsed={false}
                    onSelect={() => setMobileOpen(false)}
                  />
                  {secondaryNav ? (
                    <div className="hidden md:block">
                      <SecondarySidebar config={secondaryNav} />
                    </div>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={PANEL_NAME}>
              <span className="flex h-7 items-center">
                <img
                  src="/logo-b.png"
                  alt=""
                  aria-hidden="true"
                  className="theme-logo-light h-7 w-auto object-contain"
                />
                <img
                  src="/logo-w.png"
                  alt=""
                  aria-hidden="true"
                  className="theme-logo-dark h-7 w-auto object-contain"
                />
              </span>
              <span className="hidden h-4 w-px bg-[var(--line-strong)] sm:inline-block" aria-hidden="true" />
              <span className="hidden min-w-0 truncate text-sm font-semibold text-[var(--foreground)] sm:inline">
                {currentPageLabel}
              </span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex h-9 min-w-9 items-center gap-2 border border-[var(--line)] bg-[var(--surface-shell-raised)] px-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)] sm:min-w-56 lg:min-w-72"
              aria-label="Open command search"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden flex-1 text-left sm:inline">Search...</span>
              <span className="hidden border border-[var(--line)] bg-[var(--surface-shell)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-soft)] sm:inline">
                ⌘ K
              </span>
            </button>
            <ThemeToggle />
            <details className="group relative">
              <summary
                className="inline-flex size-9 cursor-pointer list-none items-center justify-center border border-[var(--line)] bg-[var(--accent-soft)] text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--line-strong)] [&::-webkit-details-marker]:hidden"
                aria-label="Open profile menu"
              >
                {initialsFromEmail(user.email || "user@local")}
              </summary>
              <div className="absolute right-0 top-11 z-50 w-64 border border-[var(--line)] bg-[var(--surface-shell)] p-2">
                <div className="border-b border-[var(--line-dark)] px-3 py-3">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">
                    {user.name || user.email}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    {user.email}
                  </div>
                </div>
                <Form method="post" action="/logout" className="mt-2">
                  <button
                    type="submit"
                    className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-shell-raised)] hover:text-[var(--foreground)]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                </Form>
              </div>
            </details>
          </div>
        </div>
      </header>

      {commandOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/50 px-4 pt-20 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-xl border border-[var(--line)] bg-[var(--surface-shell)]">
            <div className="flex items-center gap-3 border-b border-[var(--line-dark)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--text-soft)]" />
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Search workspace"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-soft)]"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="inline-flex size-8 items-center justify-center border border-[var(--line)] bg-[var(--surface-shell-raised)] text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--foreground)]"
                aria-label="Close command search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {filteredCommandItems.length > 0 ? (
                filteredCommandItems.map((item) => (
                  <Link
                    key={`${item.to}:${item.label}`}
                    to={item.to}
                    onClick={() => {
                      setCommandOpen(false);
                      setCommandQuery("");
                    }}
                    className="block border border-transparent px-3 py-3 transition-colors hover:border-[var(--line)] hover:bg-[var(--surface-shell-raised)]"
                  >
                    <div className="text-sm font-medium text-[var(--foreground)]">{item.label}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{item.description}</div>
                  </Link>
                ))
              ) : (
                <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                  No results found.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-14 z-40 hidden transition-[width] duration-200 lg:block",
          sidebarCollapsed ? "w-[76px]" : "w-[208px]",
        )}
      >
        <Sidebar
          navItems={navItems}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />
      </aside>

      {secondaryNav ? (
        <aside
          className={cn(
            "fixed bottom-0 top-14 z-30 hidden w-[236px] lg:block",
            sidebarCollapsed ? "left-[76px]" : "left-[208px]",
          )}
        >
          <SecondarySidebar config={secondaryNav} />
        </aside>
      ) : null}

      <div
        className={cn(
          "min-w-0 transition-[padding] duration-200",
          secondaryNav
            ? sidebarCollapsed
              ? "lg:pl-[312px]"
              : "lg:pl-[444px]"
            : sidebarCollapsed
              ? "lg:pl-[76px]"
              : "lg:pl-[208px]",
        )}
      >
        <main id="main-content" className="min-w-0 px-4 py-4 text-[13px] sm:px-5">
          <Outlet />
        </main>
      </div>
    </section>
  );
}
