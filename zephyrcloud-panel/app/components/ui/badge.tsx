import * as React from "react";

import { cn } from "~/lib/utils";
import { lightBadgeClass } from "~/lib/ui";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(lightBadgeClass, className)} {...props} />;
}
