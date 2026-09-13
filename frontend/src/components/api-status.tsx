import type { ReactNode } from "react";

import { Alert, EmptyState } from "@/components/ui";
import { API_BASE_URL } from "@/lib/config";

/** Shown only when a request to the backend actually failed to connect. */
export function ApiOfflineNotice() {
  return (
    <Alert tone="warning" title="Нет связи с API">
      <p>
        Не удалось получить данные с <code className="font-mono text-xs">{API_BASE_URL}</code>.
        Проверьте, что бэкенд запущен и доступен, затем обновите страницу.
      </p>
    </Alert>
  );
}

/**
 * A catalog list page's empty state, with the offline notice above it when
 * the list is empty *because* the backend didn't answer rather than because
 * there's genuinely nothing yet — every top-level list page (athletes, clubs,
 * education, rules, …) rendered this same pairing separately before.
 */
export function CatalogEmptyState({
  offline,
  title,
  description,
  icon,
}: {
  offline: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {offline ? <ApiOfflineNotice /> : null}
      <EmptyState title={title} description={description} icon={icon} />
    </div>
  );
}
