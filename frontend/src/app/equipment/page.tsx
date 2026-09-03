import type { Metadata } from "next";

import { getBoutRules } from "@/api/tournaments";
import { Container, PageHeader } from "@/components/ui";
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";

export const metadata: Metadata = {
  title: "Снаряжение",
  description: "Опись разрядов лота традиции и обязательного комплекта экипировки.",
};

export default async function EquipmentPage() {
  const boutRules = await getBoutRules();

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
      <GearArchive />
    </>
  );
}
