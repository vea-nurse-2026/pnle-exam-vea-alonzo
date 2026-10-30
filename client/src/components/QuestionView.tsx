import type { ReactNode } from "react";
import { LETTERS, type Question } from "../types.ts";
import { Badge, StatusBadge } from "./ui.tsx";

export function QuestionTags({ q, showStatus }: { q: Question; showStatus?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone="teal">{q.subjectCode}</Badge>
      {q.topicName && <Badge>{q.topicName}</Badge>}
      <Badge tone={q.difficulty === "Difficult" ? "red" : q.difficulty === "Moderate" ? "amber" : "green"}>{q.difficulty}</Badge>
      <Badge tone="violet">{q.bloom}</Badge>
      {q.isSample && <Badge tone="blue">Sample</Badge>}
      {showStatus && <StatusBadge status={q.status} />}
      <span className="text-xs text-slate-400">#{q.id}</span>
    </div>
  );
}

/** A question with its key, rationale, per-option explanations, warnings, and source. */
export function QuestionView({ q, actions, showStatus = true }: { q: Question; actions?: ReactNode; showStatus?: boolean }) {
  return (
    <article className="space-y-4">
      <QuestionTags q={q} showStatus={showStatus} />

      {q.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <p className="font-medium">Check before approving</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {q.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {q.situation && (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <span className="mr-1 font-semibold text-slate-900">Situation:</span>
          {q.situation}
        </div>
      )}
      <p className="font-medium leading-relaxed text-slate-900">{q.stem}</p>

      <ol className="space-y-2">
        {q.options.map((opt, i) => {
          const correct = i === q.correctIndex;
          return (
            <li key={i} className={`rounded-lg border px-3.5 py-2.5 ${correct ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
              <div className="flex gap-3">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${correct ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {LETTERS[i]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{opt}</p>
                  {q.explanations[i] && <p className={`mt-0.5 text-xs ${correct ? "text-emerald-800" : "text-slate-500"}`}>{q.explanations[i]}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {q.rationale && (
        <div className="text-sm">
          <p className="font-semibold text-slate-900">Rationale</p>
          <p className="mt-0.5 leading-relaxed text-slate-700">{q.rationale}</p>
        </div>
      )}

      {(q.sourceLabel || q.sourceQuote) && (
        <div className="border-l-2 border-teal-600 pl-3 text-xs text-slate-500">
          {q.sourceLabel && <p className="font-medium text-slate-600">Source: {q.sourceLabel}</p>}
          {q.sourceQuote && <p className="mt-0.5 italic">"{q.sourceQuote}"</p>}
        </div>
      )}

      {actions && <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">{actions}</div>}
    </article>
  );
}
