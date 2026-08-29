import type { Metadata } from "next";

import { listCourses } from "@/api/catalog";
import { ApiOfflineNotice } from "@/components/api-status";
import { Badge, Card, Container, EmptyState, PageHeader } from "@/components/ui";
import { courseLevel, courseType, labelOf } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Обучение",
  description: "Курсы Мстинской традиции для спортсменов, инструкторов и судей.",
};

export default async function EducationPage() {
  const courses = await listCourses();
  const published = courses.filter((course) => course.is_published);

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Развитие"
        title="Обучение"
        description="Курсы разбиты на модули и уроки. Прогресс сохраняется за каждым учеником."
      />

      {published.length === 0 ? (
        <div className="space-y-4">
          <ApiOfflineNotice />
          <EmptyState
            title="Опубликованных курсов пока нет"
            description={
              courses.length > 0
                ? "Есть черновики курсов — они станут видны после публикации."
                : undefined
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {published.map((course) => (
            <Card as="li" key={course.id} className="flex flex-col gap-2 p-5">
              <h2 className="font-semibold leading-snug">{course.title}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">{labelOf(courseType, course.type)}</Badge>
                <Badge>{labelOf(courseLevel, course.level)}</Badge>
              </div>
              {course.description ? (
                <p className="mt-1 line-clamp-4 text-sm text-[var(--muted)]">
                  {course.description}
                </p>
              ) : null}
            </Card>
          ))}
        </ul>
      )}
    </Container>
  );
}
