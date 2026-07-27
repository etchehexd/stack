"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** "bottom" on mobile feels native; "center" suits desktop dialogs. */
  side?: "bottom" | "center";
  className?: string;
}

/**
 * Physics-based glass sheet. Bottom sheets are drag-to-dismiss; both variants
 * spring in rather than fading, which is what makes the glass feel like a
 * physical layer rather than an overlay.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "bottom",
  className,
}: SheetProps) {
  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => onOpenChange(false)}
            className="glass-scrim absolute inset-0"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={
              side === "bottom" ? { y: "100%" } : { opacity: 0, scale: 0.94, y: 12 }
            }
            animate={side === "bottom" ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={
              side === "bottom" ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
            drag={side === "bottom" ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onOpenChange(false);
            }}
            className={cn(
              "glass-heavy specular relative z-1 w-full max-h-[90dvh] overflow-y-auto scroll-glass",
              side === "bottom"
                ? "rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl sm:pb-6"
                : "max-w-lg rounded-2xl",
              className,
            )}
          >
            {side === "bottom" && (
              <div className="sticky top-0 flex justify-center pt-3 pb-1">
                <div className="h-1 w-9 rounded-pill bg-[var(--glass-border-strong)]" />
              </div>
            )}

            {(title || description) && (
              <header className="flex items-start justify-between gap-4 px-6 pt-4 pb-2">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                  )}
                  {description && (
                    <p className="text-fg-3 mt-0.5 text-sm">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                  className="glass-subtle glass-press -mr-1 grid size-8 shrink-0 place-items-center rounded-full"
                >
                  <X className="size-4" />
                </button>
              </header>
            )}

            <div className="px-6 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
