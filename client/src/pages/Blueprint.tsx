import { useState } from "react";
import { api, errorMessage } from "../api.ts";
import { Button, Card, ErrorBox, Field, inputCls, Modal, PageHeader, useToast } from "../components/ui.tsx";
import { useSubjects } from "../state.tsx";
import type { Subject, Topic } from "../types.ts";

type TopicDraft = { subjectId: number; topic?: Topic; name: string; weight: number; targetItems: number };

export function Blueprint() {
  const { subjects, setSubjects } = useSubjects();
  const toast = useToast();
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [topicDraft, setTopicDraft] = useState<TopicDraft | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function saveSubject() {
    if (!editingSubject) return;
    setBusy(true);
    try {
      setSubjects(
        await api.put<Subject[]>(`/subjects/${editingSubject.id}`, {
          name: editingSubject.name,
          description: editingSubject.description,
          targetItems: editingSubject.targetItems,
        }),
      );
      setEditingSubject(null);
      toast("Subject saved");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTopic() {
    if (!topicDraft) return;
    setBusy(true);
    try {
      const body = { name: topicDraft.name, weight: topicDraft.weight, targetItems: topicDraft.targetItems };
      setSubjects(
        topicDraft.topic
          ? await api.put<Subject[]>(`/topics/${topicDraft.topic.id}`, body)
          : await api.post<Subject[]>(`/subjects/${topicDraft.subjectId}/topics`, body),
      );
      setTopicDraft(null);
      toast("Topic saved");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTopic(t: Topic) {
    const used = t.approved + t.drafts;
    if (!confirm(`Delete the topic "${t.name}"?${used ? ` ${used} question(s) will keep their subject but lose this topic.` : ""}`)) return;
    try {
      setSubjects(await api.del<Subject[]>(`/topics/${t.id}`));
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Blueprint"
        description="The five PNLE subjects as defined in PRC's enhanced Tables of Specifications (Board of Nursing Res. No. 10, s. 2025). Topics guide what Claude writes about; edit them to match your materials or the official TOS weights."
      />

      <div className="space-y-6">
        {subjects.map((s) => {
          const totalWeight = s.topics.reduce((n, t) => n + t.weight, 0);
          return (
            <Card
              key={s.id}
              title={
                <span>
                  {s.code} <span className="font-normal text-slate-500">· {s.name}</span>
                </span>
              }
              actions={
                <>
                  <span className="text-xs text-slate-500">
                    {s.approved} approved · target {s.targetItems}
                  </span>
                  <Button size="sm" onClick={() => { setError(undefined); setEditingSubject(s); }}>
                    Edit subject
                  </Button>
                </>
              }
            >
              <p className="mb-4 text-sm text-slate-600">{s.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4 font-medium">Topic</th>
                      <th className="py-2 pr-4 text-right font-medium">Weight</th>
                      <th className="py-2 pr-4 text-right font-medium">Target</th>
                      <th className="py-2 pr-4 text-right font-medium">Approved</th>
                      <th className="py-2 pr-4 text-right font-medium">In review</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {s.topics.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 pr-4 text-slate-800">{t.name}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{t.weight ? `${t.weight}%` : "—"}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{t.targetItems || "—"}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{t.approved}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-amber-700">{t.drafts || ""}</td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => { setError(undefined); setTopicDraft({ subjectId: s.id, topic: t, name: t.name, weight: t.weight, targetItems: t.targetItems }); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteTopic(t)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button size="sm" onClick={() => { setError(undefined); setTopicDraft({ subjectId: s.id, name: "", weight: 0, targetItems: 0 }); }}>
                  + Add topic
                </Button>
                {totalWeight > 0 && (
                  <span className={`text-xs ${Math.abs(totalWeight - 100) < 0.01 ? "text-slate-500" : "text-amber-700"}`}>
                    Weights total {totalWeight}%{Math.abs(totalWeight - 100) >= 0.01 && " (should be 100%)"}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {editingSubject && (
        <Modal
          open
          onClose={() => setEditingSubject(null)}
          title={`Edit ${editingSubject.code}`}
          footer={
            <>
              <Button onClick={() => setEditingSubject(null)}>Cancel</Button>
              <Button variant="primary" busy={busy} onClick={saveSubject}>Save</Button>
            </>
          }
        >
          <div className="space-y-4">
            <ErrorBox message={error} />
            <Field label="Short name">
              <input className={inputCls} value={editingSubject.name} onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })} />
            </Field>
            <Field label="PRC coverage" hint="Sent to Claude with every request for this subject.">
              <textarea className={inputCls} rows={4} value={editingSubject.description} onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })} />
            </Field>
            <Field label="Target number of approved items">
              <input className={inputCls} type="number" min={0} value={editingSubject.targetItems} onChange={(e) => setEditingSubject({ ...editingSubject, targetItems: Number(e.target.value) })} />
            </Field>
          </div>
        </Modal>
      )}

      {topicDraft && (
        <Modal
          open
          onClose={() => setTopicDraft(null)}
          title={topicDraft.topic ? "Edit topic" : "Add topic"}
          footer={
            <>
              <Button onClick={() => setTopicDraft(null)}>Cancel</Button>
              <Button variant="primary" busy={busy} onClick={saveTopic}>Save</Button>
            </>
          }
        >
          <div className="space-y-4">
            <ErrorBox message={error} />
            <Field label="Topic name">
              <input className={inputCls} value={topicDraft.name} autoFocus onChange={(e) => setTopicDraft({ ...topicDraft, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Weight (%)" hint="From the TOS, if known.">
                <input className={inputCls} type="number" min={0} max={100} step="0.5" value={topicDraft.weight} onChange={(e) => setTopicDraft({ ...topicDraft, weight: Number(e.target.value) })} />
              </Field>
              <Field label="Target items">
                <input className={inputCls} type="number" min={0} value={topicDraft.targetItems} onChange={(e) => setTopicDraft({ ...topicDraft, targetItems: Number(e.target.value) })} />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
