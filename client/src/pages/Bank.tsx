import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api, errorMessage, qs, useApi } from "../api.ts";
import { QuestionView } from "../components/QuestionView.tsx";
import { ReviewActions } from "../components/ReviewActions.tsx";
import { Badge, Button, Card, Checkbox, Empty, ErrorBox, inputCls, Loading, Modal, Notice, PageHeader, StatusBadge, useToast } from "../components/ui.tsx";
import { useSubjects } from "../state.tsx";
import { BLOOMS, DIFFICULTIES, type Question } from "../types.ts";

const PAGE = 50;
const FILTER_KEYS = ["status", "subjectId", "topicId", "difficulty", "bloom", "sample", "q"] as const;

export function Bank() {
  const { subjects, reload: reloadSubjects } = useSubjects();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? (k === "status" ? "approved" : "")])) as Record<(typeof FILTER_KEYS)[number], string>;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState(filters.q);
  const [open, setOpen] = useState<Question | null>(null);
  const [publishing, setPublishing] = useState(false);

  const filterQs = qs({ ...filters, status: filters.status === "all" ? "" : filters.status });
  const { data, error, loading, reload, setData } = useApi<{ items: Question[]; total: number }>(
    `/questions${filterQs}${filterQs ? "&" : "?"}limit=${PAGE}&offset=${page * PAGE}`,
  );

  useEffect(() => setPage(0), [filterQs]);

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "subjectId") next.delete("topicId");
    setParams(next);
  }

  function onUpdated(q: Question) {
    if (data) setData({ ...data, items: data.items.map((x) => (x.id === q.id ? q : x)) });
    setOpen(q);
    reloadSubjects();
  }

  async function deleteQuestion(q: Question) {
    if (!confirm(`Permanently delete question #${q.id}?`)) return;
    await api.del(`/questions/${q.id}`);
    setOpen(null);
    reload();
    reloadSubjects();
  }

  async function deleteSamples() {
    if (!confirm("Delete all sample questions? Practice sessions that used them will show fewer items.")) return;
    try {
      const r = await api.del<{ deleted: number }>("/questions/samples");
      toast(`Deleted ${r.deleted} sample questions`);
      setFilter("sample", "");
      reload();
      reloadSubjects();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const subject = subjects.find((s) => String(s.id) === filters.subjectId);
  const pages = data ? Math.ceil(data.total / PAGE) : 0;

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Search and manage every question. Practice exams draw only from approved items."
        actions={
          <>
            <a className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50" href={`/api/export/questions.csv${filterQs}`}>
              Export CSV
            </a>
            <a className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50" href={`/print${filterQs}`} target="_blank" rel="noreferrer">
              Print / PDF
            </a>
            <Button variant="primary" onClick={() => setPublishing(true)}>
              Publish to exam site
            </Button>
          </>
        }
      />

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <form
            className="sm:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter("q", search.trim());
            }}
          >
            <input className={inputCls} placeholder="Search text… (press Enter)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <select className={inputCls} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="approved">Approved</option>
            <option value="draft">Needs review</option>
            <option value="rejected">Rejected</option>
            <option value="retired">Retired</option>
            <option value="all">All statuses</option>
          </select>
          <select className={inputCls} value={filters.subjectId} onChange={(e) => setFilter("subjectId", e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <select className={inputCls} value={filters.difficulty} onChange={(e) => setFilter("difficulty", e.target.value)}>
            <option value="">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.bloom} onChange={(e) => setFilter("bloom", e.target.value)}>
            <option value="">Any Bloom's level</option>
            {BLOOMS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          {subject && (
            <select className={`${inputCls} sm:col-span-2`} value={filters.topicId} onChange={(e) => setFilter("topicId", e.target.value)}>
              <option value="">All {subject.code} topics</option>
              {subject.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <select className={inputCls} value={filters.sample} onChange={(e) => setFilter("sample", e.target.value)}>
            <option value="">Samples included</option>
            <option value="exclude">Hide samples</option>
            <option value="only">Samples only</option>
          </select>
        </div>

        {filters.sample === "only" && (data?.total ?? 0) > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span>Sample questions are placeholders, not written from your materials.</span>
            <Button size="sm" variant="danger" onClick={deleteSamples}>
              Delete all samples
            </Button>
          </div>
        )}

        <ErrorBox message={error} />
        {loading && !data ? (
          <Loading />
        ) : !data?.items.length ? (
          <Empty title="No questions match these filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Subject / topic</th>
                    <th className="py-2 pr-3 font-medium">Question</th>
                    <th className="py-2 pr-3 font-medium">Level</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((q) => (
                    <tr key={q.id} className="cursor-pointer align-top hover:bg-slate-50" onClick={() => setOpen(q)}>
                      <td className="py-3 pr-3 text-slate-400 tabular-nums">{q.id}</td>
                      <td className="py-3 pr-3">
                        <span className="font-medium text-slate-800">{q.subjectCode}</span>
                        <p className="max-w-[12rem] truncate text-xs text-slate-500">{q.topicName}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="line-clamp-2 max-w-xl text-slate-800">{q.stem}</p>
                        <div className="mt-1 flex gap-1.5">
                          {q.situation && <Badge>Situational</Badge>}
                          {q.isSample && <Badge tone="blue">Sample</Badge>}
                          {q.warnings.length > 0 && <Badge tone="amber">{q.warnings.length} warning{q.warnings.length > 1 ? "s" : ""}</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-xs whitespace-nowrap text-slate-600">
                        {q.difficulty}
                        <br />
                        {q.bloom}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={q.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                {data.total} question{data.total === 1 ? "" : "s"}
              </span>
              {pages > 1 && (
                <span className="flex items-center gap-2">
                  <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  Page {page + 1} of {pages}
                  <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      {publishing && <PublishModal onClose={() => setPublishing(false)} />}

      {open && (
        <Modal open wide onClose={() => setOpen(null)} title={`Question #${open.id}`}>
          <QuestionView
            q={open}
            actions={
              <>
                <ReviewActions q={open} onUpdated={onUpdated} />
                <Button variant="danger" onClick={() => deleteQuestion(open)}>
                  Delete
                </Button>
              </>
            }
          />
        </Modal>
      )}
    </>
  );
}

/** Writes approved questions to client/exam-public/questions.json for the online exam site. */
function PublishModal({ onClose }: { onClose: () => void }) {
  const [includeSamples, setIncludeSamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ total: number; bySubject: string[] }>();

  async function publish() {
    setBusy(true);
    setError(undefined);
    try {
      setResult(await api.post<{ total: number; bySubject: string[] }>("/exam-site/publish", { includeSamples }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Publish to the online exam site"
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" busy={busy} onClick={publish}>Publish</Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <ErrorBox message={error} />
        {result ? (
          <Notice tone="green">
            <p className="font-medium">Published {result.total} approved questions.</p>
            <p className="mt-1">{result.bySubject.join(" · ")}</p>
            <p className="mt-2">
              Commit and push the project (the file is <code className="rounded bg-emerald-100 px-1">client/exam-public/questions.json</code>) and Vercel will update the site in about a minute.
            </p>
          </Notice>
        ) : (
          <>
            <p>Every approved question is copied to the online exam site, replacing what it had. Drafts, rejected, and retired questions are left out.</p>
            <Checkbox checked={includeSamples} onChange={setIncludeSamples} label="Include the sample questions" />
          </>
        )}
      </div>
    </Modal>
  );
}
