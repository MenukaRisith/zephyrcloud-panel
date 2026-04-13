import * as React from "react";

import { cn } from "~/lib/utils";

function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-semibold leading-none", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-xs leading-5 text-[var(--text-muted)]", className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription };
