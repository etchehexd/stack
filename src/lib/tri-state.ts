/**
 * Tri-state filter values and their URL encoding.
 *
 * This lives in `lib/` rather than beside the chip component on purpose: the
 * Discover page is a server component and has to parse these out of the query
 * string before it can run the search. `tri-state-chip.tsx` is `"use client"`,
 * and importing a plain function out of a client module from the server throws
 * at request time ("Attempted to call parseTriSet() from the server"). Pure
 * logic goes here; the chip imports it and re-exports it for client callers.
 */

export type TriState = "neutral" | "include" | "exclude";

export const TRI_CYCLE: Record<TriState, TriState> = {
  neutral: "include",
  include: "exclude",
  exclude: "neutral",
};

export function nextTriState(current: TriState): TriState {
  return TRI_CYCLE[current];
}

export interface TriStateSet {
  include: string[];
  exclude: string[];
}

export const EMPTY_TRI_SET: TriStateSet = { include: [], exclude: [] };

export function triStateOf(set: TriStateSet, value: string): TriState {
  if (set.include.includes(value)) return "include";
  if (set.exclude.includes(value)) return "exclude";
  return "neutral";
}

/** Immutably move `value` into its new bucket. */
export function applyTriState(
  set: TriStateSet,
  value: string,
  next: TriState,
): TriStateSet {
  const include = set.include.filter((v) => v !== value);
  const exclude = set.exclude.filter((v) => v !== value);
  if (next === "include") include.push(value);
  if (next === "exclude") exclude.push(value);
  return { include, exclude };
}

export function triSetSize(set: TriStateSet) {
  return set.include.length + set.exclude.length;
}

/** Serialize for the URL: "Action,Comedy!Ecchi" (! prefixes exclusions). */
export function serializeTriSet(set: TriStateSet): string | null {
  const parts = [
    ...set.include.map(encodeURIComponent),
    ...set.exclude.map((v) => `!${encodeURIComponent(v)}`),
  ];
  return parts.length ? parts.join(",") : null;
}

export function parseTriSet(raw: string | null | undefined): TriStateSet {
  if (!raw) return EMPTY_TRI_SET;
  const set: TriStateSet = { include: [], exclude: [] };
  for (const part of raw.split(",")) {
    if (!part) continue;
    if (part.startsWith("!")) set.exclude.push(decodeURIComponent(part.slice(1)));
    else set.include.push(decodeURIComponent(part));
  }
  return set;
}
