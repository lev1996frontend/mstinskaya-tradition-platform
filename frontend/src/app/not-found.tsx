import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="max-w-lg py-24 text-center">
      <p className="font-record text-3xl text-[var(--accent)]">404</p>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
        Страница не найдена
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Возможно, ссылка устарела или запись была удалена.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/">На главную</ButtonLink>
      </div>
    </Container>
  );
}
