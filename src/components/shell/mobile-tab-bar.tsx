"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDays, Compass, Home, Library, User } from "lucide-react";

import { cn } from "@/lib/utils";

export function MobileTabBar({
  signedIn,
  username,
}: {
  signedIn: boolean;
  username: string | null;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/library", label: "Library", icon: Library },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    {
      href: signedIn && username ? `/u/${username}` : "/login",
      label: signedIn ? "Profile" : "Sign in",
      icon: User,
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="glass-heavy specular mx-auto flex max-w-md items-center justify-around rounded-pill p-1.5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-pill py-2",
                active ? "text-fg" : "text-fg-3",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-pill bg-[var(--glass-2)]"
                />
              )}
              <Icon className="relative z-1 size-5" strokeWidth={active ? 2.4 : 2} />
              <span className="relative z-1 text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
