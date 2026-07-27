"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Database, LibraryStatus } from "@/lib/types/database";
import type { ActionResult } from "./rating";

const STATUSES = [
  "watching",
  "completed",
  "planning",
  "on_hold",
  "dropped",
  "repeating",
] as const;

const upsertInput = z.object({
  titleId: z.uuid(),
  status: z.enum(STATUSES).optional(),
  progress: z.number().int().min(0).max(100_000).optional(),
  /**
   * Volume progress is ALWAYS user-entered and optional — AniList volume data
   * is too patchy to trust. Null clears it.
   */
  progressVolumes: z.number().int().min(0).max(1000).nullable().optional(),
  repeatCount: z.number().int().min(0).max(999).optional(),
  notes: z.string().max(2000).nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export type LibraryUpsertInput = z.infer<typeof upsertInput>;

/**
 * Create or update the current user's library entry. Every field is optional,
 * so the "tap +1" flow can send just `{ titleId, progress }`.
 */
export async function upsertLibraryEntry(
  input: LibraryUpsertInput,
): Promise<ActionResult> {
  const parsed = upsertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { titleId, ...rest } = parsed.data;

  const { data: existing } = await supabase
    .from("library_entries")
    .select("status, progress, started_at, completed_at")
    .eq("user_id", user.id)
    .eq("title_id", titleId)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const nextStatus: LibraryStatus =
    rest.status ?? existing?.status ?? "watching";

  const row: Database["public"]["Tables"]["library_entries"]["Insert"] = {
    user_id: user.id,
    title_id: titleId,
    status: nextStatus,
  };

  if (rest.progress !== undefined) row.progress = rest.progress;
  if (rest.progressVolumes !== undefined) row.progress_volumes = rest.progressVolumes;
  if (rest.repeatCount !== undefined) row.repeat_count = rest.repeatCount;
  if (rest.notes !== undefined) row.notes = rest.notes;
  if (rest.isPrivate !== undefined) row.is_private = rest.isPrivate;

  // Stamp start/finish dates automatically, but never overwrite one the user
  // already has — re-watching shouldn't erase the original completion date.
  if (!existing?.started_at && nextStatus !== "planning") row.started_at = today;
  if (nextStatus === "completed" && !existing?.completed_at) row.completed_at = today;

  const { error } = await supabase
    .from("library_entries")
    .upsert(row, { onConflict: "user_id,title_id" });

  if (error) return { ok: false, error: error.message };

  // Best-effort activity entries.
  if (rest.status && rest.status !== existing?.status) {
    await supabase.from("activity").insert({
      user_id: user.id,
      title_id: titleId,
      kind:
        rest.status === "completed"
          ? "completed"
          : existing
            ? "status_changed"
            : "started",
      payload: { status: rest.status, from: existing?.status ?? null },
    });
  } else if (rest.progress !== undefined && rest.progress !== existing?.progress) {
    await supabase.from("activity").insert({
      user_id: user.id,
      title_id: titleId,
      kind: "progress",
      payload: { progress: rest.progress },
    });
  }

  revalidatePath("/library");
  revalidatePath(`/title/${titleId}`);
  return { ok: true };
}

/** The "tap +1" path: bump progress, auto-completing on the final unit. */
export async function incrementProgress(
  titleId: string,
  delta = 1,
): Promise<ActionResult & { progress?: number; status?: LibraryStatus }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const [{ data: entry }, { data: title }] = await Promise.all([
    supabase
      .from("library_entries")
      .select("progress, status, completed_at")
      .eq("user_id", user.id)
      .eq("title_id", titleId)
      .maybeSingle(),
    supabase
      .from("titles")
      .select("media_type, episodes, chapters")
      .eq("id", titleId)
      .single(),
  ]);

  if (!title) return { ok: false, error: "Title not found." };

  const total = title.media_type === "anime" ? title.episodes : title.chapters;
  const next = Math.max(0, (entry?.progress ?? 0) + delta);
  const capped = total ? Math.min(next, total) : next;

  // Hitting the last episode/chapter completes it. Going below the total again
  // (a correction) drops it back to watching.
  let status: LibraryStatus = entry?.status ?? "watching";
  if (total && capped >= total) status = status === "repeating" ? "repeating" : "completed";
  else if (status === "completed") status = "watching";

  const today = new Date().toISOString().slice(0, 10);
  const row: Database["public"]["Tables"]["library_entries"]["Insert"] = {
    user_id: user.id,
    title_id: titleId,
    progress: capped,
    status,
  };
  if (status === "completed" && !entry?.completed_at) row.completed_at = today;

  const { error } = await supabase
    .from("library_entries")
    .upsert(row, { onConflict: "user_id,title_id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/library");
  return { ok: true, progress: capped, status };
}

export async function removeFromLibrary(titleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase
    .from("library_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("title_id", titleId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/library");
  revalidatePath(`/title/${titleId}`);
  return { ok: true };
}
