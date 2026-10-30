import { useEffect, useRef, useState } from "react";
import { api, errorMessage, formatBytes, formatDate, useApi } from "../api.ts";
import { Badge, Button, Card, Checkbox, Empty, ErrorBox, Field, inputCls, Loading, Modal, PageHeader, Spinner, useToast } from "../components/ui.tsx";
import { useSubjects } from "../state.tsx";
import type { AiStatus, Source, Subject } from "../types.ts";

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md";

function TopicPicker({ subject, value, onChange }: { subject?: Subject; value: number[]; onChange: (ids: number[]) => void }) {
  if (!subject) return <p className="text-sm text-slate-500">Pick a subject to tag topics.</p>;
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {subject.topics.map((t) => (
        <Checkbox
          key={t.id}
          checked={value.includes(t.id)}
          onChange={(on) => onChange(on ? [...value, t.id] : value.filter((id) => id !== t.id))}
          label={t.name}
        />
      ))}
    </div>
  );
}

export function Sources() {
  const { subjects } = useSubjects();
  const toast = useToast();
  const { data: sources, error, loading, setData, reload } = useApi<Source[]>("/sources");
  const { data: ai } = useApi<AiStatus>("/ai/status");
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [topicIds, setTopicIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [preview, setPreview] = useState<Source | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep polling while any file is still being read.
  const processing = sources?.some((s) => s.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [processing, reload]);

  async function upload() {
    if (!files.length) return;
    const form = new FormData();
    for (const f of files) form.append("files", f);
    if (subjectId) form.append("subjectId", String(subjectId));
    if (topicIds.length) form.append("topicIds", topicIds.join(","));
    setUploading(true);
    try {
      setData(await api.post<Source[]>("/sources", form));
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      toast(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}; reading text…`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  async function remove(s: Source) {
    const extra = s.questionCount ? ` ${s.questionCount} question(s) made from it stay in the bank, but lose the link to their excerpt.` : "";
    if (!confirm(`Delete "${s.filename}"?${extra}`)) return;
    try {
      setData(await api.del<Source[]>(`/sources/${s.id}`));
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const subject = subjects.find((s) => s.id === subjectId);

  return (
    <>
      <PageHeader
        title="Source Materials"
        description="Upload the review materials Claude should write questions from. Tag each file with its subject (and topics, if it covers only some) so generation picks the right material."
      />

      <div className="space-y-6">
        {ai?.mock && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span>Mock AI mode: load the 5 sample review files (one per subject) to test the app without your own materials.</span>
            <Button
              size="sm"
              variant="primary"
              busy={loadingSamples}
              onClick={async () => {
                setLoadingSamples(true);
                try {
                  setData(await api.post<Source[]>("/mock/load-sources"));
                  toast("Sample files added; reading text…");
                } catch (e) {
                  toast(errorMessage(e), "error");
                } finally {
                  setLoadingSamples(false);
                }
              }}
            >
              Load sample files
            </Button>
          </div>
        )}
        <Card title="Upload files">
          <div className="grid gap-6 lg:grid-cols-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                setFiles([...files, ...Array.from(e.dataTransfer.files)]);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging ? "border-teal-500 bg-teal-50" : "border-slate-300 hover:border-teal-400 hover:bg-slate-50"
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-8 text-slate-400" fill="currentColor" aria-hidden="true">
                <path d="M11 16V7.8l-2.6 2.6L7 9l5-5 5 5-1.4 1.4L13 7.8V16h-2Zm-6 4a2 2 0 0 1-2-2v-3h2v3h14v-3h2v3a2 2 0 0 1-2 2H5Z" />
              </svg>
              <p className="mt-2 text-sm font-medium text-slate-700">Drop files here or click to choose</p>
              <p className="mt-1 text-xs text-slate-500">PDF, Word (.docx), PowerPoint (.pptx), text · up to 50 MB each</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
              />
              {files.length > 0 && (
                <ul className="mt-4 w-full space-y-1 text-left text-sm" onClick={(e) => e.stopPropagation()}>
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-slate-100 px-2.5 py-1.5">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-xs text-slate-500 hover:text-red-600" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <Field label="Subject">
                <select
                  className={inputCls}
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value ? Number(e.target.value) : "");
                    setTopicIds([]);
                  }}
                >
                  <option value="">Choose a subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Topics covered <span className="font-normal text-slate-500">(optional)</span></p>
                <TopicPicker subject={subject} value={topicIds} onChange={setTopicIds} />
              </div>
              <Button variant="primary" disabled={!files.length} busy={uploading} onClick={upload}>
                Upload {files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""}
              </Button>
              <p className="text-xs text-slate-500">
                Scanned PDFs (images of pages) can't be read yet. Only upload materials you have the right to use.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Your files">
          <ErrorBox message={error} />
          {loading && !sources ? (
            <Loading />
          ) : !sources?.length ? (
            <Empty title="No files yet">Upload your first review material above.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4 font-medium">File</th>
                    <th className="py-2 pr-4 font-medium">Subject & topics</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 text-right font-medium">Questions</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((s) => {
                    const subj = subjects.find((x) => x.id === s.subjectId);
                    const topicNames = subj?.topics.filter((t) => s.topicIds.includes(t.id)).map((t) => t.name) ?? [];
                    return (
                      <tr key={s.id} className="align-top">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-800">{s.filename}</p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(s.size)} · {formatDate(s.createdAt)}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          {subj ? <Badge tone="teal">{subj.code}</Badge> : <Badge tone="amber">No subject</Badge>}
                          <p className="mt-1 max-w-xs text-xs text-slate-500">{topicNames.length ? topicNames.join(", ") : "All topics"}</p>
                        </td>
                        <td className="py-3 pr-4">
                          {s.status === "processing" && (
                            <span className="inline-flex items-center gap-1.5 text-slate-600">
                              <Spinner className="size-3.5" /> Reading…
                            </span>
                          )}
                          {s.status === "ready" && (
                            <>
                              <Badge tone="green">Ready</Badge>
                              <p className="mt-1 text-xs text-slate-500">
                                {s.chunkCount} excerpts · {Math.round(s.charCount / 1000)}k characters
                              </p>
                            </>
                          )}
                          {s.status === "error" && (
                            <>
                              <Badge tone="red">Failed</Badge>
                              <p className="mt-1 max-w-xs text-xs text-red-700">{s.error}</p>
                            </>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{s.questionCount}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {s.status === "ready" && (
                            <Button size="sm" variant="ghost" onClick={() => setPreview(s)}>
                              Preview
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                            Tag
                          </Button>
                          {s.status === "error" && (
                            <Button size="sm" variant="ghost" onClick={async () => setData(await api.post<Source[]>(`/sources/${s.id}/reprocess`))}>
                              Retry
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {editing && <TagModal source={editing} onClose={() => setEditing(null)} onSaved={(list) => { setData(list); setEditing(null); toast("Tags saved"); }} />}
      {preview && <PreviewModal source={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function TagModal({ source, onClose, onSaved }: { source: Source; onClose: () => void; onSaved: (list: Source[]) => void }) {
  const { subjects } = useSubjects();
  const [subjectId, setSubjectId] = useState<number | "">(source.subjectId ?? "");
  const [topicIds, setTopicIds] = useState(source.topicIds);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      onSaved(await api.put<Source[]>(`/sources/${source.id}`, { subjectId: subjectId || null, topicIds }));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tag "${source.filename}"`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Subject">
          <select className={inputCls} value={subjectId} onChange={(e) => { setSubjectId(e.target.value ? Number(e.target.value) : ""); setTopicIds([]); }}>
            <option value="">No subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Topics covered</p>
          <TopicPicker subject={subjects.find((s) => s.id === subjectId)} value={topicIds} onChange={setTopicIds} />
        </div>
      </div>
    </Modal>
  );
}

function PreviewModal({ source, onClose }: { source: Source; onClose: () => void }) {
  const { data, error, loading } = useApi<{ id: number; idx: number; location: string | null; text: string }[]>(`/sources/${source.id}/chunks`);
  return (
    <Modal open wide onClose={onClose} title={`Extracted text — ${source.filename}`}>
      <p className="mb-3 text-sm text-slate-500">
        This is the text Claude sees, split into {source.chunkCount} excerpts. If it looks garbled, the file may be scanned or protected.
      </p>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {data?.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-xs font-medium text-slate-500">
                Excerpt E{c.id}
                {c.location && ` · ${c.location}`}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{c.text}</p>
            </div>
          ))}
          {source.chunkCount > (data?.length ?? 0) && <p className="text-xs text-slate-500">Showing the first {data?.length} excerpts.</p>}
        </div>
      )}
    </Modal>
  );
}
