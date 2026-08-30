import { Card, Container, Skeleton } from "@/components/ui";

export default function TournamentLoading() {
  return (
    <Container wide className="space-y-10 py-10">
      <div className="space-y-4 border-b border-[var(--border)] pb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Card className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}
