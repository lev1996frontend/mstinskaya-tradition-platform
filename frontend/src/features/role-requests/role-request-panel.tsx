"use client";

import { useEffect, useState } from "react";

import { createRoleRequest, listMyRoleRequests } from "@/api/role-requests";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { Field, Select, Textarea } from "@/components/ui/form";
import { ApiError } from "@/lib/api";
import { rejectionReasonLabel, roleCodeLabel, roleRequestStatus } from "@/lib/labels";
import type { RoleCode, RoleRequest } from "@/types";

const REQUESTABLE_ROLES: RoleCode[] = ["INSTRUCTOR", "ORGANIZER", "JUDGE", "MODERATOR"];

export function RoleRequestPanel({ myRoles }: { myRoles: string[] }) {
  const [requests, setRequests] = useState<RoleRequest[] | null>(null);
  const [roleCode, setRoleCode] = useState<RoleCode>("INSTRUCTOR");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listMyRoleRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
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
      setError(caught instanceof ApiError ? caught.message : "Не удалось отправить заявку.");
    } finally {
      setBusy(false);
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
                      {roleCodeLabel[role]}
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

      {requests === null ? null : requests.length === 0 ? null : (
        <div className="space-y-3">
          {requests.map((request) => {
            const status = roleRequestStatus[request.status];
            return (
              <Card key={request.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{roleCodeLabel[request.role_code]}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="text-sm text-[var(--muted)]">{request.justification}</p>
                {request.status === "REJECTED" ? (
                  <p className="text-sm text-[var(--danger)]">
                    Причина:{" "}
                    {request.rejection_reason_code === "OTHER"
                      ? request.rejection_reason_text
                      : rejectionReasonLabel[request.rejection_reason_code!]}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
