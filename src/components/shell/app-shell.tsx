import Link from "next/link";
import type { Profile } from "@/lib/types/database";
import { NavBar } from "./nav-bar";
import { MobileTabBar } from "./mobile-tab-bar";

/**
 * App chrome: a floating glass nav on desktop, a bottom tab bar on mobile.
 * Rendered from the root layout so it survives navigation.
 */
export function AppShell({
  profile,
  children,
}: {
  profile: Profile | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main"
        className="glass sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100"
      >
        Skip to content
      </a>

      <NavBar profile={profile} />

      <main
        id="main"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-20 pb-28 sm:px-6 lg:px-10 lg:pb-16"
      >
        {children}
      </main>

      <footer className="text-fg-3 mx-auto hidden w-full max-w-[1600px] items-center justify-between px-10 pb-8 text-xs lg:flex">
        <p>
          Title data from{" "}
          <Link
            href="https://anilist.co"
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg-2 underline underline-offset-2"
          >
            AniList
          </Link>
          . Not affiliated.
        </p>
        <p>Rate what you love. Rate what&rsquo;s good. They&rsquo;re not the same.</p>
      </footer>

      <MobileTabBar signedIn={Boolean(profile)} username={profile?.username ?? null} />
    </>
  );
}
