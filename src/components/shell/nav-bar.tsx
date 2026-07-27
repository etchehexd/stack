"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { QuickSearch } from "./quick-search";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/library", label: "Library" },
  { href: "/calendar", label: "Calendar" },
] as const;

/**
 * A single 48px bar pinned to the top.
 *
 * It was 56px tall with a 36px avatar, a 36px toggle, a 36px search field and
 * icon-plus-label nav pills — seven rounded shapes at four different heights
 * competing along one line. Everything interactive is 32px now and shares a
 * baseline, the nav items lost their icons (the word is the affordance), and
 * the bar is a rounded rectangle rather than a full pill so it reads as a bar
 * rather than a floating lozenge.
 */
export function NavBar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();

  return (
    <header
      className="fixed inset-x-0 top-0 px-3 pt-2.5 sm:px-5 lg:px-8"
      style={{ zIndex: "var(--z-nav)" as unknown as number }}
    >
      <nav className="glass-heavy mx-auto flex h-12 w-full max-w-[1600px] items-center gap-2 rounded-2xl px-2.5 sm:gap-3 sm:px-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 pr-1"
          aria-label="Stack — home"
        >
          <StackMark />
          <span className="hidden text-[14px] font-bold tracking-[-0.02em] sm:inline">
            Stack
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {LINKS.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative rounded-lg px-2.5 py-1.5 text-[13px] font-semibold tracking-tight transition-colors duration-200",
                  active ? "text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    className="absolute inset-0 rounded-lg bg-[var(--glass-2)]"
                  />
                )}
                <span className="relative z-1">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <QuickSearch />
          <ThemeToggle />
          <UserMenu profile={profile} />
        </div>
      </nav>
    </header>
  );
}

function StackMark() {
  return (
    <svg viewBox="0 0 64 64" className="size-6" aria-hidden>
      <defs>
        <linearGradient id="stack-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-anime)" />
          <stop offset="100%" stopColor="var(--color-manga)" />
        </linearGradient>
      </defs>
      <rect x="14" y="37" width="36" height="8" rx="4" fill="url(#stack-mark)" opacity="0.35" />
      <rect x="14" y="27" width="36" height="8" rx="4" fill="url(#stack-mark)" opacity="0.65" />
      <rect x="14" y="17" width="36" height="8" rx="4" fill="url(#stack-mark)" />
    </svg>
  );
}
