import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LETTERS, type PracticeQuestion, type PracticeSession } from "../types.ts";
import { Badge, Button, Card, Segmented, useToast } from "./ui.tsx";

// The exam runner and results screens, shared by the studio's Practice page and the online exam site.
// A question's answer is shown once `correctIndex` is present: after submitting, or right after
// answering in study mode.

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function ExamRunner({
  session,
  onChoose,
  onSubmit,
}: {
  session: PracticeSession;
  onChoose: (questionId: number, choice: number) => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [index, setIndex] = useState(() => Math.max(0, session.questions.findIndex((q) => session.answers[q.id] === undefined)));
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  const q = session.questions[index];
  const answered = Object.keys(session.answers).length;
  const endsAt = session.timeLimitSec ? Date.parse(session.startedAt) + session.timeLimitSec * 1000 : null;
  const remaining = endsAt ? (endsAt - now) / 1000 : null;

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      await onSubmit();
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }, [onSubmit, toast]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (remaining !== null && remaining <= 0) {
      toast("Time is up — submitting your exam");
      submit();
    }
  }, [remaining, submit, toast]);

  async function choose(choice: number) {
    if (session.mode === "study" && session.answers[q.id] !== undefined) return;
    try {
      await onChoose(q.id, choice);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  function confirmSubmit() {
    const left = session.questions.length - answered;
    if (left && !confirm(`${left} question${left > 1 ? "s are" : " is"} unanswered and will be marked wrong. Submit anyway?`)) return;
    submit();
  }

  const chosen = session.answers[q.id];
  const revealed = q.correctIndex !== undefined;
  // Items in a situational set share one situation; show which part of the set this is.
  const setItems = q.situation ? session.questions.filter((x) => x.situation === q.situation) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{session.mode === "exam" ? "Practice exam" : "Study session"}</h1>
          <p className="text-sm text-slate-500">
            {answered} of {session.questions.length} answered
          </p>
        </div>
        <div className="flex items-center gap-3">
          {remaining !== null && (
            <span className={`rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${remaining < 300 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
              {formatClock(remaining)}
            </span>
          )}
          <Button variant="primary" busy={submitting} onClick={confirmSubmit}>
            Submit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-500">
              Question {index + 1} of {session.questions.length} · {q.subjectCode}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = new Set(flags);
                if (next.has(q.id)) next.delete(q.id);
                else next.add(q.id);
                setFlags(next);
              }}
            >
              {flags.has(q.id) ? "★ Flagged" : "☆ Flag for later"}
            </Button>
          </div>

          {q.situation && (
            <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {setItems.length > 1 && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Situation · item {setItems.indexOf(q) + 1} of {setItems.length}
                </p>
              )}
              {q.situation}
            </div>
          )}
          <p className="mb-4 font-medium leading-relaxed text-slate-900">{q.stem}</p>

          <div className="space-y-2">
            {q.options.map((opt, i) => {
              let cls = "border-slate-200 hover:border-teal-400 hover:bg-teal-50/40";
              if (revealed && i === q.correctIndex) cls = "border-emerald-400 bg-emerald-50";
              else if (revealed && i === chosen) cls = "border-red-300 bg-red-50";
              else if (i === chosen) cls = "border-teal-500 bg-teal-50 ring-1 ring-teal-500";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={revealed}
                  onClick={() => choose(i)}
                  className={`flex w-full gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${cls}`}
                >
                  <span className="font-semibold text-slate-600">{LETTERS[i]}.</span>
                  <span className="flex-1 text-slate-800">
                    {opt}
                    {revealed && q.explanations?.[i] && <span className="mt-1 block text-xs text-slate-500">{q.explanations[i]}</span>}
                  </span>
                  {revealed && i === q.correctIndex && <span className="font-semibold text-emerald-700">✓</span>}
                  {revealed && i === chosen && i !== q.correctIndex && <span className="font-semibold text-red-700">✗</span>}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${chosen === q.correctIndex ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
              <p className="font-semibold">{chosen === q.correctIndex ? "Correct" : `Incorrect — the answer is ${LETTERS[q.correctIndex!]}`}</p>
              <p className="mt-1">{q.rationale}</p>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button disabled={index === 0} onClick={() => setIndex(index - 1)}>
              ← Previous
            </Button>
            <Button disabled={index === session.questions.length - 1} onClick={() => setIndex(index + 1)}>
              Next →
            </Button>
          </div>
        </Card>

        <Card title="Questions" className="self-start">
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {session.questions.map((item, i) => {
              const done = session.answers[item.id] !== undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`relative rounded-md py-1.5 text-xs font-medium tabular-nums transition-colors ${
                    i === index ? "bg-primary text-white" : done ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {i + 1}
                  {flags.has(item.id) && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Flagged items have an amber dot.</p>
        </Card>
      </div>
    </div>
  );
}

export function ExamResults({ session, back }: { session: PracticeSession; back: ReactNode }) {
  const r = session.results!;
  const [filter, setFilter] = useState<"all" | "wrong">("wrong");
  const isWrong = (q: PracticeQuestion) => session.answers[q.id] !== q.correctIndex;
  const shown = session.questions.filter((q) => filter === "all" || isWrong(q));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Results</h1>
        {back}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">General average</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{r.generalAverage.toFixed(1)}%</p>
          <div className="mt-3">{r.passed ? <Badge tone="green">Passing</Badge> : <Badge tone="red">Below passing</Badge>}</div>
          <p className="mt-3 text-sm text-slate-600">
            {r.correct} of {r.total} correct · {r.answered} answered · {formatClock(r.durationSec)} spent
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Passing on the PNLE: a general average of 75% or higher, with no subject below 60%. This is a practice estimate, not an official rating.
          </p>
        </Card>

        <Card title="By subject" className="lg:col-span-2">
          <div className="space-y-4">
            {r.bySubject.map((s) => (
              <div key={s.subjectId}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-800">{s.code}</span>
                  <span className={`tabular-nums ${s.pct < 60 ? "font-semibold text-red-700" : "text-slate-600"}`}>
                    {s.correct}/{s.total} · {s.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="relative mt-1.5 h-2.5 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${s.pct >= 75 ? "bg-emerald-500" : s.pct >= 60 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${s.pct}%` }} />
                  <span className="absolute top-[-3px] h-4 w-px bg-slate-500" style={{ left: "60%" }} title="60% minimum per subject" />
                  <span className="absolute top-[-3px] h-4 w-px bg-slate-800" style={{ left: "75%" }} title="75% passing average" />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">Marks at 60% (subject minimum) and 75% (passing average).</p>
          </div>
        </Card>
      </div>

      <Card
        title="Answer review"
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "wrong", label: `Incorrect (${session.questions.filter(isWrong).length})` },
              { value: "all", label: `All (${session.questions.length})` },
            ]}
          />
        }
      >
        {!shown.length ? (
          <p className="text-sm text-slate-500">No incorrect answers. Well done!</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {shown.map((q) => {
              const chosen = session.answers[q.id];
              return (
                <li key={q.id} className="py-5 first:pt-0">
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    Question {session.questions.indexOf(q) + 1} · {q.subjectCode}
                    {q.topicName && ` · ${q.topicName}`}
                  </p>
                  {q.situation && <p className="mb-2 text-sm text-slate-600">{q.situation}</p>}
                  <p className="font-medium text-slate-900">{q.stem}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((o, i) => (
                      <li
                        key={i}
                        className={`rounded-md px-3 py-1.5 ${i === q.correctIndex ? "bg-emerald-50 text-emerald-900" : i === chosen ? "bg-red-50 text-red-900" : "text-slate-700"}`}
                      >
                        {LETTERS[i]}. {o}
                        {i === q.correctIndex && " ✓"}
                        {i === chosen && i !== q.correctIndex && " (your answer)"}
                      </li>
                    ))}
                  </ul>
                  {chosen === undefined && <p className="mt-1 text-xs text-red-700">Not answered</p>}
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Rationale:</span> {q.rationale}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
