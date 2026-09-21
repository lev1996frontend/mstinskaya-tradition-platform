import type { Metadata } from "next";
import type { ReactNode } from "react";

// `page.tsx` here is a client component (needs `useAuth()`), which can't
// itself export `metadata` — the App Router still reads it from a layout at
// the same route, so the tab title doesn't fall back to the root default.
export const metadata: Metadata = {
  title: "Личный кабинет",
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
