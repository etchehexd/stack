"use client";

import { useEffect } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <GlassPanel radius="xl" className="max-w-md p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Something broke</h1>
        <p className="text-fg-3 mt-2 text-sm leading-relaxed">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-fg-3 mt-2 font-mono text-[11px]">{error.digest}</p>
        )}
        <Button variant="primary" onClick={reset} className="mt-6">
          Try again
        </Button>
      </GlassPanel>
    </div>
  );
}
