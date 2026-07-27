"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { BUCKET_ORDER, SCORE_MAX, SCORE_MIN } from "@/lib/rating";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface RatingResult extends ActionResult {
  score?: number;
}

const titleId = z.uuid();

/* -------------------------------------------------------------------------- */

/**
 * Everything the rating dialog needs to run a placement, in one round trip:
 * how many titles the user has rated (which decides seed vs. compare mode) and
 * the contents of the chosen bucket in ascending order.
 *
 * The binary search itself runs on the client — it's pure arithmetic over this
 * list, and doing it there means one request at the start and one at the end
 * instead of a round trip per question.
 */
export interface BucketItem {
  titleId: string;
  name: string;
  cover: string | null;
  color: string | null;
  score: number;
}

export interface BucketList {
  ratedCount: number;
  items: BucketItem[];
}

export async function getBucketList(
  bucket: string,
): Promise<{ ok: true; data: BucketList } | { ok: false; error: string }> {
  if (!(BUCKET_ORDER as string[]).includes(bucket)) {
    return { ok: false, error: "Unknown bucket." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in to rate." };

  const [countRes, listRes] = await Promise.all([
    supabase
      .from("ratings")
      .select("title_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("ratings")
      .select(
        "title_id, score, titles!inner(title_english, title_romaji, cover_image_large, cover_color)",
      )
      .eq("user_id", user.id)
      .eq("bucket", bucket as "loved" | "fine" | "bad")
      .order("ord", { ascending: true }),
  ]);

  if (listRes.error) return { ok: false, error: listRes.error.message };

  type Row = {
    title_id: string;
    score: number;
    titles: {
      title_english: string | null;
      title_romaji: string | null;
      cover_image_large: string | null;
      cover_color: string | null;
    };
  };

  const items = ((listRes.data ?? []) as unknown as Row[]).map((row) => ({
    titleId: row.title_id,
    name: row.titles.title_english ?? row.titles.title_romaji ?? "Untitled",
    cover: row.titles.cover_image_large,
    color: row.titles.cover_color,
    score: Number(row.score),
  }));

  return { ok: true, data: { ratedCount: countRes.count ?? 0, items } };
}

/** Just the count, for deciding which mode the dialog opens in. */
export async function getRatedCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("ratings")
    .select("title_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return count ?? 0;
}

/* -------------------------------------------------------------------------- */

const placeInput = z.object({
  titleId,
  bucket: z.enum(["loved", "fine", "bad"]),
  /** 0-based slot in the bucket's ascending list. */
  position: z.number().int().min(0),
});

/**
 * Commit a placement. The server reshuffles the bucket and hands back the
 * score that fell out, which is the first time either side knows what it is.
 */
export async function placeRating(input: {
  titleId: string;
  bucket: string;
  position: number;
}): Promise<RatingResult> {
  const parsed = placeInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid placement.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in to rate." };

  const { data, error } = await supabase.rpc("place_rating", {
    p_title_id: parsed.data.titleId,
    p_bucket: parsed.data.bucket,
    p_position: parsed.data.position,
  });
  if (error) return { ok: false, error: error.message };

  const score = Number(data);

  // Best-effort: a failed activity row must never fail the rating.
  await supabase.from("activity").insert({
    user_id: user.id,
    title_id: parsed.data.titleId,
    kind: "rated",
    payload: { score, bucket: parsed.data.bucket },
  });

  revalidateRating(parsed.data.titleId);
  return { ok: true, score };
}

/* -------------------------------------------------------------------------- */

const seedInput = z.object({
  titleId,
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
});

/** Direct score entry, used only until the user has SEED_TARGET ratings. */
export async function seedRating(input: {
  titleId: string;
  score: number;
}): Promise<RatingResult> {
  const parsed = seedInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid score." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in to rate." };

  const { data, error } = await supabase.rpc("seed_rating", {
    p_title_id: parsed.data.titleId,
    p_score: parsed.data.score,
  });
  if (error) return { ok: false, error: error.message };

  const score = Number(data);

  await supabase.from("activity").insert({
    user_id: user.id,
    title_id: parsed.data.titleId,
    kind: "rated",
    payload: { score },
  });

  revalidateRating(parsed.data.titleId);
  return { ok: true, score };
}

/* -------------------------------------------------------------------------- */

export async function clearRating(id: string): Promise<ActionResult> {
  const parsed = titleId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid title." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { error } = await supabase.rpc("unrate", { p_title_id: parsed.data });
  if (error) return { ok: false, error: error.message };

  revalidateRating(parsed.data);
  return { ok: true };
}

function revalidateRating(id: string) {
  // A placement rescores a whole bucket, so every list that shows a score is
  // stale, not just this title's page.
  revalidatePath(`/title/${id}`);
  revalidatePath("/library");
  revalidatePath("/");
}

/* -------------------------------------------------------------------------- */

export async function toggleFavorite(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: existing } = await supabase
    .from("favorites")
    .select("title_id")
    .eq("user_id", user.id)
    .eq("title_id", id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { count } = await supabase
      .from("favorites")
      .select("title_id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, title_id: id, position: count ?? 0 });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/title/${id}`);
  return { ok: true };
}
