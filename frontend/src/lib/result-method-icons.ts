import {
  Ban,
  Gavel,
  Hand,
  LogOut,
  Swords,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ResultMethod } from "@/types";

/** One icon per result method, shared between the match list and the result
 *  dialog's method picker so the outcome reads at a glance instead of as
 *  interchangeable text.
 *
 *  ROUND_WINS / DISARM come from the соступ engine (won on round count, or by
 *  the unarmed fighter's disarm); PIN_AND_FINISH is the «трое на трое»
 *  decision. */
export const RESULT_METHOD_ICONS: Record<ResultMethod, LucideIcon> = {
  JUDGE_DECISION: Gavel,
  ROUND_WINS: Swords,
  DISARM: Hand,
  PIN_AND_FINISH: Users,
  WITHDRAWAL: LogOut,
  DISQUALIFICATION: Ban,
  NO_SHOW: UserX,
};
