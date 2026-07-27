import { AXIS_META, prettyStars } from "@/lib/rating";
import { cn } from "@/lib/utils";

/**
 * Both axes, side by side. This component exists so that the two scores are
 * NEVER blended into one number anywhere in the UI — if you find yourself
 * wanting a single figure for display, the answer is "show this instead".
 */
export function RatingBadge({
  enjoyment,
  craft,
  size = "md",
  showLabels = false,
  className,
}: {
  enjoyment: number | null;
  craft: number | null;
  size?: "xs" | "sm" | "md";
  showLabels?: boolean;
  className?: string;
}) {
  if (enjoyment == null && craft == null) return null;

  const text =
    size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : "text-sm";
  const dot = size === "xs" ? "size-1" : "size-1.5";

  return (
    <div
      className={cn("flex items-center gap-2 font-medium tabular-nums", text, className)}
      title={`Enjoyment ${enjoyment ?? "–"} · Craft ${craft ?? "–"}`}
    >
      <Axis
        value={enjoyment}
        color={AXIS_META.enjoyment.color}
        label={showLabels ? "Enjoy" : null}
        dot={dot}
      />
      <span className="text-fg-3 opacity-40" aria-hidden>
        |
      </span>
      <Axis
        value={craft}
        color={AXIS_META.craft.color}
        label={showLabels ? "Craft" : null}
        dot={dot}
      />
    </div>
  );
}

function Axis({
  value,
  color,
  label,
  dot,
}: {
  value: number | null;
  color: string;
  label: string | null;
  dot: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("rounded-full", dot)} style={{ background: color }} />
      {label && <span className="text-fg-3">{label}</span>}
      <span style={{ color: value == null ? "var(--text-tertiary)" : color }}>
        {prettyStars(value)}
      </span>
    </span>
  );
}
