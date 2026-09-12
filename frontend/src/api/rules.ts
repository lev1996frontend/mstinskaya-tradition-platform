import { apiListOrEmpty, apiRequest } from "@/lib/api";
import type { RuleSetDocument } from "@/types";

/**
 * Its own file rather than folded into `catalog.ts`: everything there is a
 * plain read across several domains, while a rule set's document is a write
 * as much as a read — attach and remove need the same authority check the
 * organizer's own tournament documents do.
 */

export const listRuleSetDocuments = (ruleSetId: string) =>
  apiListOrEmpty<RuleSetDocument>(`/api/v1/rulesets/${ruleSetId}/documents`);

/** Attach an uploaded Word file to this edition as the text it was published as. */
export const attachRuleSetDocument = (ruleSetId: string, body: { title: string; media_file_id: string }) =>
  apiRequest<RuleSetDocument>(`/api/v1/rulesets/${ruleSetId}/documents`, {
    method: "POST",
    body,
  });

/**
 * Take the file off this edition's page. Not a delete: an old edition may
 * already be cited or handed out, so the bytes and the download link stay live.
 */
export const removeRuleSetDocument = (ruleSetId: string, documentId: string) =>
  apiRequest<void>(`/api/v1/rulesets/${ruleSetId}/documents/${documentId}`, {
    method: "DELETE",
  });
