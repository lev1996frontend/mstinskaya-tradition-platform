/**
 * Wire types mirroring the FastAPI response models for media/document
 * uploads — the generic storage layer other domains attach files through.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

/**
 * What one call to `POST /media/uploads` produced. `media_file_id` on an
 * attach request is this response's `id` — the upload and the attach are two
 * separate calls because storage never parses and intake never stores.
 */
export interface MediaUploadResponse {
  id: string;
  url: string;
  original_name: string;
  size: number | null;
  mime_type: string | null;
  /** Set when identical bytes were already stored; `id` above is that file's. */
  duplicate_of: string | null;
}
