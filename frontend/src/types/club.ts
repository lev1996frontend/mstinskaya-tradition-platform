/**
 * Wire types mirroring the FastAPI response models for clubs.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

export interface Club {
  id: string;
  name: string;
  description: string | null;
  country: string | null;
  city: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_active: boolean;
}
