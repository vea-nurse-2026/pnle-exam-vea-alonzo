import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorMessage, formatDate, useApi } from "../api.ts";
import { QuestionView } from "../components/QuestionView.tsx";
import { ReviewActions } from "../components/ReviewActions.tsx";
import { Button, Card, Checkbox, Empty, ErrorBox, Field, inputCls, Notice, PageHeader, ProgressBar, Segmented, Spinner, useToast } from "../components/ui.tsx";
import { useSubjects } from "../state.tsx";
import { BLOOMS, type AiStatus, type Job, type Question, type QuestionFormat, type Source } from "../types.ts";
import { JobBadge } from "./Dashboard.tsx";

interface JobDetail {
  job: Job;
  questions: Question[];
}

export function Generate() {
  const { subjects, reload: reloadSubjects } = useSubjects();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const jobId = params.get("job");

  const { data: ai } = useApi<AiStatus>("/ai/status");
  const { data: sources } = useApi<Source[]>("/sources");
  const { data: jobs, reload: reloadJobs } = useApi<Job[]>("/jobs");

  const [subjectId, setSubjectId] = useState<number>();
  const [topicIds, setTopicIds] = useState<number[]>([]);
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Mixed");
  const [blooms, setBlooms] = useState<string[]>(["Understanding", "Applying", "Analyzing"]);
  const [format, setFormat] = useState<QuestionFormat>("single");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);

  // Start on the first subject that has material to work from.
  useEffect(() => {
    if (subjectId !== undefined || !subjects.length || !sources) return;
    const withFiles = subjects.find((s) => sources.some((src) => src.status === "ready" && src.subjectId === s.id));
    setSubjectId((withFiles ?? subjects[0]).id);
  }, [subjects, sources, subjectId]);

  const subject = subjects.find((s) => s.id === subjectId);
  const subjectSources = useMemo(() => (sources ?? []).filter((s) => s.status === "ready" && s.subjectId === subjectId), [sources, subjectId]);

  // The job being shown, polled until it finishes.
  const [detail, setDetail] = useState<JobDetail>();
  useEffect(() => {
    if (!jobId) {
      setDetail(undefined);
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const d = await api.get<JobDetail>(`/jobs/${jobId}`);
        if (!live) return;
        setDetail(d);
        if (d.job.status === "queued" || d.job.status === "running") timer = setTimeout(load, 2000);
        else {
          reloadJobs();
          reloadSubjects();
        }
      } catch (e) {
        if (live) setError(errorMessage(e));
      }
    };
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [jobId, reloadJobs, reloadSubjects]);

  async function start() {
    if (!subjectId) return;
    setStarting(true);
    setError(undefined);
    try {
      const job = await api.post<Job>("/jobs", { subjectId, topicIds, sourceIds, count, difficulty, blooms, format, instructions });
      setParams({ job: String(job.id) });
      reloadJobs();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  function updateQuestion(q: Question) {
    setDetail((d) => d && { ...d, questions: d.questions.map((x) => (x.id === q.id ? q : x)) });
  }

  async function approveClean() {
    if (!detail) return;
    const ids = detail.questions.filter((q) => q.status === "draft" && !q.warnings.length).map((q) => q.id);
    if (!ids.length) return;
    await api.post("/questions/bulk", { ids, action: "approve" });
    setDetail({ ...detail, questions: detail.questions.map((q) => (ids.includes(q.id) ? { ...q, status: "approved" } : q)) });
    toast(`Approved ${ids.length} question${ids.length > 1 ? "s" : ""}`);
  }

  const toggle = (list: number[], id: number, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  const running = detail && (detail.job.status === "queued" || detail.job.status === "running");
  const cleanDrafts = detail?.questions.filter((q) => q.status === "draft" && !q.warnings.length).length ?? 0;

  return (
    <>
      <PageHeader
        title="Generate questions"
        description="Claude writes draft questions from your tagged source materials. Every draft goes to the review queue; nothing reaches the bank until you approve it."
      />

      {ai?.mock && (
        <div className="mb-6">
          <Notice>
            Mock AI mode: questions come from a built-in test pool (about 5 per subject) written from the sample files, not from Claude. Each job takes a couple of seconds.
          </Notice>
        </div>
      )}
      {ai && !ai.configured && (
        <div className="mb-6">
          <Notice tone="amber">
            No Claude API key found. Add <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-amber-100 px-1">server/.env</code> and restart the server.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card title="Settings" className="self-start lg:sticky lg:top-6">
          <div className="space-y-5">
            <Field label="Subject">
              <select
                className={inputCls}
                value={subjectId ?? ""}
                onChange={(e) => {
                  setSubjectId(Number(e.target.value));
                  setTopicIds([]);
                  setSourceIds([]);
                }}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Topics</p>
              <Checkbox checked={!topicIds.length} onChange={(on) => on && setTopicIds([])} label="All topics" />
              <div className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto border-l border-slate-200 pl-3">
                {subject?.topics.map((t) => (
                  <Checkbox key={t.id} checked={topicIds.includes(t.id)} onChange={(on) => setTopicIds(toggle(topicIds, t.id, on))} label={t.name} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Source files</p>
              {!subjectSources.length ? (
                <p className="text-sm text-amber-700">
                  No ready files are tagged with {subject?.code}.{" "}
                  <Link to="/sources" className="font-medium underline">
                    Upload or tag files
                  </Link>
                </p>
              ) : (
                <>
                  <Checkbox checked={!sourceIds.length} onChange={(on) => on && setSourceIds([])} label={`All ${subject?.code} files (${subjectSources.length})`} />
                  <div className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto border-l border-slate-200 pl-3">
                    {subjectSources.map((s) => (
                      <Checkbox key={s.id} checked={sourceIds.includes(s.id)} onChange={(on) => setSourceIds(toggle(sourceIds, s.id, on))} label={s.filename} />
                    ))}
                  </div>
                </>
              )}
            </div>

            <Field label="Number of questions" hint="Up to 50 per job, written in batches of 10.">
              <input className={inputCls} type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Difficulty</p>
              <Segmented
                value={difficulty}
                onChange={setDifficulty}
                options={["Mixed", "Easy", "Moderate", "Difficult"].map((d) => ({ value: d, label: d }))}
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Cognitive levels (Bloom's)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {BLOOMS.map((b) => (
                  <Checkbox key={b} checked={blooms.includes(b)} onChange={(on) => setBlooms(on ? [...blooms, b] : blooms.filter((x) => x !== b))} label={b} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Format</p>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { value: "single", label: "Single items" },
                  { value: "situational", label: "Situational" },
                  { value: "mixed", label: "Mixed" },
                ]}
              />
            </div>

            <Field label="Extra instructions" hint='Optional, e.g. "Focus on prioritization" or "Use DOH 2024 guidelines in the material".'>
              <textarea className={inputCls} rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </Field>

            <ErrorBox message={error} />
            <Button variant="primary" className="w-full" busy={starting} disabled={!subjectSources.length || !blooms.length || Boolean(running)} onClick={start}>
              Generate {count} question{count > 1 ? "s" : ""}
            </Button>
            {!ai?.mock && (
              <p className="text-xs text-slate-500">Rough cost: 2–3 US cents per question with {ai?.model ?? "Claude"}. A batch of 10 takes about 1–3 minutes.</p>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          {!detail ? (
            <Empty title="No job selected">Choose your settings and generate, or open a recent job below.</Empty>
          ) : (
            <Card
              title={
                <span className="flex items-center gap-2">
                  Job #{detail.job.id} · {subjects.find((s) => s.id === detail.job.settings.subjectId)?.code}
                  <JobBadge status={detail.job.status} />
                </span>
              }
              actions={
                detail.job.status === "done" &&
                cleanDrafts > 0 && (
                  <Button size="sm" variant="success" onClick={approveClean}>
                    Approve {cleanDrafts} with no warnings
                  </Button>
                )
              }
            >
              {running && (
                <div className="mb-5">
                  <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
                    <Spinner className="size-4" /> Claude is writing questions… {detail.job.progress} of {detail.job.total} done
                  </div>
                  <ProgressBar value={detail.job.progress} max={detail.job.total} />
                </div>
              )}
              {detail.job.error && <ErrorBox message={detail.job.error} />}
              {detail.job.notes.length > 0 && (
                <div className="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Notes from this job</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {detail.job.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.job.status === "done" && (
                <p className="mb-5 text-xs text-slate-500">
                  {detail.questions.length} questions · {detail.job.usage.input.toLocaleString()} input + {detail.job.usage.output.toLocaleString()} output tokens
                  {detail.job.usage.cacheRead > 0 && ` · ${detail.job.usage.cacheRead.toLocaleString()} cached`} ·{" "}
                  <Link to="/review" className="font-medium text-teal-700 hover:underline">
                    Open review queue
                  </Link>
                </p>
              )}
              <div className="divide-y divide-slate-100">
                {detail.questions.map((q, i) => (
                  <div key={q.id} className={i ? "pt-6" : ""}>
                    <div className="pb-6">
                      <QuestionView q={q} actions={<ReviewActions q={q} onUpdated={updateQuestion} size="sm" />} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Recent jobs">
            {!jobs?.length ? (
              <p className="text-sm text-slate-500">No jobs yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ job: String(j.id) })}
                      className={`flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left text-sm hover:text-teal-700 ${String(j.id) === jobId ? "font-semibold" : ""}`}
                    >
                      <span>
                        #{j.id} · {subjects.find((s) => s.id === j.settings.subjectId)?.code} · {j.progress}/{j.total} questions
                        {j.settings.replaceQuestionId && <span className="text-slate-500"> · replaces #{j.settings.replaceQuestionId}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-normal text-slate-500">{formatDate(j.createdAt)}</span>
                        <JobBadge status={j.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
