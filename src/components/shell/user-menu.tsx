"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import type { Profile } from "@/lib/types/database";
import { buttonVariants } from "@/components/ui/button";

export function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!profile) {
    return (
      <Link
        href="/login"
        className={buttonVariants({ variant: "primary", size: "sm" }) + " shrink-0"}
      >
        Sign in
      </Link>
    );
  }

  const initial = (profile.display_name || profile.username).charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="glass-subtle glass-press specular grid size-9 place-items-center overflow-hidden rounded-full"
      >
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={36}
            height={36}
            className="size-9 object-cover"
          />
        ) : (
          <span className="text-sm font-semibold">{initial}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="glass-heavy specular absolute top-11 right-0 w-56 origin-top-right overflow-hidden rounded-lg p-1.5"
          >
            <div className="border-hairline border-b px-3 py-2.5">
              <p className="truncate text-sm font-semibold">
                {profile.display_name || profile.username}
              </p>
              <p className="text-fg-3 truncate text-xs">@{profile.username}</p>
            </div>

            <MenuLink href={`/u/${profile.username}`} icon={UserIcon} onNavigate={() => setOpen(false)}>
              Profile
            </MenuLink>
            <MenuLink href="/settings" icon={Settings} onNavigate={() => setOpen(false)}>
              Settings
            </MenuLink>

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="text-fg-2 hover:text-fg flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-[var(--glass-2)]"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="text-fg-2 hover:text-fg flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-[var(--glass-2)]"
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}
