/**
 * Deep-link from the hero's "опись" grid (`hero-clash.tsx`'s `EquipmentPlate`)
 * into "Архив экипировки" (`gear-archive.tsx`'s single-exhibit slider)
 * further down the page — two components with no shared parent state (the
 * hero is inside `HeroClashProvider`, the archive isn't), so a small
 * `window`-level custom event is the least-invasive way to connect them
 * without threading state through `page.tsx` (a server component).
 *
 * `selectExhibit` both dispatches the event and does the scroll — callers
 * don't need to know the section's id or the scroll mechanics, only the
 * `EQUIPMENT_ITEMS` index they want shown.
 */
export const GEAR_ARCHIVE_SELECT_EVENT = "gear-archive:select";

export function selectExhibit(index: number) {
  window.dispatchEvent(new CustomEvent<number>(GEAR_ARCHIVE_SELECT_EVENT, { detail: index }));
  document.getElementById("arhiv-ekipirovki")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
