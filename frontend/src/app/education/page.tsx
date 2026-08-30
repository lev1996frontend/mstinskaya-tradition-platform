import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { listCoursesWithStatus } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { courseLevel, courseType, labelOf } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Обучение",
  description: "Курсы Мстинской традиции для спортсменов, инструкторов и судей.",
};

/**
 * Courses keep a card grid — they are self-contained items of roughly equal
 * weight, which is the one case where a grid is the honest form. What changed
 * is the card: a numbered course sheet with the index stamped in the margin,
 * the title in the editorial face, and the type/level struck as labels along
 * the bottom rule instead of floating as pills under the heading.
 */
export default async function EducationPage() {
  const { items: courses, offline } = await listCoursesWithStatus();
  const published = courses.filter((course) => course.is_published);

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Развитие"
        title="Обучение"
        description="Курсы разбиты на модули и уроки. Прогресс сохраняется за каждым учеником."
        actions={
          published.length > 0 ? (
            <span className="record-label self-end text-[var(--muted)]">
              {String(published.length).padStart(2, "0")} курсов
            </span>
          ) : undefined
        }
      />

      {published.length === 0 ? (
        <div className="space-y-4">
          {offline ? <ApiOfflineNotice /> : null}
          <EmptyState
            title="Опубликованных курсов пока нет"
            description={
              courses.length > 0
                ? "Есть черновики курсов — они станут видны после публикации."
                : "Здесь появятся курсы для спортсменов, инструкторов и судей."
            }
            icon={<GraduationCap className="size-5" strokeWidth={1.75} />}
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {published.map((course, index) => (
            <Card
              as="li"
              key={course.id}
              className="flex flex-col p-5 transition-colors hover:border-[var(--accent)]"
            >
              <div className="flex items-start gap-4">
                <span className="font-record shrink-0 pt-1 text-xs text-[var(--muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display min-w-0 text-lg font-semibold leading-snug tracking-tight">
                  {course.title}
                </h2>
              </div>

              {course.description ? (
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-[var(--muted)]">
                  {course.description}
                </p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                <Badge tone="info">{labelOf(courseType, course.type)}</Badge>
                <Badge>{labelOf(courseLevel, course.level)}</Badge>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </Container>
  );
}
