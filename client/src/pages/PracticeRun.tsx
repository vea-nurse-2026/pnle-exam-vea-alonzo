import { Link, useParams } from "react-router";
import { api, useApi } from "../api.ts";
import { ExamResults, ExamRunner } from "../components/ExamScreens.tsx";
import { ErrorBox, Loading } from "../components/ui.tsx";
import type { PracticeSession } from "../types.ts";

export function PracticeRun() {
  const { id } = useParams();
  const { data: session, error, setData } = useApi<PracticeSession>(`/practice/${id}`);
  if (error) return <ErrorBox message={error} />;
  if (!session) return <Loading />;
  if (!session.questions.length) return <ErrorBox message="The questions in this session were deleted from the bank." />;

  if (session.finishedAt) {
    return (
      <ExamResults
        session={session}
        back={
          <Link to="/practice" className="text-sm font-medium text-teal-700 hover:underline">
            ← Back to practice
          </Link>
        }
      />
    );
  }
  return (
    <ExamRunner
      session={session}
      onChoose={async (questionId, choice) => setData(await api.post<PracticeSession>(`/practice/${session.id}/answer`, { questionId, choice }))}
      onSubmit={async () => setData(await api.post<PracticeSession>(`/practice/${session.id}/submit`))}
    />
  );
}
