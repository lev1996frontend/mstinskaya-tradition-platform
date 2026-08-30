import { Alert } from "@/components/ui";
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
