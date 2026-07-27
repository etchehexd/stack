"use client";

import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";

export function CalendarFilter({
  onlyTracked,
  count,
}: {
  onlyTracked: boolean;
  count: number;
}) {
  const router = useRouter();

  return (
    <Segmented
      size="sm"
      layoutId="calendar-filter-thumb"
      value={onlyTracked ? "tracked" : "all"}
      onChange={(value) =>
        router.replace(value === "tracked" ? "/calendar?tracked=1" : "/calendar", {
          scroll: false,
        })
      }
      options={[
        { value: "all", label: "Everything" },
        { value: "tracked", label: "My library", count },
      ]}
    />
  );
}
