import type { Metadata } from "next";

import { getBoutRules } from "@/api/tournaments";
import { Container, PageHeader } from "@/components/ui";
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";

export const metadata: Metadata = {
  title: "Снаряжение",
  description: "Опись разрядов лота традиции и обязательного комплекта экипировки.",
};

/** `?exhibit=N` deep-links here from the homepage Hero's "опись" grid
 *  (`EquipmentPlate` in `features/home/hero-clash.tsx`) — read server-side
 *  and passed down as `GearArchive`'s initial slide index, rather than the
 *  client reading it via `useSearchParams()` (which would need a `Suspense`
 *  boundary to avoid a prerender build failure). Out-of-range or missing
 *  values fall back to `GearArchive`'s own default (slide 0). */
function parseExhibitIndex(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= EQUIPMENT_ITEMS.length) return undefined;
  return parsed;
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [boutRules, params] = await Promise.all([getBoutRules(), searchParams]);
  const initialExhibitIndex = parseExhibitIndex(params.exhibit);

  return (
    <>
      <Container className="py-10">
        <PageHeader
          eyebrow="Экипировка"
          title="Снаряжение"
          description="Четыре разряда лота традиции и девять предметов обязательного комплекта, которые боец носит независимо от выбранного разряда."
        />
      </Container>

      <Equipment rules={boutRules} />
      <GearArchive initialIndex={initialExhibitIndex} />
    </>
  );
}
