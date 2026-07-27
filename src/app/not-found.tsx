import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <GlassPanel radius="xl" className="max-w-md p-10 text-center">
        <h1 className="text-3xl font-bold tracking-[-0.03em]">Nothing here</h1>
        <p className="text-fg-3 mt-2 text-sm leading-relaxed">
          That title, profile or page doesn&rsquo;t exist — or it isn&rsquo;t in the
          catalog yet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "primary" })}>
            Go home
          </Link>
          <Link href="/discover" className={buttonVariants()}>
            Search the catalog
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}
