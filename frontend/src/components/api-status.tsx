import { Alert } from "@/components/ui";
import { API_BASE_URL } from "@/lib/config";

/**
 * Shown when a page renders with no data at all — usually the backend is not
 * running. Distinguishing "empty" from "unreachable" saves a lot of guessing
 * during local development.
 */
export function ApiOfflineNotice() {
  return (
    <Alert tone="warning" title="Нет связи с API">
      <p>
        Не удалось получить данные с <code className="font-mono text-xs">{API_BASE_URL}</code>.
        Запустите бэкенд командой <code className="font-mono text-xs">uvicorn app.main:app --reload</code>{" "}
        из каталога <code className="font-mono text-xs">backend/</code> и обновите страницу.
      </p>
    </Alert>
  );
}
