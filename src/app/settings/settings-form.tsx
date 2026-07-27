"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";

import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { ActionResult } from "@/app/actions/rating";
import type { Profile } from "@/lib/types/database";
import { SEED_TARGET } from "@/lib/rating";

const INITIAL: ActionResult = { ok: false };

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <GlassPanel radius="xl" className="space-y-4 p-6">
        <h2 className="panel-title">Profile</h2>

        <label className="block">
          <span className="text-fg-2 mb-1.5 block text-xs font-medium">
            Display name
          </span>
          <input
            name="displayName"
            defaultValue={profile.display_name ?? ""}
            maxLength={48}
            placeholder={profile.username}
            className="glass-subtle placeholder:text-fg-3 h-11 w-full rounded-md px-3.5 text-sm outline-none"
          />
        </label>

        <label className="block">
          <span className="text-fg-2 mb-1.5 block text-xs font-medium">Bio</span>
          <textarea
            name="bio"
            defaultValue={profile.bio ?? ""}
            maxLength={500}
            rows={3}
            placeholder="What are you into?"
            className="glass-subtle placeholder:text-fg-3 w-full resize-y rounded-md px-3.5 py-2.5 text-sm outline-none"
          />
        </label>

        <Toggle
          name="isPrivate"
          defaultChecked={profile.is_private}
          label="Private profile"
          description="Hide your library, ratings and activity from everyone else."
        />
      </GlassPanel>

      <GlassPanel radius="xl" className="space-y-3 p-6">
        <h2 className="panel-title">Ratings</h2>
        <p className="text-fg-2 text-sm leading-relaxed">
          Your first {SEED_TARGET} ratings are typed in directly. After that
          Stack stops asking for numbers and asks you to compare instead — a few
          taps per title, and the score is worked out from where it lands.
        </p>
        <p className="text-fg-3 text-sm leading-relaxed">
          Scores shift as your list grows. That is the point: a 9.1 means
          &ldquo;ninth-best thing I&rsquo;ve seen&rdquo;, and that changes.
        </p>
      </GlassPanel>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>

        {state.ok && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]">
            <Check className="size-4" />
            Saved
          </span>
        )}
        {state.error && (
          <span className="text-sm text-[var(--danger)]">{state.error}</span>
        )}
      </div>
    </form>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  description: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-fg-3 mt-0.5 block text-xs leading-relaxed">
          {description}
        </span>
      </span>
    </label>
  );
}
