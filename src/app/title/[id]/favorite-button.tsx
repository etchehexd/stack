"use client";

import * as React from "react";
import { Heart } from "lucide-react";

import { toggleFavorite } from "@/app/actions/rating";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  titleId,
  initial,
}: {
  titleId: string;
  initial: boolean;
}) {
  const [favorite, setFavorite] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = !favorite;
    setFavorite(next); // optimistic
    startTransition(async () => {
      const result = await toggleFavorite(titleId);
      if (!result.ok) setFavorite(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "glass-subtle specular glass-press inline-flex h-9 items-center gap-2 rounded-pill px-4 text-sm font-medium",
        favorite && "text-[var(--color-manga)]",
      )}
      style={
        favorite
          ? {
              borderColor: "color-mix(in oklch, var(--color-manga) 50%, transparent)",
              background: "color-mix(in oklch, var(--color-manga) 14%, transparent)",
            }
          : undefined
      }
    >
      <Heart className={cn("size-4", favorite && "fill-current")} />
      {favorite ? "Favorited" : "Favorite"}
    </button>
  );
}
