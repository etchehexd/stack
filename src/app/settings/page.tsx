import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsForm } from "./settings-form";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-fg-3 mt-1 text-sm">@{profile.username}</p>
      </div>

      <SettingsForm profile={profile} />
    </div>
  );
}
