import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../components/ui.tsx";
import "../index.css";
import { ExamApp } from "./ExamApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <ExamApp />
    </ToastProvider>
  </StrictMode>,
);
