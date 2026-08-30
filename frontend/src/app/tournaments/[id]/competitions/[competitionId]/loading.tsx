import { Card, Container, Skeleton } from "@/components/ui";

export default function CompetitionLoading() {
  return (
    <Container wide className="space-y-8 py-10">
      <div className="space-y-4 border-b border-[var(--border)] pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-80 max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="space-y-2 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </Card>
        ))}
      </div>

      <div className="flex gap-4 border-b border-[var(--border)] pb-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-20" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="space-y-3 p-4">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
            </div>
            <Skeleton className="h-4 w-full" />
          </Card>
        ))}
      </div>
    </Container>
  );
}
