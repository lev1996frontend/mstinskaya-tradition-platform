/**
 * The nine items a fighter wears regardless of drawn weapon category — the
 * single source of truth for this list. Ported originally from the design
 * canvas's "опись обязательного снаряжения" (see `hero-clash.tsx`'s
 * `EquipmentPlate`, which shows all nine at once as a grid) and now also
 * used by `gear-archive.tsx` (which shows them one at a time as archive
 * exhibits). Keeping one array means a wording change only has to happen
 * once.
 */
const EXHIBIT_IMAGE_BASE = "/references/exhibits";

export const EQUIPMENT_ITEMS: { title: string; desc: string; subtitle: string; image?: string }[] = [
  { title: "Маска", desc: "Сетка на всё лицо и мягкий каркас", subtitle: "Защитный шлем", image: `${EXHIBIT_IMAGE_BASE}/01_helmet.png` },
  { title: "Горжет", desc: "Крепится к маске, закрывает шею", subtitle: "Защита шеи", image: `${EXHIBIT_IMAGE_BASE}/02_gorget.png` },
  { title: "Налокотники", desc: "Жёсткая вставка на сустав", subtitle: "Защита локтей", image: `${EXHIBIT_IMAGE_BASE}/03_elbow_guards.png` },
  { title: "Перчатки", desc: "Кевларовые или для ММА", subtitle: "Боевые перчатки", image: `${EXHIBIT_IMAGE_BASE}/04_mma_gloves.png` },
  { title: "Паховая защита", desc: "Протектор под шароварами", subtitle: "Протектор", image: `${EXHIBIT_IMAGE_BASE}/05_groin_guard.png` },
  { title: "Щитки", desc: "Закрывают голень от удара", subtitle: "Защита голени", image: `${EXHIBIT_IMAGE_BASE}/06_shin_guards.png` },
  { title: "Косоворотка", desc: "Или футболка — без иностранных надписей", subtitle: "Тренировочная одежда", image: `${EXHIBIT_IMAGE_BASE}/07_kosovorotka.png` },
  { title: "Опояска", desc: "Плетёный пояс традиционного кроя", subtitle: "Пояс", image: `${EXHIBIT_IMAGE_BASE}/08_opaska_sash.png` },
  { title: "Шаровары", desc: "Свободные традиционные штаны, не стесняют движение", subtitle: "Тренировочные штаны", image: `${EXHIBIT_IMAGE_BASE}/09_sharovary.png` },
];

/**
 * Breaks an item's own description into 1–2 short caption fragments for the
 * archive plate's technical bottom bar (e.g. "Сетка на всё лицо" / "мягкий
 * каркас"), mirroring how a museum placard splits a material note into
 * short lines. Splits on the first natural conjunction/comma already present
 * in the source text — never rewrites or invents a new fact, just re-breaks
 * the existing sentence.
 */
export function splitSpecCaption(desc: string): string[] {
  const andIndex = desc.indexOf(" и ");
  if (andIndex !== -1) {
    return [desc.slice(0, andIndex), desc.slice(andIndex + 3)];
  }
  const commaIndex = desc.indexOf(", ");
  if (commaIndex !== -1) {
    return [desc.slice(0, commaIndex), desc.slice(commaIndex + 2)];
  }
  return [desc];
}
