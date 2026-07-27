import type { Metadata } from "next";
import { SetupRequired } from "@/components/shell/setup-required";

export const metadata: Metadata = { title: "Setup required" };

/**
 * Where proxy.ts sends every request while Supabase credentials are missing.
 *
 * The rewrite matters: without it, Next renders the requested page in parallel
 * with the layout, so pages would still run their database queries and throw —
 * filling the logs with errors nobody can act on, even though the user is
 * correctly seeing the setup screen.
 */
export default function SetupPage() {
  return <SetupRequired />;
}
