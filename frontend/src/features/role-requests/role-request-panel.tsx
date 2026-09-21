"use client";

import { useEffect, useState } from "react";

import { createRoleRequest, listMyRoleRequests, withdrawRoleRequest } from "@/api/role-requests";
import { Alert, Badge, Button, Card, Skeleton } from "@/components/ui";
import { Field, Select, Textarea } from "@/components/ui/form";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { labelOf, rejectionReasonLabel, roleCodeLabel, roleRequestErrorLabel, roleRequestStatus } from "@/lib/labels";
import type { RoleCode, RoleRequest } from "@/types";

// MODERATOR is deliberately excluded — it grants access to this review
// queue, so a new moderator may only be appointed by an existing one, not
// requested self-service. Mirrors ROLE_CODES in
// backend/app/modules/role_requests/models/role_request.py — nothing
// enforces the two stay in sync, so change both together.
const REQUESTABLE_ROLES: RoleCode[] = ["INSTRUCTOR", "ORGANIZER", "JUDGE"];

export function RoleRequestPanel({ myRoles }: { myRoles: string[] }) {
  const [requests, setRequests] = useState<RoleRequest[] | null>(null);
  const [roleCode, setRoleCode] = useState<RoleCode>("INSTRUCTOR");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyRoleRequests()
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingRoles = new Set(requests?.filter((r) => r.status === "PENDING").map((r) => r.role_code));
  const availableRoles = REQUESTABLE_ROLES.filter(
    (role) => !myRoles.includes(role) && !pendingRoles.has(role),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createRoleRequest({ role_code: roleCode, justification });
      setRequests((prev) => [created, ...(prev ?? [])]);
      setJustification("");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (roleRequestErrorLabel[caught.message] ?? "Не удалось отправить заявку.")
          : "Не удалось отправить заявку.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw(id: string) {
    setWithdrawingId(id);
    setError(null);
    try {
      await withdrawRoleRequest(id);
      setRequests((prev) => prev?.filter((request) => request.id !== id) ?? prev);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (roleRequestErrorLabel[caught.message] ?? "Не удалось отозвать заявку.")
          : "Не удалось отозвать заявку.",
      );
    } finally {
      setWithdrawingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {availableRoles.length > 0 ? (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Роль">
              {(props) => (
                <Select
                  {...props}
                  value={roleCode}
                  onChange={(event) => setRoleCode(event.target.value as RoleCode)}
                  disabled={busy}
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {labelOf(roleCodeLabel, role)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Обоснование" hint="Например: клуб, стаж, ссылка на подтверждение.">
              {(props) => (
                <Textarea
                  {...props}
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  required
                  minLength={1}
                  disabled={busy}
                />
              )}
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Отправка…" : "Подать заявку"}
            </Button>
          </form>
        </Card>
      ) : null}

      {requests === null ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : requests.length === 0 ? null : (
        <div className="space-y-3">
          {requests.map((request) => {
            const status = roleRequestStatus[request.status];
            return (
              <Card key={request.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{labelOf(roleCodeLabel, request.role_code)}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <span className="text-xs text-[var(--muted)]">{formatDateTime(request.created_at)}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">{request.justification}</p>
                {request.status === "REJECTED" ? (
                  <p className="text-sm text-[var(--danger)]">
                    Причина:{" "}
                    {request.rejection_reason_code === "OTHER"
                      ? request.rejection_reason_text
                      : labelOf(rejectionReasonLabel, request.rejection_reason_code)}
                  </p>
                ) : null}
                {request.status === "PENDING" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={withdrawingId === request.id}
                    onClick={() => handleWithdraw(request.id)}
                  >
                    {withdrawingId === request.id ? "Отзыв…" : "Отозвать заявку"}
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
