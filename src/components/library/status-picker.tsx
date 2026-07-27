"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import { removeFromLibrary, upsertLibraryEntry } from "@/app/actions/library";
import { Popover, PopoverItem } from "@/components/ui/popover";
import type { LibraryStatus, MediaType } from "@/lib/types/database";
import { LIBRARY_STATUSES, cn, statusLabel } from "@/lib/utils";

const STATUS_COLOR: Record<LibraryStatus, string> = {
  watching: "var(--color-anime)",
  completed: "var(--success)",
  planning: "oklch(0.74 0.14 220)",
  on_hold: "oklch(0.82 0.15 85)",
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
  const trigger = React.useRef<HTMLButtonElement>(null);

  const [lastStatus, setLastStatus] = React.useState(status);
  if (lastStatus !== status) {
    setLastStatus(status);
    setCurrent(status);
  }

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
    <div className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border font-semibold tracking-tight",
          "transition-[transform,border-color,background] duration-200 active:scale-[0.97]",
          size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-3.5 text-sm",
        )}
        style={
          color
            ? {
                borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
                background: `color-mix(in oklch, ${color} 14%, transparent)`,
              }
            : {
                borderColor: "var(--glass-border-strong)",
                background: "var(--glass-1)",
              }
        }
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : current ? (
          <span
            className="size-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
        ) : (
          <Plus className="size-4" strokeWidth={2.6} />
        )}
        {current ? statusLabel(current, mediaType) : "Add to library"}
        <ChevronDown
          className={cn(
            "size-3.5 opacity-60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={trigger}
        align="start"
        width={220}
      >
        {LIBRARY_STATUSES.map((option) => (
          <PopoverItem
            key={option}
            role="option"
            aria-selected={current === option}
            selected={current === option}
            onClick={() => pick(option)}
            icon={
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[option] }}
              />
            }
          >
            <span className="flex items-center justify-between gap-2">
              {statusLabel(option, mediaType)}
              {current === option && <Check className="size-3.5 shrink-0" />}
            </span>
          </PopoverItem>
        ))}

        {current && (
          <div className="border-hairline mt-1 border-t pt-1">
            <PopoverItem
              danger
              onClick={remove}
              icon={<Trash2 className="size-3.5" />}
            >
              Remove from library
            </PopoverItem>
          </div>
        )}
      </Popover>
    </div>
  );
}
