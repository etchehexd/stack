"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import { removeFromLibrary, upsertLibraryEntry } from "@/app/actions/library";
import type { LibraryStatus, MediaType } from "@/lib/types/database";
import { LIBRARY_STATUSES, cn, statusLabel } from "@/lib/utils";

const STATUS_COLOR: Record<LibraryStatus, string> = {
  watching: "var(--color-anime)",
  completed: "var(--success)",
  planning: "var(--color-craft)",
  on_hold: "var(--color-enjoyment)",
  dropped: "var(--danger)",
  repeating: "var(--color-manga)",
};

export function StatusPicker({
  titleId,
  mediaType,
  status,
  size = "md",
  className,
}: {
  titleId: string;
  mediaType: MediaType;
  status: LibraryStatus | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState(status);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const [lastStatus, setLastStatus] = React.useState(status);
  if (lastStatus !== status) {
    setLastStatus(status);
    setCurrent(status);
  }

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function pick(next: LibraryStatus) {
    setOpen(false);
    setBusy(true);
    const previous = current;
    setCurrent(next);
    const result = await upsertLibraryEntry({ titleId, status: next });
    setBusy(false);
    if (!result.ok) setCurrent(previous);
    else router.refresh();
  }

  async function remove() {
    setOpen(false);
    setBusy(true);
    await removeFromLibrary(titleId);
    setCurrent(null);
    setBusy(false);
    router.refresh();
  }

  const color = current ? STATUS_COLOR[current] : undefined;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "glass-subtle specular glass-press inline-flex items-center gap-1.5 rounded-pill font-medium",
          size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm",
        )}
        style={
          color
            ? {
                borderColor: `color-mix(in oklch, ${color} 50%, transparent)`,
                background: `color-mix(in oklch, ${color} 16%, transparent)`,
              }
            : undefined
        }
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : current ? (
          <span className="size-1.5 rounded-full" style={{ background: color }} />
        ) : (
          <Plus className="size-3.5" strokeWidth={2.5} />
        )}
        {current ? statusLabel(current, mediaType) : "Add to library"}
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="glass-heavy specular absolute top-11 left-0 z-30 w-52 origin-top-left overflow-hidden rounded-lg p-1.5"
          >
            {LIBRARY_STATUSES.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current === option}
                  onClick={() => pick(option)}
                  className="text-fg-2 hover:text-fg flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-[var(--glass-2)]"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[option] }}
                  />
                  <span className="flex-1 text-left">
                    {statusLabel(option, mediaType)}
                  </span>
                  {current === option && <Check className="size-3.5" />}
                </button>
              </li>
            ))}

            {current && (
              <li className="border-hairline mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={remove}
                  className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-[var(--danger)] transition-colors hover:bg-[color-mix(in_oklch,var(--danger)_14%,transparent)]"
                >
                  <Trash2 className="size-3.5" />
                  Remove from library
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
