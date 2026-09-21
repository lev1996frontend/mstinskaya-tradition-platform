"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { listRoleRequestsForReview, reviewRoleRequest } from "@/api/role-requests";
import { Alert, Button, Container, EmptyState, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { Field, Select, Textarea } from "@/components/ui/form";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { labelOf, rejectionReasonLabel, roleCodeLabel, roleRequestErrorLabel, roleRequestStatus } from "@/lib/labels";
import { routes } from "@/lib/routes";
import type { RejectionReasonCode, RoleRequest, RoleRequestStatus } from "@/types";

const STATUS_TABS: RoleRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];

function describeReviewError(error: unknown): string {
  if (error instanceof ApiError) {
    return roleRequestErrorLabel[error.message] ?? "Не удалось выполнить действие.";
  }
  return "Не удалось выполнить действие.";
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
                {labelOf(rejectionReasonLabel, code)}
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
  const [statusTab, setStatusTab] = useState<RoleRequestStatus>("PENDING");
  // Keyed by the tab it was fetched for, rather than reset to `null`
  // synchronously on tab change (react-hooks/set-state-in-effect forbids a
  // bare setState at the top of an effect body) — `requests` below derives
  // "still loading this tab" by comparing `loadedFor` to `statusTab`.
  const [loaded, setLoaded] = useState<{ tab: RoleRequestStatus; list: RoleRequest[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isModerator = user?.roles.includes("MODERATOR") ?? false;

  useEffect(() => {
    if (!loading && !isModerator) router.replace(routes.profile());
  }, [loading, isModerator, router]);

  useEffect(() => {
    if (!isModerator) return;
    let cancelled = false;
    listRoleRequestsForReview(statusTab)
      .then((list) => {
        if (!cancelled) setLoaded({ tab: statusTab, list });
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить заявки.");
      });
    return () => {
      cancelled = true;
    };
  }, [isModerator, statusTab]);

  const requests = loaded?.tab === statusTab ? loaded.list : null;

  function refresh() {
    listRoleRequestsForReview(statusTab)
      .then((list) => setLoaded({ tab: statusTab, list }))
      .catch(() => setError("Не удалось обновить список заявок."));
  }

  // A moderator's own request can't be reviewed by them (backend returns
  // 403) — exclude it from the PENDING queue rather than show buttons that
  // always fail. History tabs (APPROVED/REJECTED) show every request.
  const reviewableRequests =
    statusTab === "PENDING" ? (requests?.filter((request) => request.user_id !== user?.id) ?? null) : requests;

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

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab}
            variant={tab === statusTab ? "primary" : "secondary"}
            onClick={() => setStatusTab(tab)}
          >
            {roleRequestStatus[tab].label}
          </Button>
        ))}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {reviewableRequests === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : reviewableRequests.length === 0 ? (
        <EmptyState title="Нет заявок" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Заявитель</Th>
              <Th>Роль</Th>
              <Th>Обоснование</Th>
              <Th>Подана</Th>
              {statusTab === "PENDING" ? <Th align="right">Действия</Th> : <Th>Решение</Th>}
            </tr>
          </thead>
          <tbody>
            {reviewableRequests.map((request) => (
              <tr key={request.id}>
                <Td>
                  {request.applicant_name}
                  <div className="text-xs text-[var(--muted)]">{request.applicant_email}</div>
                </Td>
                <Td>{labelOf(roleCodeLabel, request.role_code)}</Td>
                <Td className="max-w-xs">{request.justification}</Td>
                <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                  {formatDateTime(request.created_at)}
                </Td>
                {statusTab === "PENDING" ? (
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
                ) : (
                  <Td className="text-xs text-[var(--muted)]">
                    {request.reviewed_at ? formatDateTime(request.reviewed_at) : "—"}
                    {request.status === "REJECTED" ? (
                      <div>
                        {request.rejection_reason_code === "OTHER"
                          ? request.rejection_reason_text
                          : labelOf(rejectionReasonLabel, request.rejection_reason_code)}
                      </div>
                    ) : null}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
