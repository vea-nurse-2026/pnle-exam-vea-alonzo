import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "./api.ts";
import type { Subject } from "./types.ts";

interface SubjectsState {
  subjects: Subject[];
  reload: () => void;
  setSubjects: (s: Subject[]) => void;
}

const SubjectsContext = createContext<SubjectsState>({ subjects: [], reload: () => {}, setSubjects: () => {} });

/** The blueprint (subjects and topics) is used on almost every page, so it is loaded once here. */
export function SubjectsProvider({ children }: { children: ReactNode }) {
  const { data, reload, setData } = useApi<Subject[]>("/subjects");
  return <SubjectsContext.Provider value={{ subjects: data ?? [], reload, setSubjects: setData }}>{children}</SubjectsContext.Provider>;
}

export const useSubjects = () => useContext(SubjectsContext);
