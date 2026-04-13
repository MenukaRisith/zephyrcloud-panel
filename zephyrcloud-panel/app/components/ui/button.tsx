import * as React from "react";

import { cn } from "~/lib/utils";
import {
  darkPrimaryCtaClass,
  darkSecondaryCtaClass,
  primaryCtaClass,
  secondaryCtaClass,
} from "~/lib/ui";

type ButtonVariant =
  | "default"
  | "secondary"
  | "dark"
  | "dark-secondary"
  | "danger";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const sizeClasses: Record<ButtonSize, string> = {
  default: "",
  sm: "min-h-7 px-2.5 py-1 text-[10px]",
  lg: "min-h-9 px-3 py-1.5 text-xs",
  icon: "size-8 px-0 py-0",
};

const variantClasses: Record<ButtonVariant, string> = {
  default: primaryCtaClass,
  secondary: secondaryCtaClass,
  dark: darkPrimaryCtaClass,
  "dark-secondary": darkSecondaryCtaClass,
  danger:
    "inline-flex min-h-8 items-center justify-center gap-1.5 border border-[var(--danger)] bg-[var(--danger)] px-3 py-1.5 text-center text-xs font-light text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
