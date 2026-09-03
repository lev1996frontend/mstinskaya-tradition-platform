"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Ported verbatim from the design handoff — these 4 statements were already
 * checked against the confirmed real ruleset (buza.su primary source, see
 * docs/domain-model.md) before the handoff was written, not invented here.
 */
const QUIZ = [
  {
    text: "Продолжать бой после команды судьи «стой».",
    allowed: false,
    explain: "Команда судьи останавливает бой немедленно — любое действие после неё разбирается отдельно.",
  },
  {
    text: "Борьба в захвате с выведением из равновесия.",
    allowed: true,
    explain: "Работа в захвате — основа традиции: выведение из равновесия входит в разряд без оружия.",
  },
  {
    text: "Удар в затылок и по позвоночнику.",
    allowed: false,
    explain: "Закрытые зоны исключены в любом разряде, независимо от снаряда.",
  },
  {
    text: "Выход с макетом ножа без маски и рукавиц.",
    allowed: false,
    explain: "Допуск к бою даётся только в полном снаряжении, проверяет судейская тройка.",
  },
];

export function RulesQuiz() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);

  const question = QUIZ[index];
  const answered = picked !== null;
  const correct = answered && picked === question.allowed;

  function answer(said: boolean) {
    if (picked !== null) return;
    const right = said === question.allowed;
    setPicked(said);
    setScore((s) => s + (right ? 1 : 0));
    setMarks((m) => [...m, right].slice(-8));
  }

  function next() {
    setIndex((i) => (i + 1) % QUIZ.length);
    setPicked(null);
  }

  return (
    <section id="pravila" className="border-b border-[var(--border)] bg-[var(--background-deep)]">
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 sm:px-10 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-10 border-b border-[var(--border)] pb-5">
          <div>
            <span className="record-label text-[var(--gold)]">Регламент</span>
            <h2 className="font-display m-0 mt-3.5 text-[3rem] font-bold tracking-tight">Что по правилам?</h2>
          </div>
          <span className="record-label max-w-sm text-right leading-relaxed text-[var(--text-4)]">
            Образец вопросов — наполняется из действующей редакции
          </span>
        </div>

        <div className="mt-10 grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="border border-[var(--border)] bg-[var(--surface-muted)] p-10 sm:p-[42px]">
            <span className="record-label text-[var(--text-4)]">
              Вопрос {String(index + 1).padStart(2, "0")} из {String(QUIZ.length).padStart(2, "0")}
            </span>
            <p key={index} className="step-in font-display mt-5 text-[2.125rem] font-semibold leading-[1.22] tracking-tight">
              {question.text}
            </p>

            {!answered ? (
              <div className="mt-8 flex gap-3.5">
                <button
                  type="button"
                  onClick={() => answer(true)}
                  className="flex-1 border border-[var(--iron)] bg-transparent px-5 py-5 font-record text-xs uppercase tracking-[0.18em] transition-colors hover:border-[var(--gold)] hover:bg-[var(--surface)]"
                >
                  Разрешено
                </button>
                <button
                  type="button"
                  onClick={() => answer(false)}
                  className="flex-1 border border-[var(--iron)] bg-transparent px-5 py-5 font-record text-xs uppercase tracking-[0.18em] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface)]"
                >
                  Запрещено
                </button>
              </div>
            ) : (
              <div className="step-in mt-8 border-t border-[var(--border)] pt-6">
                <span className="record-label" style={{ color: correct ? "var(--gold)" : "var(--accent)" }}>
                  {correct ? "Верно" : "Неверно"}
                </span>
                <p className="mt-3.5 max-w-xl text-base leading-relaxed text-[var(--muted)]">{question.explain}</p>
                <button
                  type="button"
                  onClick={next}
                  className="mt-6 bg-[var(--foreground)] px-6 py-3.5 font-record text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--background)] transition-opacity hover:opacity-90"
                >
                  Следующий вопрос →
                </button>
              </div>
            )}
          </div>

          <aside className="border border-[var(--border)] bg-[var(--surface-muted)] p-6">
            <span className="record-label text-[var(--text-4)]">Ваш счёт</span>
            <p className="font-record mt-3.5 text-[2.75rem] leading-none text-[var(--foreground)]">
              {String(score).padStart(2, "0")}
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {marks.map((ok, i) => (
                <span key={i} aria-hidden="true" className="size-3" style={{ background: ok ? "var(--gold)" : "var(--accent)" }} />
              ))}
            </div>
            <p className="mt-6 text-[0.8125rem] leading-relaxed text-[var(--text-4)]">
              Судейская аттестация идёт по той же логике, но по полной редакции правил и с разбором видео.
            </p>
            <Link
              href="/rules"
              className="record-label mt-4 inline-block text-[var(--accent)] hover:underline"
            >
              Полный регламент →
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
