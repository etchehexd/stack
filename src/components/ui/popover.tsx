"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * A dropdown that renders into <body>.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A PORTAL, AND WHY EVERY MENU MUST USE IT
 *
 * Menus in this app used to be absolutely positioned siblings of their
 * trigger, with a z-index. They kept ending up behind other panels and
 * becoming unclickable, and no z-index fixed it — because z-index only orders
 * elements INSIDE the same stacking context.
 *
 * Two things in this codebase create a stacking context around almost every
 * menu: `@utility specular` sets `isolation: isolate`, and any panel with a
 * transform or a filter does the same. Once a menu is trapped inside its
 * panel's context, `z-50` means "top of this panel", not "top of the page" —
 * so the next panel in DOM order paints straight over it. Panels with
 * `overflow-hidden` clipped them outright.
 *
 * Rendering into <body> sidesteps all of it: there is exactly one stacking
 * context, and the z-index scale in globals.css decides the order.
 *
 * Never re-add an absolutely positioned menu. Use this.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The trigger. Position is measured from this element. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Which edge of the anchor the menu hangs from. */
  align?: "start" | "end" | "center";
  /** Gap between anchor and menu, in px. */
  offset?: number;
  /** Fixed width in px, or "anchor" to match the trigger. */
  width?: number | "anchor";
  className?: string;
  children: React.ReactNode;
}

interface Position {
  top: number;
  left: number;
  width?: number;
  /** True when the menu had to flip above the anchor to fit. */
  above: boolean;
}

const MARGIN = 8;

const EMPTY_SUBSCRIBE = () => () => {};

/**
 * True once React has hydrated on the client.
 *
 * useSyncExternalStore's server snapshot is the one used during SSR and the
 * first client render, so this flips exactly at hydration without a setState
 * in an effect — which would cause a cascading re-render of every menu.
 */
function useHydrated() {
  return React.useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
}

export function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  offset = 8,
  width,
  className,
  children,
}: PopoverProps) {
  const hydrated = useHydrated();
  const [pos, setPos] = React.useState<Position | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const place = React.useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const panelWidth =
      width === "anchor"
        ? rect.width
        : (width ?? panelRef.current?.offsetWidth ?? 220);

    // Flip above the anchor when there isn't room below it.
    const spaceBelow = window.innerHeight - rect.bottom - offset - MARGIN;
    const above = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight;

    let left =
      align === "end"
        ? rect.right - panelWidth
        : align === "center"
          ? rect.left + rect.width / 2 - panelWidth / 2
          : rect.left;

    // Keep it on screen horizontally whatever the alignment asked for.
    left = Math.min(
      Math.max(MARGIN, left),
      Math.max(MARGIN, window.innerWidth - panelWidth - MARGIN),
    );

    setPos({
      top: above ? rect.top - offset - panelHeight : rect.bottom + offset,
      left,
      width: width === "anchor" ? rect.width : undefined,
      above,
    });
  }, [anchorRef, align, offset, width]);

  // Measure once the panel exists so we know its height, then keep it pinned.
  React.useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;

    // `true` on scroll catches scrolling containers, not just the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  // No document to portal into until the client has taken over.
  if (!hydrated) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -2 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: "fixed",
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            width: pos?.width,
            zIndex: "var(--z-popover)" as unknown as number,
            transformOrigin: pos?.above ? "bottom center" : "top center",
            // Hide the first paint, before we've measured.
            visibility: pos ? "visible" : "hidden",
          }}
          className={cn(
            "glass-heavy max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl p-1.5",
            "scroll-glass shadow-[var(--shadow-lift)]",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** A row inside a Popover. Keeps every menu in the app the same shape. */
export function PopoverItem({
  onClick,
  selected,
  danger,
  icon,
  children,
  className,
  ...props
}: {
  onClick?: () => void;
  selected?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
        "transition-colors duration-150",
        danger
          ? "text-[var(--danger)] hover:bg-[color-mix(in_oklch,var(--danger)_14%,transparent)]"
          : "text-fg-2 hover:text-fg hover:bg-[var(--glass-hover)]",
        selected && !danger && "text-fg bg-[var(--glass-2)]",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
