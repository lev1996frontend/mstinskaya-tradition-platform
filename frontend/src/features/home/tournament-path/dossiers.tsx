"use client";

import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import { WEAPON_LABELS } from "./bracket-data";
import { useTournamentPathActions, useTournamentPathState } from "./tournament-path-context";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

const DOSSIERS = [
  {
    name: "А. Ветров",
    club: "Мста · Вышний Волочёк",
    fileNo: "№ 014",
    stamp: "Допуск 2026",
    stats: [
      { label: "Боёв", value: "18" },
      { label: "Побед", value: "13" },
      { label: "Круг", value: "03" },
    ],
  },
  {
    name: "И. Дорохов",
    club: "Буза · Тверь",
    fileNo: "№ 027",
    stamp: "Допуск 2026",
    stats: [
      { label: "Боёв", value: "22" },
      { label: "Побед", value: "15" },
      { label: "Круг", value: "03" },
    ],
  },
  {
    name: "М. Гуляев",
    club: "Мста · Боровичи",
    fileNo: "№ 031",
    stamp: "Судья · III",
    stats: [
      { label: "Боёв", value: "31" },
      { label: "Побед", value: "19" },
      { label: "Круг", value: "02" },
    ],
  },
];

/**
 * ЛИЧНЫЕ ДЕЛА — no fighter photos, deliberately: there is no open-licensed
 * photo of a specific named participant, and a portrait frame over a
 * documentary photo would pass off a random person as this fighter. The
 * paper "case file" front (number, stamp, stats) carries the card instead.
 */
export function Dossiers() {
  const state = useTournamentPathState();
  const { declare } = useTournamentPathActions();

  return (
    <section id="bojcy" className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 sm:px-10 sm:py-24">
        <div className="flex items-center gap-5">
          <span className="record-label text-[var(--gold)]">Л. 07 · Личные дела</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
          <span className="record-label text-[var(--text-4)]">{DOSSIERS.length} участника показаны</span>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-8 sm:grid-cols-3" style={{ perspective: 1400 }}>
          {DOSSIERS.map((d) => (
            <article
              key={d.name}
              className="group px-[22px] pb-[26px] pt-[22px] transition-transform duration-500"
              style={{
                background: "var(--surface-paper)",
                color: "var(--surface-paper-ink)",
                transformStyle: "preserve-3d",
                boxShadow: "0 18px 40px -30px rgba(0,0,0,.9)",
              }}
            >
              <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: "rgba(36,28,21,.28)" }}>
                <span className="flex flex-col gap-1.5">
                  <span className="font-record text-[0.5rem] uppercase tracking-[0.2em]" style={{ color: "var(--surface-paper-label)" }}>
                    Личное дело
                  </span>
                  <span className="font-record text-[1.75rem] leading-none" style={{ color: "var(--accent-deep)" }}>
                    {d.fileNo}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="grid size-[66px] shrink-0 place-items-center rounded-full border-2 text-center font-record text-[0.5rem] uppercase leading-tight tracking-[0.1em]"
                  style={{ borderColor: "var(--accent-deep)", color: "var(--accent-deep)", transform: "rotate(-14deg)" }}
                >
                  {d.stamp}
                </span>
              </div>

              <p className="font-display m-0 mt-5 text-[2rem] font-bold leading-none tracking-tight transition-[letter-spacing] duration-300 group-hover:tracking-[0.02em]">
                {d.name}
              </p>
              <p className="mt-2 font-record text-[0.625rem] uppercase tracking-[0.18em]" style={{ color: "var(--surface-paper-label)" }}>
                {d.club}
              </p>

              <div className="mt-4.5 grid grid-cols-3 gap-3 border-t pt-3.5" style={{ borderColor: "rgba(36,28,21,.22)" }}>
                {d.stats.map((stat) => (
                  <span key={stat.label} className="flex flex-col gap-1">
                    <span className="font-record text-[0.5rem] uppercase tracking-[0.16em]" style={{ color: "var(--surface-paper-label)" }}>
                      {stat.label}
                    </span>
                    <span className="font-record text-[1.0625rem]" style={{ color: "var(--surface-paper-ink)" }}>
                      {stat.value}
                    </span>
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="font-record text-[0.5rem] uppercase tracking-[0.16em]" style={{ color: "var(--surface-paper-label)" }}>
                  Разряд
                </span>
                {WEAPON_LABELS.map(({ key, label }, i) => {
                  const Icon = FACE_ICONS[key];
                  const active = state.declared[d.name] === i;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={label}
                      onClick={() => declare(d.name, i)}
                      className="grid size-8 cursor-pointer place-items-center border transition-colors"
                      style={{
                        background: active ? "rgba(142,36,29,.12)" : "transparent",
                        borderColor: active ? "var(--accent-deep)" : "rgba(36,28,21,.28)",
                        color: active ? "var(--accent-deep)" : "var(--surface-paper-muted)",
                      }}
                    >
                      <Icon size={17} />
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
