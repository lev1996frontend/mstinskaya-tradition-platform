/**
 * Wire types mirroring the FastAPI response models for education (courses).
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

export type CourseType = "GENERAL" | "ATHLETE" | "INSTRUCTOR" | "JUDGE";
export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface Course {
  id: string;
  title: string;
  description: string | null;
  type: CourseType;
  level: CourseLevel;
  thumbnail_url: string | null;
  is_published: boolean;
}
