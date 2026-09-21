import { apiRequest } from "@/lib/api";
import type { RejectionReasonCode, RoleCode, RoleRequest, RoleRequestStatus } from "@/types";

export const createRoleRequest = (body: { role_code: RoleCode; justification: string }) =>
  apiRequest<RoleRequest>("/api/v1/role-requests", { method: "POST", body });

export const listMyRoleRequests = () => apiRequest<RoleRequest[]>("/api/v1/role-requests/me");

export const withdrawRoleRequest = (id: string) =>
  apiRequest<void>(`/api/v1/role-requests/${id}`, { method: "DELETE" });

export const listRoleRequestsForReview = (status: RoleRequestStatus = "PENDING") =>
  apiRequest<RoleRequest[]>(`/api/v1/role-requests?status=${status}`);

export const reviewRoleRequest = (
  id: string,
  body:
    | { status: "APPROVED" }
    | { status: "REJECTED"; reason_code: RejectionReasonCode; reason_text?: string },
) => apiRequest<RoleRequest>(`/api/v1/role-requests/${id}`, { method: "PATCH", body });
