import { useState } from "react";
import { useSearchParams } from "react-router";
import { useApi } from "../api.ts";
import { Button, Checkbox, ErrorBox, Loading } from "../components/ui.tsx";
import { LETTERS, type Question } from "../types.ts";

/** A printable test paper. Use the browser's "Save as PDF" to get a PDF. */
export function PrintView() {
  const [params] = useSearchParams();
  const query = new URLSearchParams(params);
  query.set("limit", "500");
  const { data, error, loading } = useApi<{ items: Question[]; total: number }>(`/questions?${query}`);
  const [withKey, setWithKey] = useState(true);
  const [withRationale, setWithRationale] = useState(false);

  if (loading) return <div className="p-8"><Loading /></div>;
  if (error || !data) return <div className="p-8"><ErrorBox message={error} /></div>;

  const items = [...data.items].sort((a, b) => a.subjectCode.localeCompare(b.subjectCode) || a.id - b.id);
  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-10 text-[15px] leading-relaxed text-black">
      <div className="no-print mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Button variant="primary" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
        <Checkbox checked={withKey} onChange={setWithKey} label="Answer key at the end" />
        <Checkbox checked={withRationale} onChange={setWithRationale} label="Include rationales" />
        <span className="text-sm text-slate-500">
          {items.length} question{items.length === 1 ? "" : "s"}
          {data.total > items.length && ` (first ${items.length} of ${data.total})`}
        </span>
      </div>

      <h1 className="text-xl font-bold">PNLE Practice Questions</h1>
      <p className="mb-8 text-sm text-slate-600">Choose the single best answer.</p>

      <ol className="space-y-6">
        {items.map((q, i) => (
          <li key={q.id} className="break-inside-avoid">
            {q.situation && <p className="mb-1 italic">Situation: {q.situation}</p>}
            <p>
              <span className="font-semibold">{i + 1}.</span> {q.stem}
            </p>
            <ol className="mt-1.5 space-y-0.5 pl-6">
              {q.options.map((o, j) => (
                <li key={j}>
                  {LETTERS[j]}. {o}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {withKey && (
        <section className="mt-12 break-before-page">
          <h2 className="mb-4 text-lg font-bold">Answer key</h2>
          <ol className={withRationale ? "space-y-3" : "grid grid-cols-4 gap-x-6 gap-y-1 sm:grid-cols-6"}>
            {items.map((q, i) => (
              <li key={q.id}>
                <span className="font-semibold">
                  {i + 1}. {LETTERS[q.correctIndex]}
                </span>
                {withRationale && <span className="text-sm"> — {q.rationale}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
