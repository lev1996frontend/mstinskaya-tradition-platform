/** Wire types mirroring the backend's `role_requests` schemas. */

export type RoleCode = "INSTRUCTOR" | "ORGANIZER" | "JUDGE" | "MODERATOR";
export type RoleRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RejectionReasonCode =
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_RECOGNIZED"
  | "DUPLICATE_REQUEST"
  | "OTHER";

export interface RoleRequest {
  id: string;
  user_id: string;
  applicant_email: string;
  applicant_name: string;
  role_code: RoleCode;
  status: RoleRequestStatus;
  justification: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason_code: RejectionReasonCode | null;
  rejection_reason_text: string | null;
  created_at: string;
  updated_at: string;
}
