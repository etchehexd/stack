"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Popover, PopoverItem } from "@/components/ui/popover";
import type { Profile } from "@/lib/types/database";
import { buttonVariants } from "@/components/ui/button-variants";

export function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement>(null);

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
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="glass-subtle glass-press grid size-8 shrink-0 place-items-center overflow-hidden rounded-full"
      >
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={32}
            height={32}
            className="size-8 object-cover"
          />
        ) : (
          <span className="text-[13px] font-bold">{initial}</span>
        )}
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={trigger}
        align="end"
        width={224}
      >
        <div className="border-hairline mb-1 border-b px-3 py-2.5">
          <p className="truncate text-sm font-semibold tracking-tight">
            {profile.display_name || profile.username}
          </p>
          <p className="text-fg-3 truncate text-xs">@{profile.username}</p>
        </div>

        <MenuLink
          href={`/u/${profile.username}`}
          icon={UserIcon}
          onNavigate={() => setOpen(false)}
        >
          Profile
        </MenuLink>
        <MenuLink href="/settings" icon={Settings} onNavigate={() => setOpen(false)}>
          Settings
        </MenuLink>

        <form action={signOut}>
          <PopoverItem
            type="submit"
            role="menuitem"
            icon={<LogOut className="size-4" />}
          >
            Sign out
          </PopoverItem>
        </form>
      </Popover>
    </>
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
      className="text-fg-2 hover:text-fg flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--glass-hover)]"
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}
