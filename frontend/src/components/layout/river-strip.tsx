import { RiverBoat } from "@/components/layout/river-boat";
import { RiverMug } from "@/components/layout/river-mug";
import { RiverWaxSeal } from "@/components/layout/river-wax-seal";

const ZONE_WIDTH_PERCENT = 100 / 3;

/**
 * Река — the homepage's header river (design_handoff_buza_river): a thin
 * strip full-width of the header (deliberately outside `Container`, unlike
 * everything else in `site-header.tsx`), riverbed + flowing current drawn as
 * one wave-shaped SVG path, split into three equal zones — the wax seal
 * (`river-wax-seal.tsx`), the boat (`river-boat.tsx`), the mug
 * (`river-mug.tsx`) — one per theory in `buza.tsx`'s own etymology chips
 * (буянить/корабль/напиток). All three call into the shared `useBuza` to
 * open the section; each dims at rest and brightens only while the pointer
 * is over its own third (`.river-symbol`, globals.css) and idles with the
 * same gentle rise-and-fall at staggered delays (`.river-bob`), so they read
 * as three things riding at anchor on one body of water, each answering for
 * its own patch of it.
 *
 * A fixed three-way split, not one symbol chasing the cursor around a
 * shared strip: an earlier version tracked the boat to the pointer
 * everywhere and had to steer it clear of the other two so it wouldn't sail
 * over them, which also meant it was lit up almost everywhere you pointed —
 * three static zones, each responsible only for its own third, is simpler
 * and doesn't have that "always highlighted" problem.
 *
 * Rendered only on the homepage (`site-header.tsx` gates it on `pathname`):
 * "Буза" itself only exists there, so none of the three would have anything
 * to open on every other route.
 */
export function RiverStrip() {
  return (
    <div
      className="relative h-11 overflow-hidden border-t border-[#241c15]"
      style={{ background: "linear-gradient(180deg, #100e0c, #161310)" }}
    >
      <svg
        viewBox="0 0 1440 44"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M0 22 C 90 6, 180 38, 270 20 S 460 4, 560 24 S 760 40, 860 18 S 1040 4, 1160 22 S 1360 36, 1440 20 L1440 44 L0 44 Z"
          fill="#1c2b30"
          opacity="0.55"
        />
        <path
          className="river-flow"
          d="M0 22 C 90 6, 180 38, 270 20 S 460 4, 560 24 S 760 40, 860 18 S 1040 4, 1160 22 S 1360 36, 1440 20"
          fill="none"
          stroke="#4a6d75"
          strokeWidth="1.6"
          strokeDasharray="7 7"
          opacity="0.75"
        />
      </svg>

      <div className="absolute inset-y-0" style={{ left: "0%", width: `${ZONE_WIDTH_PERCENT}%` }}>
        <RiverWaxSeal />
      </div>
      <div className="absolute inset-y-0" style={{ left: `${ZONE_WIDTH_PERCENT}%`, width: `${ZONE_WIDTH_PERCENT}%` }}>
        <RiverBoat />
      </div>
      <div
        className="absolute inset-y-0"
        style={{ left: `${ZONE_WIDTH_PERCENT * 2}%`, width: `${ZONE_WIDTH_PERCENT}%` }}
      >
        <RiverMug />
      </div>
    </div>
  );
}
