import type { Metadata } from "next";
import Link from "next/link";

import { LibraryView } from "./library-view";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button";
import { getLibrary, getRatingsMap } from "@/lib/queries";
import { getCurrentProfile } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/types/database";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <GlassPanel radius="xl" className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Your library lives here</h1>
        <p className="text-fg-2 mt-2 text-sm leading-relaxed">
          Sign in to track what you&rsquo;re watching and reading, and to rate it on
          both axes.
        </p>
        <Link
          href="/login"
          className={buttonVariants({ variant: "primary", className: "mt-5" })}
        >
          Sign in
        </Link>
      </GlassPanel>
    );
  }

  const [anime, manga, lightNovel, ratings] = await Promise.all([
    getLibrary(profile.id, "anime"),
    getLibrary(profile.id, "manga"),
    getLibrary(profile.id, "light_novel"),
    getRatingsMap(profile.id),
  ]);

  const entries: Record<MediaType, typeof anime> = {
    anime,
    manga,
    light_novel: lightNovel,
  };

  const total = anime.length + manga.length + lightNovel.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-fg-3 mt-1 text-sm tabular-nums">
          {total} {total === 1 ? "title" : "titles"} tracked
        </p>
      </div>

      <LibraryView
        entries={entries}
        ratings={Object.fromEntries(ratings)}
        overallSortEnabled={profile.preferences?.overall_sort_enabled ?? false}
      />
    </div>
  );
}
