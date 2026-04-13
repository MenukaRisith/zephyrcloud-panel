import * as React from "react";

import { cn } from "~/lib/utils";
import { badgeClass } from "~/lib/ui";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(badgeClass, className)} {...props} />;
}
