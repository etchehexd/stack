"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { RatingScatter, type ScatterPoint } from "@/components/rating/rating-scatter";
import { Segmented } from "@/components/ui/segmented";
import { mediaAccent, MEDIA_LABEL } from "@/lib/utils";

type Filter = "all" | "anime" | "manga" | "light_novel";

/**
 * The full-size version of the rating chart. Same component as the compact pad
 * on the title page, just in `full` mode — so the visual language of "where
 * does this land" is identical everywhere.
 */
export function ProfileScatter({ points }: { points: ScatterPoint[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");

  const visible = React.useMemo(() => {
    if (filter === "all") return points;
    const wanted = mediaAccent(filter);
    return points.filter((p) => p.color === wanted);
  }, [points, filter]);

  return (
    <div className="space-y-4">
      <Segmented
        size="sm"
        layoutId="profile-scatter-thumb"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: points.length },
          ...(["anime", "manga", "light_novel"] as const).map((type) => ({
            value: type,
            label: MEDIA_LABEL[type],
            accent: mediaAccent(type),
            count: points.filter((p) => p.color === mediaAccent(type)).length,
          })),
        ]}
      />

      <RatingScatter
        variant="full"
        points={visible}
        onPointClick={(point) => {
          if (point.href) router.push(point.href);
        }}
        className="mx-auto max-w-lg"
      />

      <p className="text-fg-3 text-center text-xs">
        {visible.length} rated · hover a dot for the title, click to open it
      </p>
    </div>
  );
}
