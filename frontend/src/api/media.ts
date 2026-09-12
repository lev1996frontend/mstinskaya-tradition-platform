import { apiUpload } from "@/lib/api";
import type { MediaUploadResponse } from "@/types";

/**
 * Upload one file into the platform's own storage.
 *
 * Shared between tournament documents and rules documents rather than
 * duplicated per domain: both attach whatever `media_file_id` this hands
 * back, and neither needs to know how or where the bytes are kept.
 */
export const uploadDocument = (file: File) =>
  apiUpload<MediaUploadResponse>("/api/v1/media/uploads", file);
