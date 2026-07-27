import * as React from "react";
import { cn } from "@/lib/utils";

type Level = "subtle" | "default" | "heavy";

const LEVELS: Record<Level, string> = {
  subtle: "glass-subtle",
  default: "glass",
  heavy: "glass-heavy",
};

export interface GlassPanelProps extends React.ComponentPropsWithoutRef<"div"> {
  level?: Level;
  /** Adds the 1px specular rim. On by default — that's the whole aesthetic. */
  specular?: boolean;
  radius?: "sm" | "md" | "lg" | "xl" | "2xl";
  as?: "div" | "section" | "article" | "aside" | "header" | "nav";
}

const RADII = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
} as const;

/**
 * The one and only glass surface. Everything frosted in this app should be a
 * GlassPanel (or use the `glass*` utilities directly) so the blur/border/shadow
 * stay consistent — see globals.css for the tokens.
 */
export function GlassPanel({
  level = "default",
  specular = true,
  radius = "lg",
  as: Tag = "div",
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <Tag
      className={cn(LEVELS[level], RADII[radius], specular && "specular", className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
