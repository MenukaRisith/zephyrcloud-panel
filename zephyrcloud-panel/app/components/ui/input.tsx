import * as React from "react";

import { cn } from "~/lib/utils";
import { inputClass } from "~/lib/ui";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}
