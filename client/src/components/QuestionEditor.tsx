import { useEffect, useState } from "react";
import { api, errorMessage } from "../api.ts";
import { useSubjects } from "../state.tsx";
import { BLOOMS, DIFFICULTIES, LETTERS, type Question } from "../types.ts";
import { Button, ErrorBox, Field, inputCls, Modal } from "./ui.tsx";

/** Edits a question's text, key, and tags. Saving re-runs the automatic checks on the server. */
export function QuestionEditor({ question, onClose, onSaved }: { question: Question | null; onClose: () => void; onSaved: (q: Question) => void }) {
  const { subjects } = useSubjects();
  const [form, setForm] = useState<Question | null>(question);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(question);
    setError(undefined);
  }, [question]);

  if (!form) return null;
  const topics = subjects.find((s) => s.id === form.subjectId)?.topics ?? [];
  const set = <K extends keyof Question>(key: K, value: Question[K]) => setForm({ ...form, [key]: value });
  const setAt = (key: "options" | "explanations", i: number, value: string) => {
    const next = [...form[key]];
    next[i] = value;
    set(key, next);
  };

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await api.put<Question>(`/questions/${form.id}`, {
        situation: form.situation,
        stem: form.stem,
        options: form.options,
        correctIndex: form.correctIndex,
        rationale: form.rationale,
        explanations: [0, 1, 2, 3].map((i) => form.explanations[i] ?? ""),
        difficulty: form.difficulty,
        bloom: form.bloom,
        topicId: form.topicId,
      });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Edit question #${form.id}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Situation" hint="Leave empty for a stand-alone item.">
          <textarea className={inputCls} rows={3} value={form.situation} onChange={(e) => set("situation", e.target.value)} />
        </Field>
        <Field label="Stem">
          <textarea className={inputCls} rows={3} value={form.stem} onChange={(e) => set("stem", e.target.value)} />
        </Field>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Options, explanations, and correct answer</p>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`rounded-lg border p-3 ${form.correctIndex === i ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}>
              <div className="flex items-center gap-3">
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <input type="radio" name="correct" className="accent-emerald-600" checked={form.correctIndex === i} onChange={() => set("correctIndex", i)} />
                  {LETTERS[i]}
                </label>
                <input className={inputCls} value={form.options[i] ?? ""} onChange={(e) => setAt("options", i, e.target.value)} placeholder={`Option ${LETTERS[i]}`} />
              </div>
              <input
                className={`${inputCls} mt-2 text-xs`}
                value={form.explanations[i] ?? ""}
                onChange={(e) => setAt("explanations", i, e.target.value)}
                placeholder="Why this option is right or wrong"
              />
            </div>
          ))}
        </div>

        <Field label="Rationale">
          <textarea className={inputCls} rows={3} value={form.rationale} onChange={(e) => set("rationale", e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Topic">
            <select className={inputCls} value={form.topicId ?? ""} onChange={(e) => set("topicId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">No topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select className={inputCls} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Bloom's level">
            <select className={inputCls} value={form.bloom} onChange={(e) => set("bloom", e.target.value)}>
              {BLOOMS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
