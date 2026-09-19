"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { listRoleRequestsForReview, reviewRoleRequest } from "@/api/role-requests";
import { Alert, Button, Container, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Field, Select, Textarea } from "@/components/ui/form";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import { rejectionReasonLabel, roleCodeLabel } from "@/lib/labels";
import { routes } from "@/lib/routes";
import type { RejectionReasonCode, RoleRequest } from "@/types";

function describeReviewError(error: unknown): string {
  return error instanceof ApiError ? error.message : "Не удалось выполнить действие.";
}

// Draws in on hover/focus via `.decision-mark` (globals.css) — a privileged
// decision gets its own sign instead of the ordinary secondary-button
// highlight. `aria-hidden`: the button's own text already names the action.
function CheckMark() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 7.5L5.5 11L12 3" />
    </svg>
  );
}
function CrossMark() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2L12 12M12 2L2 12" />
    </svg>
  );
}

const REASONS: RejectionReasonCode[] = [
  "INSUFFICIENT_EVIDENCE",
  "NOT_RECOGNIZED",
  "DUPLICATE_REQUEST",
  "OTHER",
];

function RejectRow({
  request,
  onDone,
  onError,
}: {
  request: RoleRequest;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<RejectionReasonCode>("INSUFFICIENT_EVIDENCE");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" className="decision-mark is-reject w-32" onClick={() => setOpen(true)}>
        <CrossMark />
        Отклонить
      </Button>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <Field label="Причина" hideLabel>
        {(props) => (
          <Select
            {...props}
            value={reason}
            onChange={(event) => setReason(event.target.value as RejectionReasonCode)}
            disabled={busy}
          >
            {REASONS.map((code) => (
              <option key={code} value={code}>
                {rejectionReasonLabel[code]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {reason === "OTHER" ? (
        <Field label="Текст причины" hideLabel>
          {(props) => (
            <Textarea
              {...props}
              value={text}
              onChange={(event) => setText(event.target.value)}
              required
              disabled={busy}
            />
          )}
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="decision-mark is-reject"
          disabled={busy || (reason === "OTHER" && !text.trim())}
          onClick={async () => {
            setBusy(true);
            try {
              await reviewRoleRequest(request.id, {
                status: "REJECTED",
                reason_code: reason,
                reason_text: text || undefined,
              });
              onDone();
            } catch (caught) {
              onError(describeReviewError(caught));
              setBusy(false);
            }
          }}
        >
          <CrossMark />
          Подтвердить отказ
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

export default function ModerationRoleRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<RoleRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isModerator = user?.roles.includes("MODERATOR") ?? false;

  useEffect(() => {
    if (!loading && !isModerator) router.replace(routes.profile());
  }, [loading, isModerator, router]);

  useEffect(() => {
    if (!isModerator) return;
    listRoleRequestsForReview("PENDING")
      .then(setRequests)
      .catch(() => setError("Не удалось загрузить заявки."));
  }, [isModerator]);

  function refresh() {
    listRoleRequestsForReview("PENDING").then(setRequests);
  }

  if (loading || !isModerator) {
    return (
      <Container className="max-w-4xl py-14">
        <p className="text-sm text-[var(--muted)]">Загрузка…</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-4xl space-y-6 pt-10 pb-5">
      <PageHeader eyebrow="Модерация" title="Заявки на роль" />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {requests === null ? null : requests.length === 0 ? (
        <EmptyState title="Нет заявок на рассмотрении" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Заявитель</Th>
              <Th>Роль</Th>
              <Th>Обоснование</Th>
              <Th align="right">Действия</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <Td>
                  {request.applicant_name}
                  <div className="text-xs text-[var(--muted)]">{request.applicant_email}</div>
                </Td>
                <Td>{roleCodeLabel[request.role_code]}</Td>
                <Td className="max-w-xs">{request.justification}</Td>
                <Td align="right">
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="secondary"
                      className="decision-mark w-32"
                      onClick={async () => {
                        try {
                          await reviewRoleRequest(request.id, { status: "APPROVED" });
                          refresh();
                        } catch (caught) {
                          setError(describeReviewError(caught));
                        }
                      }}
                    >
                      <CheckMark />
                      Одобрить
                    </Button>
                    <RejectRow request={request} onDone={refresh} onError={setError} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
