import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AniList serves all cover/banner art from its own CDN.
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "img.anili.st" },
      // Supabase Storage, for user avatars/banners. Replace <ref> after you
      // create your project (see MANUAL_SETUP.md step 2).
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    // Cover art is served at a handful of fixed widths; trimming the srcset
    // keeps markup small.
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    // Faster cold restarts in dev. Beta in 16, safe to drop if it misbehaves.
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
