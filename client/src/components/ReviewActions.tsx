import { useState } from "react";
import { useNavigate } from "react-router";
import { api, errorMessage } from "../api.ts";
import type { Job, Question } from "../types.ts";
import { QuestionEditor } from "./QuestionEditor.tsx";
import { Button, ReasonModal, useToast } from "./ui.tsx";

/** Approve / edit / reject / regenerate buttons for one question, with their dialogs. */
export function ReviewActions({ q, onUpdated, size = "md" }: { q: Question; onUpdated: (q: Question) => void; size?: "sm" | "md" }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<"reject" | "regenerate" | null>(null);

  async function review(action: "approve" | "reject" | "retire" | "restore", reason = "") {
    setBusy(action);
    try {
      const updated = await api.post<Question>(`/questions/${q.id}/review`, { action, reason });
      onUpdated(updated);
      toast({ approve: "Approved", reject: "Rejected", retire: "Retired from the bank", restore: "Moved back to review" }[action]);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(undefined);
    }
  }

  async function regenerate(reason: string) {
    try {
      const job = await api.post<Job>(`/questions/${q.id}/regenerate`, { reason });
      onUpdated({ ...q, status: "rejected" });
      setAsking(null);
      toast("Writing a replacement…");
      navigate(`/generate?job=${job.id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const canRegenerate = !q.isSample;

  return (
    <>
      {q.status === "draft" && (
        <Button size={size} variant="success" busy={busy === "approve"} onClick={() => review("approve")}>
          Approve
        </Button>
      )}
      <Button size={size} onClick={() => setEditing(true)}>
        Edit
      </Button>
      {q.status === "draft" && (
        <Button size={size} variant="danger" onClick={() => setAsking("reject")}>
          Reject
        </Button>
      )}
      {canRegenerate && q.status !== "approved" && (
        <Button size={size} variant="ghost" onClick={() => setAsking("regenerate")}>
          Reject &amp; regenerate
        </Button>
      )}
      {q.status === "approved" && (
        <Button size={size} variant="ghost" busy={busy === "retire"} onClick={() => review("retire")}>
          Retire
        </Button>
      )}
      {(q.status === "rejected" || q.status === "retired" || q.status === "approved") && (
        <Button size={size} variant="ghost" busy={busy === "restore"} onClick={() => review("restore")}>
          Back to review
        </Button>
      )}

      {editing && (
        <QuestionEditor
          question={q}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onUpdated(saved);
            toast(saved.warnings.length ? "Saved — some checks still flag this item" : "Saved");
          }}
        />
      )}
      <ReasonModal
        open={asking === "reject"}
        title="Reject question"
        label="What's wrong with it?"
        confirmLabel="Reject"
        onCancel={() => setAsking(null)}
        onConfirm={async (reason) => {
          await review("reject", reason);
          setAsking(null);
        }}
      />
      <ReasonModal
        open={asking === "regenerate"}
        title="Reject and write a replacement"
        label="What should the replacement fix?"
        confirmLabel="Regenerate"
        onCancel={() => setAsking(null)}
        onConfirm={regenerate}
      />
    </>
  );
}
