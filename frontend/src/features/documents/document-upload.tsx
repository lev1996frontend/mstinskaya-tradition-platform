"use client";

import { AlertTriangle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { attachRuleSetDocument, listRuleSetDocuments, removeRuleSetDocument } from "@/api/rules";
import { removeTournamentDocument } from "@/api/tournaments";
import { uploadDocument } from "@/api/media";
import { Alert, Badge, Button } from "@/components/ui";
import { Field, Input, Select } from "@/components/ui/form";
import { SHEET_TONE, SheetMark, formatOf } from "@/components/brand/sheet-marks";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { documentType } from "@/lib/labels";
import type { MediaUploadResponse, RuleSetDocument, TournamentDocument } from "@/types";

/**
 * Upload a file, then attach it — two server calls on purpose, mirroring the
 * backend's own seam: storage never parses a file and intake never stores
 * one, so "upload" and "attach" cannot be one request.
 *
 * The same uploaded file can legally be attached more than once (one свод
 * cited by two rule sets, say), so a server-reported `duplicate_of` is shown
 * as a fact, never as a reason to block attaching.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Загрузка доступна только тому, кто ведёт этот раздел.";
    return error.message;
  }
  return "Не удалось загрузить файл.";
}

function UploadForm<TCreated>({
  accept,
  typeOptions,
  onAttach,
  onAttached,
}: {
  /** File-picker filter — `.docx,.xlsx` for tournaments, `.docx` only for rules. */
  accept: string;
  /** Shown as a "Тип документа" select when given; omitted where there is no type (rules). */
  typeOptions?: { value: string; label: string }[];
  onAttach: (input: { title: string; media_file_id: string; type?: string }) => Promise<TCreated>;
  onAttached: (created: TCreated) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<MediaUploadResponse | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(typeOptions?.[0]?.value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(selected: File) {
    setError(null);
    setBusy(true);
    try {
      const result = await uploadDocument(selected);
      setFile(selected);
      setUploaded(result);
      setTitle((current) => current || selected.name.replace(/\.(docx|xlsx)$/i, ""));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    if (!uploaded) return;
    setBusy(true);
    setError(null);
    try {
      const created = await onAttach({
        title: title.trim(),
        media_file_id: uploaded.id,
        ...(typeOptions ? { type } : {}),
      });
      onAttached(created);
      setFile(null);
      setUploaded(null);
      setTitle("");
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          icon={<Upload className="size-3.5" strokeWidth={2.25} />}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy && !uploaded ? "Загружаем…" : "Выбрать файл"}
        </Button>
        {file ? <span className="truncate text-sm text-[var(--muted)]">{file.name}</span> : null}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            // Cleared before the request so picking the same file twice in a
            // row still fires a change event.
            event.target.value = "";
            if (selected) void handleFile(selected);
          }}
        />
      </div>

      {uploaded?.duplicate_of ? (
        <p className="text-xs text-[var(--muted)]">
          Этот файл уже загружен — используется существующая копия.
        </p>
      ) : null}

      {uploaded ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Название">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Положение о турнире"
                />
              )}
            </Field>
          </div>
          {typeOptions ? (
            <div className="min-w-40">
              <Field label="Тип">
                {(fieldProps) => (
                  <Select {...fieldProps} value={type} onChange={(event) => setType(event.target.value)}>
                    {typeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}
          {/* Default (md) size, not `sm`: `sm`'s padding is shorter than the
              Input/Select next to it, so the button read as visibly smaller
              than its own row instead of sitting level with it. */}
          <Button
            type="button"
            disabled={busy || title.trim().length < 2}
            onClick={() => void attach()}
          >
            {busy ? "Прикрепляем…" : "Прикрепить"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <Alert tone="danger">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2} />
            {error}
          </span>
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * One row of an attached document: the format mark, the title, a type badge
 * when there is one, and — for whoever can manage this page — a way to take
 * it off without deleting it.
 */
function DocumentRow({
  href,
  title,
  badge,
  onRemove,
  removing,
}: {
  href: string;
  title: string;
  badge?: React.ReactNode;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        // `--tone` is the format's own colour, same as the entry-list blanks
        // (`BlankLink` in `participant-import-panel.tsx`) — a hover cue the
        // icon answers with via `group-hover`, not a permanent tint.
        style={{ "--tone": SHEET_TONE[formatOf(href)] } as React.CSSProperties}
        className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        {/* The mark says what will open when this is clicked — a spreadsheet
            or a document — which the title alone leaves unsaid. */}
        <span className="flex min-w-0 items-center gap-2.5">
          <SheetMark
            name={href}
            size={18}
            className="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--tone)]"
          />
          <span className="truncate font-medium">{title}</span>
        </span>
        {badge}
      </a>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={removing}
          aria-label={`Снять «${title}» со страницы`}
          onClick={onRemove}
          icon={<X className="size-3.5" strokeWidth={2.25} />}
        />
      ) : null}
    </li>
  );
}

/**
 * The tournament page's own "Документы" panel: the existing public list,
 * plus a remove cross for whoever is signed in.
 *
 * There is deliberately no upload form here any more — every tournament
 * already points at exactly one ruleset edition (`tournament.ruleset_id`),
 * and that edition's own Word file lives and is edited only on its own
 * `/rules/{id}` page. A tournament document (положение and the like) used to
 * be attachable right here too, but the product decision this session was to
 * remove that entirely rather than let two different upload affordances sit
 * under one "Документы" heading. That leaves a real, known gap: there is
 * currently no attach point anywhere for a tournament document after the
 * tournament is created (the creation wizard has no documents step either) —
 * flagged here rather than silently left findable only by reading the git
 * history. Reading the list stays open to anyone; the server, not this
 * component, is what actually gates removing.
 */
export function TournamentDocumentsPanel({
  tournamentId,
  initialDocuments,
  label,
}: {
  tournamentId: string;
  initialDocuments: TournamentDocument[];
  /** The section caption ("Документы турнира"), rendered by this component
   *  rather than a sibling `<p>` in the page above it, so it can sit directly
   *  above whichever content actually renders (the list, or the empty-state
   *  sentence) — same "caption above content" shape as the "Регламент" block
   *  beside it. */
  label?: string;
}) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState(initialDocuments);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = Boolean(user);

  async function remove(documentId: string) {
    setRemovingId(documentId);
    setError(null);
    try {
      await removeTournamentDocument(tournamentId, documentId);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {/* Always its own line above the content, never inline with the empty-
         state sentence — that inline version (an earlier pass at this,
         trying to save vertical space) read as a stray fragment of text
         bolted onto the wrong line rather than a caption, once the row above
         this block ("Регламент") became compact too. Consistency with that
         row's own caption-above-content shape matters more here than saving
         a few px. */}
      {label ? <p className="record-label text-[var(--chrome-muted)]">{label}</p> : null}
      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              href={document.file_url}
              title={document.title}
              badge={<Badge>{documentType[document.type] ?? document.type}</Badge>}
              onRemove={canManage ? () => void remove(document.id) : undefined}
              removing={removingId === document.id}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)]">Документы к этому турниру ещё не приложены.</p>
      )}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

/**
 * The rules edition page's own "Документы" panel — same shape as the
 * tournament one (public list, gated remove/upload), minus a type selector
 * (rules documents have no type) and restricted to `.docx`: a регламент is
 * edited and versioned, and a spreadsheet is not that.
 */
export function RuleSetDocumentsPanel({
  ruleSetId,
  initialDocuments,
}: {
  ruleSetId: string;
  initialDocuments: RuleSetDocument[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The backend requires INSTRUCTOR/ADMIN to attach or remove — this is a UI
  // hint only, matching that server rule, which is the real gate. Reading the
  // list stays open to anyone, same as the tournament panel above.
  const canManage = user?.roles.some((role) => role === "INSTRUCTOR" || role === "ADMIN") ?? false;

  async function remove(documentId: string) {
    setRemovingId(documentId);
    setError(null);
    try {
      await removeRuleSetDocument(ruleSetId, documentId);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              href={document.url}
              title={document.title}
              onRemove={canManage ? () => void remove(document.id) : undefined}
              removing={removingId === document.id}
            />
          ))}
        </ul>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {canManage ? (
        <UploadForm
          accept=".docx"
          onAttach={({ title, media_file_id }) => attachRuleSetDocument(ruleSetId, { title, media_file_id })}
          onAttached={(created) => {
            setDocuments((current) => [...current, created]);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Re-exported so a server component can fetch the initial list itself. */
export { listRuleSetDocuments };
