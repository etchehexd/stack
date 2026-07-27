"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isValidRating } from "@/lib/rating";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const halfStar = z
  .number()
  .refine(isValidRating, "Ratings must be 0.5–5.0 in half-star steps.");

const ratingInput = z.object({
  titleId: z.uuid(),
  enjoyment: halfStar.nullable(),
  craft: halfStar.nullable(),
});

/**
 * Upsert the current user's two-axis rating for a title.
 *
 * Both axes are independent and either may be null — you can rate Craft
 * without having decided on Enjoyment yet. If BOTH are cleared we delete the
 * row rather than storing a meaningless empty rating.
 */
export async function saveRating(input: {
  titleId: string;
  enjoyment: number | null;
  craft: number | null;
}): Promise<ActionResult> {
  const parsed = ratingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rating." };
  }
  const { titleId, enjoyment, craft } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You need to be signed in to rate." };

  if (enjoyment == null && craft == null) {
    const { error } = await supabase
      .from("ratings")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", titleId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("ratings")
      .upsert(
        { user_id: user.id, title_id: titleId, enjoyment, craft },
        { onConflict: "user_id,title_id" },
      );
    if (error) return { ok: false, error: error.message };

    // Activity is best-effort — a failure here must not fail the rating.
    await supabase.from("activity").insert({
      user_id: user.id,
      title_id: titleId,
      kind: "rated",
      payload: { enjoyment, craft },
    });
  }

  revalidatePath(`/title/${titleId}`);
  revalidatePath("/library");
  return { ok: true };
}

export async function toggleFavorite(titleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: existing } = await supabase
    .from("favorites")
    .select("title_id")
    .eq("user_id", user.id)
    .eq("title_id", titleId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", titleId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { count } = await supabase
      .from("favorites")
      .select("title_id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, title_id: titleId, position: count ?? 0 });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/title/${titleId}`);
  return { ok: true };
}
