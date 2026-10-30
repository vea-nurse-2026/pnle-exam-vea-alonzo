import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, errorMessage, qs, useApi } from "../api.ts";
import { QuestionView } from "../components/QuestionView.tsx";
import { ReviewActions } from "../components/ReviewActions.tsx";
import { Button, Card, Checkbox, Empty, ErrorBox, inputCls, Loading, PageHeader } from "../components/ui.tsx";
import { useSubjects } from "../state.tsx";
import type { Question, QuestionDetail } from "../types.ts";

/** Highlights the cited quote inside the excerpt, when it appears there word for word. */
function Excerpt({ text, quote }: { text: string; quote: string }) {
  const at = quote ? text.toLowerCase().indexOf(quote.toLowerCase()) : -1;
  if (at < 0) return <p className="whitespace-pre-wrap">{text}</p>;
  return (
    <p className="whitespace-pre-wrap">
      {text.slice(0, at)}
      <mark className="rounded bg-yellow-200 px-0.5">{text.slice(at, at + quote.length)}</mark>
      {text.slice(at + quote.length)}
    </p>
  );
}

export function Review() {
  const { subjects, reload: reloadSubjects } = useSubjects();
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string>();
  const { data, error, loading, setData, reload } = useApi<{ items: Question[]; total: number }>(
    `/questions${qs({ status: "draft", subjectId, warnings: warningsOnly ? "only" : undefined, limit: 200 })}`,
  );
  const items = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<number>();
  const selected = items.find((q) => q.id === selectedId) ?? items[0];
  const { data: detail } = useApi<QuestionDetail>(selected ? `/questions/${selected.id}` : null);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  function onUpdated(q: Question) {
    if (!data) return;
    if (q.status === "draft") {
      setData({ ...data, items: data.items.map((x) => (x.id === q.id ? q : x)) });
      return;
    }
    // Reviewed: drop it from the queue and move to the next one.
    const index = data.items.findIndex((x) => x.id === q.id);
    const rest = data.items.filter((x) => x.id !== q.id);
    setData({ items: rest, total: data.total - 1 });
    setSelectedId(rest[Math.min(index, rest.length - 1)]?.id);
    reloadSubjects();
  }

  /** Approves every draft currently listed (the subject and warnings filters apply). */
  async function approveAll() {
    const flagged = items.filter((q) => q.warnings.length).length;
    const note = flagged ? `\n\n${flagged} of them have automatic-check warnings.` : "";
    if (!confirm(`Approve all ${items.length} questions in this list?${note}`)) return;
    setApproving(true);
    setApproveError(undefined);
    try {
      await api.post("/questions/bulk", { ids: items.map((q) => q.id), action: "approve" });
      setSelectedId(undefined);
      reload();
      reloadSubjects();
    } catch (e) {
      setApproveError(errorMessage(e));
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Check each draft against its source excerpt, then approve, edit, or reject it. Only approved questions reach the bank and practice exams."
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <select className={inputCls.replace("w-full", "w-auto")} value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <Checkbox checked={warningsOnly} onChange={setWarningsOnly} label="Only items with warnings" />
        {data && <span className="text-sm text-slate-500">{data.total} waiting</span>}
        {items.length > 0 && (
          <Button variant="primary" size="sm" className="ml-auto" busy={approving} onClick={approveAll}>
            Approve all ({items.length})
          </Button>
        )}
      </div>

      <ErrorBox message={error ?? approveError} />
      {loading && !data ? (
        <Loading />
      ) : !items.length ? (
        <Empty title="Nothing to review" action={<Link to="/generate" className="text-sm font-medium text-teal-700 hover:underline">Generate questions</Link>}>
          New drafts from the Generate page will appear here.
        </Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <ul className="max-h-[75vh] space-y-1.5 overflow-y-auto pr-1">
            {items.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    q.id === selected?.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{q.subjectCode}</span> #{q.id}
                    {q.warnings.length > 0 && <span className="rounded bg-amber-100 px-1.5 font-medium text-amber-800">{q.warnings.length} warning{q.warnings.length > 1 ? "s" : ""}</span>}
                  </span>
                  <span className="mt-1 line-clamp-2 text-slate-800">{q.stem}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="grid min-w-0 gap-6 xl:grid-cols-[1fr_20rem]">
              <Card>
                <QuestionView q={selected} showStatus={false} actions={<ReviewActions q={selected} onUpdated={onUpdated} />} />
              </Card>
              <Card title="Source excerpt" className="self-start">
                {detail?.question.id === selected.id && detail.excerpt ? (
                  <div className="max-h-[60vh] overflow-y-auto text-sm leading-relaxed text-slate-700">
                    <p className="mb-2 text-xs font-medium text-slate-500">
                      {detail.excerpt.sourceName}
                      {detail.excerpt.location && ` · ${detail.excerpt.location}`}
                    </p>
                    <Excerpt text={detail.excerpt.text} quote={selected.sourceQuote} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{selected.chunkId ? "Loading…" : "No source excerpt is linked to this question."}</p>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
