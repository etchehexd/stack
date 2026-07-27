import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/shell/app-shell";
import { SetupRequired } from "@/components/shell/setup-required";
import { getCurrentProfile } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Stack — rate what you love and what's good",
    template: "%s · Stack",
  },
  description:
    "Track anime, manga and light novels. Rate every title on two axes: how much you enjoyed it, and how well-made it is.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Stack", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#16181f" },
    { media: "(prefers-color-scheme: light)", color: "#f3f4f8" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Applies the saved theme before first paint so there is no light-mode flash.
 * DECISION: dark is the default when nothing is stored.
 */
const THEME_BOOTSTRAP = `
(function(){try{
  var t = localStorage.getItem('stack-theme');
  if (t !== 'light' && t !== 'dark') {
    t = (t === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', t);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Check config BEFORE touching Supabase. Building a client without
  // credentials throws, and a throw here takes down every route in the app with
  // an opaque "Server Components render" digest rather than anything actionable.
  if (!isSupabaseConfigured()) {
    return (
      <html lang="en" data-theme="dark" className={`${geistSans.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col font-sans">
          <div className="ambient-field" aria-hidden />
          <SetupRequired />
        </body>
      </html>
    );
  }

  const profile = await getCurrentProfile();

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <div className="ambient-field" aria-hidden />
        <AppShell profile={profile}>{children}</AppShell>
      </body>
    </html>
  );
}
