import { Card, Container, Skeleton } from "@/components/ui";

export default function TournamentsLoading() {
  return (
    <Container className="space-y-8 py-10">
      <div className="space-y-4 border-b border-[var(--border)] pb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-4 w-28" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-16 rounded-[var(--radius-pill)]" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="space-y-1.5 pt-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
