import { apiListOrEmpty, apiRequestOrNull } from "@/lib/api";
import type { Athlete, Club, Course, Rule, RuleSection, RuleSet } from "@/types";

export const listAthletes = () => apiListOrEmpty<Athlete>("/api/v1/athletes");

export const getAthlete = (id: string) => apiRequestOrNull<Athlete>(`/api/v1/athletes/${id}`);

export const listClubs = () => apiListOrEmpty<Club>("/api/v1/clubs");

export const listRuleSets = () => apiListOrEmpty<RuleSet>("/api/v1/rulesets");

export const listRuleSections = (ruleSetId: string) =>
  apiListOrEmpty<RuleSection>(`/api/v1/rulesets/${ruleSetId}/sections`);

export const listRules = (sectionId: string) =>
  apiListOrEmpty<Rule>(`/api/v1/sections/${sectionId}/rules`);

export const listCourses = () => apiListOrEmpty<Course>("/api/v1/courses");

export const getCourse = (id: string) => apiRequestOrNull<Course>(`/api/v1/courses/${id}`);
