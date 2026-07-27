"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap " +
    "select-none disabled:pointer-events-none disabled:opacity-45 " +
    "transition-[transform,background,box-shadow,border-color] duration-200 " +
    "[transition-timing-function:var(--ease-glass)] active:scale-[0.97]",
  {
    variants: {
      variant: {
        /** Frosted, for most actions sitting on top of artwork. */
        glass:
          "glass-subtle specular text-fg hover:bg-[var(--glass-hover)] " +
          "border border-hairline",
        /** The one loud button per screen. */
        primary:
          "text-white border border-transparent " +
          "bg-[color-mix(in_oklch,var(--accent)_88%,transparent)] " +
          "hover:bg-[var(--accent)] shadow-[0_6px_20px_-6px_var(--accent)]",
        ghost: "text-fg-2 hover:text-fg hover:bg-[var(--glass-1)]",
        danger:
          "text-white border border-transparent " +
          "bg-[color-mix(in_oklch,var(--danger)_85%,transparent)] hover:bg-[var(--danger)]",
      },
      size: {
        sm: "h-8 rounded-pill px-3 text-xs",
        md: "h-10 rounded-pill px-4 text-sm",
        lg: "h-12 rounded-pill px-6 text-base",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(button({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { button as buttonVariants };
