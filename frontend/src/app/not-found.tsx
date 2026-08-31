import { Seal } from "@/components/brand/seal";
import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="ledger-lines max-w-lg py-24 text-center">
      <div className="mx-auto mb-5 w-fit">
        <Seal size={52} tone="muted">
          <span aria-hidden="true" className="font-record text-sm leading-none">
            404
          </span>
        </Seal>
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Запись не найдена</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
        Возможно, ссылка устарела или запись была удалена из реестра.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/">На главную</ButtonLink>
      </div>
    </Container>
  );
}
