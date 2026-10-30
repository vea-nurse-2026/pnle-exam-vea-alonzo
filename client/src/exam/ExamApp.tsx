import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../api.ts";
import { ExamResults, ExamRunner } from "../components/ExamScreens.tsx";
import { Badge, Button, Card, Checkbox, ErrorBox, Field, inputCls, Loading, Segmented } from "../components/ui.tsx";
import { ThemeMenu } from "./theme.tsx";
import { BOARD_ITEMS, createExam, deleteExam, loadBank, loadExams, saveExam, score, SECONDS_PER_ITEM, toSession, type Bank, type StoredExam } from "./engine.ts";

/** "#/exam/123" opens a saved exam; anything else is the home screen. */
function examIdFromHash(): number | null {
  const m = /^#\/exam\/(\d+)$/.exec(window.location.hash);
  return m ? Number(m[1]) : null;
}

export function ExamApp() {
  const [bank, setBank] = useState<Bank>();
  const [error, setError] = useState<string>();
  const [exams, setExams] = useState<StoredExam[]>(loadExams);
  const [openId, setOpenId] = useState<number | null>(examIdFromHash);

  useEffect(() => {
    loadBank().then(setBank, (e) => setError(e instanceof Error ? e.message : String(e)));
    const onHash = () => setOpenId(examIdFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Braces matter: newer Chrome returns a Promise from scrollTo, and an effect may only return a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [openId]);

  const open = (id: number | null) => {
    window.location.hash = id ? `/exam/${id}` : "";
  };
  const update = (exam: StoredExam) => setExams(saveExam(exam));

  const current = exams.find((e) => e.id === openId);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <button type="button" onClick={() => open(null)} className="flex items-center gap-2.5 text-left">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={44} height={44} className="size-11 shrink-0" />
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-slate-900">PNLE Practice Exams</span>
              <span className="block text-xs text-slate-500">Nurse Licensure Exam review</span>
            </span>
          </button>
          <div className="flex items-center gap-4">
            {bank && <span className="hidden text-xs text-slate-500 md:block">{bank.questions.length} questions · updated {formatDate(bank.publishedAt)}</span>}
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:py-8">
        {error ? (
          <ErrorBox message={error} />
        ) : !bank ? (
          <Loading />
        ) : current ? (
          <ExamScreen key={current.id} bank={bank} exam={current} onChange={update} onExit={() => open(null)} />
        ) : (
          <Home
            bank={bank}
            exams={exams}
            onStart={(exam) => {
              update(exam);
              open(exam.id);
            }}
            onOpen={open}
            onDelete={(id) => setExams(deleteExam(id))}
          />
        )}
        <p className="mt-10 text-center text-xs text-slate-400">Practice questions for review only. Scores are estimates, not official PRC ratings.</p>
      </main>
    </div>
  );
}

function ExamScreen({ bank, exam, onChange, onExit }: { bank: Bank; exam: StoredExam; onChange: (e: StoredExam) => void; onExit: () => void }) {
  const session = useMemo(() => toSession(bank, exam), [bank, exam]);
  if (!session.questions.length) return <ErrorBox message="The questions in this exam are no longer in the bank." />;

  if (exam.finishedAt) {
    return (
      <ExamResults
        session={session}
        back={
          <Button variant="primary" onClick={onExit}>
            New exam
          </Button>
        }
      />
    );
  }
  return (
    <ExamRunner
      session={session}
      onChoose={(questionId, choice) => {
        // Study mode reveals the answer right away, so the first choice is final.
        if (exam.mode === "study" && exam.answers[questionId] !== undefined) return;
        onChange({ ...exam, answers: { ...exam.answers, [questionId]: choice } });
      }}
      onSubmit={() => onChange({ ...exam, finishedAt: new Date().toISOString(), results: score(bank, exam) })}
    />
  );
}

function Home({
  bank,
  exams,
  onStart,
  onOpen,
  onDelete,
}: {
  bank: Bank;
  exams: StoredExam[];
  onStart: (exam: StoredExam) => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [mode, setMode] = useState<"exam" | "study">("exam");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState<number | "">("");
  const [error, setError] = useState<string>();
  const [showAll, setShowAll] = useState(false);

  const countFor = (id: number | "") => (id ? bank.questions.filter((q) => q.subjectId === id).length : bank.questions.length);
  const available = countFor(subjectId);
  const items = Math.min(count, available);
  const unfinished = exams.find((e) => !e.finishedAt);
  const history = exams.filter((e) => e.finishedAt);

  function start(opts: { subjectId: number | null; count: number; mode: "exam" | "study"; minutes: number | null; label: string }) {
    try {
      onStart(createExam(bank, opts));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!bank.questions.length) {
    return <ErrorBox message="No questions have been published yet. Check back soon!" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Practice for the Nurse Licensure Exam</h1>
        <p className="mt-1 text-sm text-slate-500">
          Board-style questions across the five Nursing Practice subjects. Passing on the PNLE takes a general average of 75% with no subject below 60%.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4.5v5h-1.5v-5h1.5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
          </svg>
          <span>
            No account needed. Your exams and results are saved only on this device, in this browser. Clearing your browser's cache or site data, or using private
            browsing, erases them, and another phone or browser starts fresh.
          </span>
        </p>
      </div>

      {unfinished && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
          <div className="text-sm text-teal-900">
            <p className="font-medium">You have an unfinished {unfinished.mode === "exam" ? "exam" : "study session"}</p>
            <p>
              {unfinished.label} · {Object.keys(unfinished.answers).length} of {unfinished.questionIds.length} answered · started {formatDate(unfinished.startedAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onDelete(unfinished.id)}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={() => onOpen(unfinished.id)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <Card title="Start a practice exam" className="self-start">
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Mode</p>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "exam", label: "Exam (timed)" },
                  { value: "study", label: "Study (see answers)" },
                ]}
              />
            </div>
            <Field label="Subject">
              <select className={inputCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">All subjects, mixed ({bank.questions.length})</option>
                {bank.subjects.map((s) => (
                  <option key={s.id} value={s.id} disabled={!countFor(s.id)}>
                    {s.code} — {s.name} ({countFor(s.id)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of items" hint={`${available} available`}>
              <input className={inputCls} type="number" min={1} max={available} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            {mode === "exam" && (
              <Field label="Time limit (minutes)" hint="Default: the board's pace of 2 hours per 100 items.">
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  placeholder={String(Math.ceil((items * SECONDS_PER_ITEM) / 60))}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
            )}
            <ErrorBox message={error} />
            <Button
              variant="primary"
              className="w-full"
              onClick={() =>
                start({
                  subjectId: subjectId || null,
                  count: items,
                  mode,
                  minutes: mode === "exam" && minutes ? minutes : null,
                  label: `${subjectId ? bank.subjects.find((s) => s.id === subjectId)?.code : "All subjects"} · ${items} items`,
                })
              }
            >
              Start {mode === "exam" ? "exam" : "studying"}
            </Button>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card title="Board simulation" actions={<span className="text-xs text-slate-500">100 items · 2 hours · timed</span>}>
            <p className="mb-4 text-sm text-slate-600">Take one subject the way it's given on exam day.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {bank.subjects.map((s) => {
                const n = countFor(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{s.code}</p>
                      <p className="truncate text-xs text-slate-500">{s.name}</p>
                    </div>
                    {n >= BOARD_ITEMS ? (
                      <Button size="sm" variant="primary" onClick={() => start({ subjectId: s.id, count: BOARD_ITEMS, mode: "exam", minutes: 120, label: `${s.code} board simulation` })}>
                        Start
                      </Button>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400">{n}/100 items so far</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Your results" actions={history.length > 5 && <Checkbox checked={showAll} onChange={setShowAll} label="Show all" />}>
            {!history.length ? (
              <p className="text-sm text-slate-500">Your finished exams will appear here. They're saved on this device only.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(showAll ? history : history.slice(0, 5)).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{e.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(e.startedAt)} · {e.mode === "exam" ? "Exam" : "Study"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums font-semibold text-slate-900">{e.results?.generalAverage.toFixed(1)}%</span>
                      {e.results?.passed ? <Badge tone="green">Passing</Badge> : <Badge tone="red">Below passing</Badge>}
                      <Button size="sm" onClick={() => onOpen(e.id)}>
                        Review
                      </Button>
                      <button type="button" className="text-xs text-slate-400 hover:text-red-700" onClick={() => confirm("Delete this result?") && onDelete(e.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
