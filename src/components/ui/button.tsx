"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    ButtonVariantProps {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

// Server Components must import buttonVariants from "./button-variants"
// directly — re-exporting it from this "use client" module would put it back
// behind the client boundary.
