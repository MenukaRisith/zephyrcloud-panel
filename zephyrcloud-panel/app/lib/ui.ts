export const softCardClass =
  "border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)]";

export const softAccentCardClass =
  "border border-[var(--accent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_88%,var(--accent-soft)),var(--surface))] text-[var(--foreground)]";

export const softInsetClass =
  "border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--foreground)]";

export const panelClass = softCardClass;

export const darkPanelClass =
  "border border-[var(--line-dark)] bg-[var(--surface-shell)] text-[var(--foreground)]";

export const shellPanelClass =
  "border-r border-[var(--line-dark)] bg-[var(--surface-shell)] text-[var(--foreground)]";

export const shellInsetClass =
  "border border-[var(--line)] bg-[var(--surface-shell-raised)] text-[var(--foreground)]";

export const navRowClass =
  "flex min-h-10 items-center gap-2.5 border-l-2 border-transparent px-3 py-1.5 text-xs font-medium transition-colors";

export const sectionHeaderClass =
  "flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]";

export const statusBadgeClass =
  "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]";

export const elevatedSurfaceClass =
  "border border-[var(--line)] bg-[var(--surface-elevated)]";

export const dangerSurfaceClass =
  "border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]";

export const toolbarRowClass =
  "flex min-h-10 items-center gap-2.5 border border-[var(--line)] bg-[var(--surface-muted)] px-3";

export const primaryCtaClass =
  "inline-flex min-h-8 items-center justify-center gap-1.5 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-light text-[var(--accent-foreground)] transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export const secondaryCtaClass =
  "inline-flex min-h-8 items-center justify-center gap-1.5 border border-[var(--line)] bg-transparent px-3 py-1.5 text-center text-xs font-light text-[var(--foreground)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export const darkPrimaryCtaClass =
  "inline-flex min-h-8 items-center justify-center gap-1.5 border-2 border-[var(--accent-border)] bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-light text-[var(--accent-foreground)] transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-shell)]";

export const darkSecondaryCtaClass =
  "inline-flex min-h-8 items-center justify-center gap-1.5 border border-[var(--line)] bg-transparent px-3 py-1.5 text-center text-xs font-light text-[var(--foreground)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-shell-raised)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-shell)]";

export const inputClass =
  "w-full min-w-0 border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export const inputOnDarkClass =
  "w-full min-w-0 border border-[var(--line)] bg-[var(--surface-shell-raised)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export const selectOnDarkClass =
  "w-full min-w-0 border border-[var(--line)] bg-[var(--surface-shell-raised)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] [&>option]:bg-[var(--surface-shell)] [&>option]:text-[var(--foreground)]";

export const badgeClass =
  "inline-flex items-center gap-1 border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)]";

export const lightBadgeClass =
  "inline-flex items-center gap-1 border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]";

export const eyebrowClass =
  "text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]";

export const mutedTextClass = "text-[var(--text-muted)]";

export const adminStickyHeaderClass =
  "sticky top-0 z-20 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--background)_88%,transparent)] pb-3 pt-4 backdrop-blur";

export const adminContentWrapClass =
  "min-h-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]";
