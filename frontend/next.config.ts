import type { NextConfig } from "next";

/**
 * Long-lived caching for the static art in `public/`.
 *
 * Next already serves everything under `/_next/static` as
 * `max-age=31536000, immutable` because those filenames carry a content hash.
 * Files in `public/` get `max-age=0` instead — correct as a default, since
 * their names are stable and Next cannot know when the bytes behind them
 * change — but it meant roughly 3.4 MB of archive scans, exhibit photographs
 * and the emblem were revalidated on every single navigation.
 *
 * 30 days rather than a year with `immutable`: these names are *not* hashed,
 * so an `immutable` response would pin a replaced picture in readers' caches
 * with no way to push a correction. A month is long enough that repeat
 * visitors never re-download the archive, and short enough that swapping a
 * gear photograph self-heals. If these ever move to hashed filenames, this is
 * the place to raise it to `immutable`.
 */
const ASSET_CACHE_CONTROL = "public, max-age=2592000";

const ASSET_DIRECTORIES = ["archive", "references", "brand"];

const nextConfig: NextConfig = {
  images: {
    // Default is `['image/webp']` alone; AVIF has to be opted into. Ordered
    // AVIF-first because the array order is the preference order, and these
    // are large photographic scans — exactly the case where AVIF's advantage
    // over WebP is worth the extra encode. Browsers without AVIF fall back to
    // WebP, and those without either get the original file.
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return ASSET_DIRECTORIES.map((directory) => ({
      source: `/${directory}/:path*`,
      headers: [{ key: "Cache-Control", value: ASSET_CACHE_CONTROL }],
    }));
  },
};

export default nextConfig;
