"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { Seal } from "@/components/brand/seal";
import { WEAPON_MOTIFS, randomWeaponMotif, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";
import { CLASH_RESULT_LINES, ClashCard } from "@/features/home/clash-card";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
import { describeWeaponRule } from "@/features/home/equipment";
import { selectExhibit } from "@/lib/gear-archive-link";
import type { WeaponRulesView } from "@/types";

type Clash = { a: WeaponMotifKey; b: WeaponMotifKey; nonce: number; result: string };
type IllustrationMode = "mask" | "equipment";

/** Lunge (760ms, the longest animation in `ClashCard`) plus a hold so the
 *  matchup stays legible for a beat before the illustration returns. */
const CLASH_HOLD_MS = 760 + 1600;

const ClashStageContext = createContext<{
  clash: Clash | null;
  mode: IllustrationMode;
  toggleMode: () => void;
  trigger: (motif?: WeaponMotifKey) => void;
} | null>(null);

/**
 * Shared click-to-clash state for the hero's illustration plate and its
 * "Знаки традиции" row below — two siblings that aren't adjacent in
 * `hero.tsx`'s markup (the plate sits in the title/illustration grid, the
 * row is its own strip further down), so a plain lifted `useState` in
 * `hero.tsx` itself would mean turning that whole server component client
 * just to host it. A small scoped context does the same job without that.
 *
 * `mode` toggles the illustration between the mask (`HelmetReveal`) and the
 * "опись обязательного снаряжения" plate (`EquipmentPlate`, direction 4 of
 * the hero exploration) — a duel always returns to whichever of the two was
 * showing, never back to the mask specifically.
 *
 * Auto-clears `clash` back to `null` `CLASH_HOLD_MS` after it's set, via an
 * effect keyed on `clash` — a re-trigger before that fires just cancels the
 * pending clear and restarts it, so rapid clicks each get their own full
 * hold instead of the illustration snapping back mid-duel.
 */
export function HeroClashProvider({ children }: { children: ReactNode }) {
  const [clash, setClash] = useState<Clash | null>(null);
  const [mode, setMode] = useState<IllustrationMode>("mask");
  const nonceRef = useRef(0);

  useEffect(() => {
    if (!clash) return;
    const timer = window.setTimeout(() => setClash(null), CLASH_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [clash]);

  // `motif` is the side the user actually clicked (a знак) — the opponent,
  // and the whole pairing for an амуниция click or the header logo (no
  // motif), are random: with only 4 weapons a fixed table repeats fast, and
  // амуниция isn't tied to any one weapon category to begin with (see
  // `EquipmentPlate`'s own footer note).
  const trigger = (motif?: WeaponMotifKey) => {
    nonceRef.current += 1;
    setClash({
      a: motif ?? randomWeaponMotif(),
      b: randomWeaponMotif(),
      nonce: nonceRef.current,
      result: CLASH_RESULT_LINES[Math.floor(Math.random() * CLASH_RESULT_LINES.length)],
    });
  };

  const toggleMode = () => setMode((current) => (current === "mask" ? "equipment" : "mask"));

  return (
    <ClashStageContext.Provider value={{ clash, mode, toggleMode, trigger }}>{children}</ClashStageContext.Provider>
  );
}

function useClashStage() {
  const ctx = useContext(ClashStageContext);
  if (!ctx) throw new Error("useClashStage must be used inside HeroClashProvider");
  return ctx;
}

/** The illustration slot: the mask (`mask`) or the equipment plate at rest
 *  (whichever `mode` is active), crossfading to the "Живая сшибка" plate for
 *  `CLASH_HOLD_MS` after a знак, an амуниция item, or the header logo
 *  triggers it. */
export function HeroIllustration({ mask }: { mask: ReactNode }) {
  const { clash, mode } = useClashStage();
  if (clash) return <ClashCard a={clash.a} b={clash.b} nonce={clash.nonce} result={clash.result} />;
  return mode === "equipment" ? <EquipmentPlate /> : <>{mask}</>;
}

/** The switch between `mode`'s two illustration states — the mask's own
 *  hover reveal stays the idle default; this is the only way to reach the
 *  опись. Rendered by `hero.tsx` inside a footer strip docked directly onto
 *  the plate's own border (sharing its left/right/bottom edge), so it reads
 *  as part of the specimen card rather than a link floating in the page's
 *  own whitespace below it. Unstyled beyond color/hover here on purpose —
 *  the docked strip supplies the padding and border. */
export function HeroIllustrationToggle() {
  const { mode, toggleMode } = useClashStage();
  return (
    <button
      type="button"
      onClick={toggleMode}
      className="record-label text-[var(--accent)] transition-colors hover:text-[var(--accent-deep)]"
    >
      {mode === "mask" ? "Показать снаряжение →" : "← Показать маску"}
    </button>
  );
}

/**
 * The "Знаки традиции" row: clicking a seal starts a сшибка in
 * `HeroIllustration` above featuring that motif, and the row's own two
 * engaged seals glow (`.seal-glow`) in sync so the duel reads as being about
 * those two marks specifically. `key={clash?.nonce}` on the glowing seal
 * forces it to remount (and so replay `.seal-glow`) even when the same знак
 * is clicked twice in a row.
 *
 * Hover/focus (not click — click stays the existing сшибка trigger) makes
 * that one seal grow and the row's other three dim, catalogue-style, and
 * reveals a one-line description underneath. The description is never
 * invented copy: it's `rules` (the same `GET /api/v1/bout-rules` payload
 * `equipment.tsx`'s "Чем бьются" section renders further down the page,
 * threaded down from `page.tsx` → `Hero`) run through the same
 * `describeWeaponRule` used there, so a знак here and its full entry later
 * on the page always say the same true thing. `rules` can be `null` (API
 * unreachable) — the description slot just stays empty, same graceful
 * degradation `equipment.tsx` already has for that case.
 */
export function HeroTraditionSeals({ rules }: { rules: WeaponRulesView | null }) {
  const { clash, trigger } = useClashStage();
  const [hoveredKey, setHoveredKey] = useState<WeaponMotifKey | null>(null);

  const hoveredRule = rules?.weapons.find((weapon) => weapon.code === hoveredKey?.toUpperCase());
  const description = hoveredRule && rules ? describeWeaponRule(hoveredRule, rules) : null;

  return (
    <div className="border border-[var(--border)]">
      <p className="record-label border-b border-[var(--border)] px-5 py-3 text-[var(--chrome-muted)]">
        Знаки традиции
      </p>
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] sm:grid-cols-4 sm:divide-y-0">
        {WEAPON_MOTIFS.map(({ key, label, Icon }, index) => {
          const glowing = clash !== null && (clash.a === key || clash.b === key);
          const hovered = hoveredKey === key;
          const dimmed = hoveredKey !== null && !hovered;
          return (
            <button
              key={key}
              type="button"
              onClick={() => trigger(key)}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey((current) => (current === key ? null : current))}
              onFocus={() => setHoveredKey(key)}
              onBlur={() => setHoveredKey((current) => (current === key ? null : current))}
              aria-label={`Знак «${label}» — сшибка`}
              className="group flex flex-col items-center gap-2 px-4 py-5 text-center transition-colors duration-200 hover:bg-[var(--surface-muted)]"
              style={{ opacity: dimmed ? 0.45 : 1 }}
            >
              <span className="record-label text-[var(--text-4)]">{String(index + 1).padStart(2, "0")}</span>
              {/* `tone="gold"` here, not the shared component's usual "iron" —
                  iron (`var(--iron)` #4a3a28) barely registered against this
                  section's own dark ground, "не очень заметно" per the user;
                  gold reads clearly without competing with the accent-red
                  clash/glow states. */}
              <span className="inline-block transition-transform duration-200" style={{ transform: hovered ? "scale(1.12)" : "scale(1)" }}>
                <Seal key={glowing ? clash!.nonce : "rest"} size={38} tone="gold" className={glowing ? "seal-glow" : undefined}>
                  <Icon size={17} />
                </Seal>
              </span>
              <span className="record-label text-[var(--muted)] transition-colors group-hover:text-[var(--foreground)]">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Reserved height even when empty, so hovering a seal never nudges
          the row (and anything below it) up/down the page. */}
      <p className="min-h-[2.75rem] border-t border-[var(--border)] px-5 py-2.5 text-[0.8125rem] leading-snug text-[var(--text-3)] transition-opacity duration-200" style={{ opacity: description ? 1 : 0 }}>
        {description ?? " "}
      </p>
    </div>
  );
}

/**
 * "Опись обязательный комплект на бою" — a direct port of the design
 * canvas's "Вариант В — опись обязательного снаряжения" (direction 4): the
 * nine items a fighter wears regardless of drawn weapon category, in the
 * same bordered specimen-plate frame as `ClashCard`. Each item is a deep
 * link into "Архив экипировки" (`gear-archive.tsx`) further down the page —
 * clicking "Паховая защита" here scrolls there and selects that exact
 * exhibit — via `selectExhibit` (`@/lib/gear-archive-link`). This replaced
 * an earlier "click starts a random сшибка" behavior: with a specific item
 * named on the button, jumping to a same-named exhibit is a much more
 * legible response to the click than an unrelated random weapon duel.
 *
 * `EQUIPMENT_ITEMS` itself lives in `equipment-items.ts`, shared with that
 * same archive slider — this grid's item order is the slider's index order.
 */
function EquipmentPlate() {
  return (
    <div className="relative overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-muted)] p-6">
      <span aria-hidden="true" className="tick" style={{ top: 10, left: 10, borderTop: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ top: 10, right: 10, borderTop: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ bottom: 10, left: 10, borderBottom: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ bottom: 10, right: 10, borderBottom: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />

      <p className="record-label m-0 text-[var(--gold)]">Опись · обязательный комплект на бою</p>

      {/* Hairline-ruled grid, not gapped blocks floating in whitespace — the
          same "1px background-color lines showing through `gap-px`" trick
          `equipment.tsx`'s own `EquipmentList` already uses for the real
          weapon-разряд list, reused here for the same reason: nine short
          items with real gaps between them read as loose/disconnected
          ("слишком далеко друг от друга"), the same nine ruled into one
          ledger read as a single opись instead of nine separate cards. */}
      <div className="mt-4 grid grid-cols-3 gap-px border border-[var(--border)] bg-[var(--border)]">
        {EQUIPMENT_ITEMS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => selectExhibit(index)}
            className="group bg-[var(--surface-muted)] p-3 text-left transition-colors hover:bg-[var(--surface)]"
            aria-label={`${item.title} — открыть в архиве экипировки`}
          >
            <span className="record-label text-[var(--text-4)]">{String(index + 1).padStart(2, "0")}</span>
            <p className="mt-1 text-[0.8125rem] font-medium leading-tight text-[var(--foreground)] group-hover:text-[var(--accent)]">
              {item.title}
            </p>
            <p className="mt-0.5 text-[0.7rem] leading-snug text-[var(--muted)]">{item.desc}</p>
          </button>
        ))}
      </div>

      <p className="mt-5 border-t border-[var(--border)] pt-3 text-[0.75rem] leading-relaxed text-[var(--muted)]">
        Разряд (нож / кистень / палка / безоружный) решает жребий на сходке — см. «Знаки традиции» ниже.
      </p>
    </div>
  );
}
