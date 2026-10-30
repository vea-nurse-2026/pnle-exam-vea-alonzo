import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, errorMessage, formatDate, useApi } from "../api.ts";
import { Badge, Button, Card, Checkbox, ErrorBox, Field, inputCls, PageHeader, Segmented } from "../components/ui.tsx";
import { useSubjects } from "../state.tsx";
import type { PracticeSession, PracticeSummary } from "../types.ts";

export function Practice() {
  const { subjects } = useSubjects();
  const navigate = useNavigate();
  const { data: history, reload } = useApi<PracticeSummary[]>("/practice");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"exam" | "study">("exam");
  const [minutes, setMinutes] = useState<number | "">("");
  const [includeSamples, setIncludeSamples] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const available = subjectId ? (subjects.find((s) => s.id === subjectId)?.approved ?? 0) : subjects.reduce((n, s) => n + s.approved, 0);
  const defaultMinutes = Math.ceil((Math.min(count, available || count) * 72) / 60);

  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      const session = await api.post<PracticeSession>("/practice", {
        subjectId: subjectId || null,
        count,
        mode,
        minutes: mode === "exam" && minutes ? minutes : null,
        includeSamples,
      });
      navigate(`/practice/${session.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this practice session?")) return;
    await api.del(`/practice/${id}`);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Practice exam"
        description="Take a timed board-style exam or study with instant feedback. Scores use the PNLE passing rule: a general average of at least 75% with no subject below 60%."
      />

      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <Card title="New session" className="self-start">
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Mode</p>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "exam", label: "Exam (timed)" },
                  { value: "study", label: "Study (instant feedback)" },
                ]}
              />
            </div>
            <Field label="Subject" hint={`${available} approved question${available === 1 ? "" : "s"} available`}>
              <select className={inputCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">All subjects (mock board)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.approved})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of items" hint="The real exam has 100 items per subject.">
              <input className={inputCls} type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            {mode === "exam" && (
              <Field label="Time limit (minutes)" hint={`Default ${defaultMinutes} min: the board's pace of 2 hours per 100 items.`}>
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  placeholder={String(defaultMinutes)}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
            )}
            <Checkbox checked={includeSamples} onChange={setIncludeSamples} label="Include sample questions" />
            <ErrorBox message={error} />
            <Button variant="primary" className="w-full" busy={busy} disabled={!available} onClick={start}>
              Start
            </Button>
          </div>
        </Card>

        <Card title="History">
          {!history?.length ? (
            <p className="text-sm text-slate-500">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Mode</th>
                    <th className="py-2 pr-3 text-right font-medium">Items</th>
                    <th className="py-2 pr-3 text-right font-medium">Average</th>
                    <th className="py-2 pr-3 font-medium">Result</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(h.startedAt)}</td>
                      <td className="py-2.5 pr-3">{h.subjectCode ?? "All"}</td>
                      <td className="py-2.5 pr-3 capitalize">{h.mode}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{h.count}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{h.generalAverage !== null ? `${h.generalAverage.toFixed(1)}%` : "—"}</td>
                      <td className="py-2.5 pr-3">
                        {h.passed === null ? <Badge tone="blue">In progress</Badge> : h.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Below passing</Badge>}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <Link to={`/practice/${h.id}`} className="font-medium text-teal-700 hover:underline">
                          {h.finishedAt ? "Review" : "Continue"}
                        </Link>
                        <button type="button" className="ml-3 text-slate-400 hover:text-red-600" onClick={() => remove(h.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
