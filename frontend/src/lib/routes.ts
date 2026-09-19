/**
 * Central registry of internal Next.js navigation paths.
 *
 * The counterpart to `lib/config.ts` (which centralizes the backend API base
 * URL): this file is for the frontend's own route strings — the ones used in
 * `<Link href>`, `router.push`/`router.replace`, and `redirect()` calls. Do
 * not add backend `/api/v1/...` URLs here; those are built in `src/api/*.ts`
 * via `lib/config.ts` and are a separate, already-correct concern.
 */
export const routes = {
  home: () => "/",

  login: () => "/login",
  register: () => "/register",
  verifyEmail: () => "/verify-email",
  profile: () => "/profile",

  athletes: () => "/athletes",
  athlete: (id: string) => `/athletes/${id}`,

  clubs: () => "/clubs",

  tournaments: () => "/tournaments",
  tournamentNew: () => "/tournaments/new",
  tournament: (id: string) => `/tournaments/${id}`,
  competition: (tournamentId: string, competitionId: string) =>
    `/tournaments/${tournamentId}/competitions/${competitionId}`,

  rules: () => "/rules",
  ruleSet: (id: string) => `/rules/${id}`,

  education: () => "/education",
  equipment: () => "/equipment",

  moderationRoleRequests: () => "/moderation/role-requests",
};
