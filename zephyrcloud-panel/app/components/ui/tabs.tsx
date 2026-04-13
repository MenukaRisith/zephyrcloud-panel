import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "~/lib/utils";

type TabsListVariant = "default" | "line";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: TabsListVariant;
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "group/tabs-list inline-flex w-fit items-center justify-center p-[3px] text-[var(--text-muted)] group-data-[orientation=horizontal]/tabs:min-h-10 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
        variant === "default"
          ? "border border-[var(--line)] bg-[var(--surface)]"
          : "gap-1 border-b border-[var(--line)] bg-transparent p-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 border border-transparent px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-[var(--text-muted)] transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-[var(--foreground)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        "group-data-[variant=default]/tabs-list:data-[state=active]:border-[var(--line)] group-data-[variant=default]/tabs-list:data-[state=active]:bg-[var(--surface-muted)] group-data-[variant=default]/tabs-list:data-[state=active]:text-[var(--foreground)]",
        "group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:text-[var(--foreground)]",
        "after:absolute after:bg-[var(--accent)] after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
