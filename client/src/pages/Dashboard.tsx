import { Link } from "react-router";
import { formatDate, useApi } from "../api.ts";
import { Badge, Card, ErrorBox, Loading, Notice, PageHeader } from "../components/ui.tsx";
import type { Dashboard as DashboardData } from "../types.ts";

function Stat({ label, value, note, to }: { label: string; value: string | number; note?: string; to?: string }) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-teal-300">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export function Dashboard() {
  const { data, error, loading } = useApi<DashboardData>("/dashboard");
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error} />;

  const ownApproved = data.questions.approved - data.questions.samples;
  const steps = [
    { done: data.sources.ready > 0, label: "Upload your review materials", to: "/sources" },
    { done: true, label: "Check the blueprint topics for each subject", to: "/blueprint" },
    { done: data.recentJobs.some((j) => j.status === "done"), label: "Generate your first questions", to: "/generate" },
    { done: ownApproved > 0, label: "Review and approve generated questions", to: "/review" },
    { done: data.practice.count > 0, label: "Take a practice exam", to: "/practice" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Your PNLE question bank at a glance." />

      <div className="space-y-6">
        {data.ai.mock && (
          <Notice>
            <p className="font-medium">Mock AI mode is on</p>
            <p className="mt-1">
              Generate returns test questions written from the sample files in <code className="rounded bg-sky-100 px-1">mock-data/</code>, not from Claude. Load the sample files on the{" "}
              <Link to="/sources" className="font-medium underline">Source Materials</Link> page to try the full flow. When you have an API key, set{" "}
              <code className="rounded bg-sky-100 px-1">MOCK_AI=false</code> in <code className="rounded bg-sky-100 px-1">server/.env</code>.
            </p>
          </Notice>
        )}
        {!data.ai.configured && (
          <Notice tone="amber">
            <p className="font-medium">Add your Claude API key to generate questions</p>
            <p className="mt-1">
              Copy <code className="rounded bg-amber-100 px-1">server/.env.example</code> to <code className="rounded bg-amber-100 px-1">server/.env</code>, set{" "}
              <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code>, and restart the server. Everything else works without it.
            </p>
          </Notice>
        )}
        {data.questions.samples > 0 && (
          <Notice>
            The bank includes {data.questions.samples} sample questions so you can try the practice exam now. Delete them from the{" "}
            <Link to="/bank?sample=only" className="font-medium underline">
              Question Bank
            </Link>{" "}
            once your own questions are approved.
          </Notice>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Approved questions" value={data.questions.approved} note={`${ownApproved} from your materials`} to="/bank" />
          <Stat label="Awaiting review" value={data.questions.draft} note="Generated drafts" to="/review" />
          <Stat label="Source files ready" value={data.sources.ready} note={data.sources.error ? `${data.sources.error} failed to process` : `${data.sources.total} uploaded`} to="/sources" />
          <Stat
            label="Practice average"
            value={data.practice.average !== null ? `${data.practice.average.toFixed(1)}%` : "—"}
            note={data.practice.count ? `${data.practice.count} exams · last ${data.practice.last?.toFixed(1)}%` : "No exams yet"}
            to="/practice"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card title="Coverage by subject" className="lg:col-span-3" actions={<span className="text-xs text-slate-500">approved vs. target items</span>}>
            <div className="space-y-4">
              {data.subjects.map((s) => {
                const pct = s.targetItems ? Math.min(100, (s.approved / s.targetItems) * 100) : 0;
                const draftPct = s.targetItems ? Math.min(100 - pct, (s.drafts / s.targetItems) * 100) : 0;
                return (
                  <div key={s.id}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <p className="min-w-0 truncate">
                        <span className="font-semibold text-slate-900">{s.code}</span> <span className="text-slate-500">{s.name}</span>
                      </p>
                      <p className="shrink-0 tabular-nums text-slate-600">
                        {s.approved} / {s.targetItems}
                      </p>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="bg-teal-600" style={{ width: `${pct}%` }} />
                      <div className="bg-amber-300" style={{ width: `${draftPct}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-teal-600" /> Approved</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-300" /> Awaiting review</span>
              </p>
            </div>
          </Card>

          <Card title="Getting started" className="lg:col-span-2">
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <Link to={s.to} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {s.done ? "✓" : i + 1}
                    </span>
                    <span className={s.done ? "text-slate-500" : "font-medium text-slate-800 hover:text-teal-700"}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card title="Recent generation jobs" actions={<Link to="/generate" className="text-sm font-medium text-teal-700 hover:underline">Generate questions</Link>}>
          {data.recentJobs.length === 0 ? (
            <p className="text-sm text-slate-500">No jobs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentJobs.map((j) => {
                const subject = data.subjects.find((s) => s.id === j.settings.subjectId);
                return (
                  <li key={j.id}>
                    <Link to={`/generate?job=${j.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-teal-700">
                      <span>
                        <span className="font-medium">{subject?.code}</span> · {j.progress} of {j.total} questions
                        {j.settings.replaceQuestionId && <span className="text-slate-500"> · replacement for #{j.settings.replaceQuestionId}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{formatDate(j.createdAt)}</span>
                        <JobBadge status={j.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function JobBadge({ status }: { status: string }) {
  const tone = status === "done" ? "green" : status === "error" ? "red" : "blue";
  const label = { queued: "Queued", running: "Running", done: "Done", error: "Failed" }[status] ?? status;
  return <Badge tone={tone}>{label}</Badge>;
}
