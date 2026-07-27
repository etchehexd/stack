"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDays, Compass, Home, Library } from "lucide-react";

import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { QuickSearch } from "./quick-search";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "Library", icon: Library },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function NavBar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 pt-3 sm:px-6 lg:px-10">
      <nav className="glass-heavy specular mx-auto flex h-14 w-full max-w-[1600px] items-center gap-2 rounded-pill px-3 sm:gap-4 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 pr-1 pl-1.5 sm:pl-2"
          aria-label="Stack — home"
        >
          <StackMark />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
            Stack
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                  active ? "text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-pill border border-hairline bg-[var(--glass-2)]"
                  />
                )}
                <span className="relative z-1 inline-flex items-center gap-2">
                  <Icon className="size-4" strokeWidth={2.2} />
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
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
    <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
      <defs>
        <linearGradient id="stack-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-anime)" />
          <stop offset="100%" stopColor="var(--color-manga)" />
        </linearGradient>
      </defs>
      <rect x="14" y="36" width="36" height="9" rx="4.5" fill="url(#stack-mark)" opacity="0.35" />
      <rect x="14" y="26" width="36" height="9" rx="4.5" fill="url(#stack-mark)" opacity="0.65" />
      <rect x="14" y="16" width="36" height="9" rx="4.5" fill="url(#stack-mark)" />
    </svg>
  );
}
