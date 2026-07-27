"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/rating";

const profileInput = z.object({
  displayName: z.string().max(48).nullable(),
  bio: z.string().max(500).nullable(),
  isPrivate: z.boolean(),
  overallSortEnabled: z.boolean(),
});

export async function updateProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = profileInput.safeParse({
    displayName: (formData.get("displayName") as string)?.trim() || null,
    bio: (formData.get("bio") as string)?.trim() || null,
    isPrivate: formData.get("isPrivate") === "on",
    overallSortEnabled: formData.get("overallSortEnabled") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: existing } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio,
      is_private: parsed.data.isPrivate,
      preferences: {
        theme: "dark",
        adult_content: false,
        ...(existing?.preferences ?? {}),
        overall_sort_enabled: parsed.data.overallSortEnabled,
      },
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/library");
  revalidatePath("/", "layout");
  return { ok: true };
}
