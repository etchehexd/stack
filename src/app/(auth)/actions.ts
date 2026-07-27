"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const credentials = z.object({
  email: z.email("That doesn't look like an email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const username = String(formData.get("username") ?? "").trim();
  if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return {
      error: "Username must be 3–24 characters: letters, numbers or underscores.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
      // Consumed by the handle_new_user() trigger to seed profiles.username.
      data: username ? { username } : undefined,
    },
  });

  if (error) return { error: error.message };

  // When email confirmation is ON (the Supabase default), there is no session
  // yet — the user has to click the link in their inbox first.
  if (!data.session) {
    return {
      message:
        "Check your inbox — we sent you a confirmation link to finish signing up.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithOAuth(formData: FormData) {
  const provider = String(formData.get("provider"));
  if (provider !== "google" && provider !== "discord") {
    throw new Error("Unsupported provider");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await siteUrl()}/auth/callback` },
  });

  if (error) throw new Error(error.message);
  if (data.url) redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
