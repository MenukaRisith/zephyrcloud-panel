import * as React from "react";

import { cn } from "~/lib/utils";
import {
  darkPrimaryCtaClass,
  darkSecondaryCtaClass,
  primaryCtaClass,
  secondaryCtaClass,
} from "~/lib/ui";

type ButtonVariant = "default" | "secondary" | "dark" | "dark-secondary";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const sizeClasses: Record<ButtonSize, string> = {
  default: "",
  sm: "min-h-9 px-3 py-2 text-sm",
  lg: "min-h-11 px-6 py-3 text-sm",
  icon: "size-10 px-0 py-0",
};

const variantClasses: Record<ButtonVariant, string> = {
  default: primaryCtaClass,
  secondary: secondaryCtaClass,
  dark: darkPrimaryCtaClass,
  "dark-secondary": darkSecondaryCtaClass,
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
        "shrink-0 whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
