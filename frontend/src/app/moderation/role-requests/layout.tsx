import type { Metadata } from "next";
import type { ReactNode } from "react";

// `page.tsx` here is a client component and can't export `metadata` itself
// — see the identical note in `app/profile/layout.tsx`.
export const metadata: Metadata = {
  title: "Модерация — заявки на роль",
};

export default function ModerationRoleRequestsLayout({ children }: { children: ReactNode }) {
  return children;
}
