import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { api } from "../api.ts";

const icons: Record<string, ReactNode> = {
  dashboard: <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />,
  sources: <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z" />,
  blueprint: <path d="M4 5h16v2H4V5Zm0 6h10v2H4v-2Zm0 6h16v2H4v-2Zm14-7 3 2-3 2v-4Z" />,
  generate: <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Zm6 12 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 14ZM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7L5 15Z" />,
  review: <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />,
  bank: <path d="M4 4h16v4H4V4Zm0 6h16v4H4v-4Zm0 6h16v4H4v-4Z" />,
  practice: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 14.5v-9l6 4.5-6 4.5Z" />,
};

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/sources", label: "Source Materials", icon: "sources" },
  { to: "/blueprint", label: "Blueprint", icon: "blueprint" },
  { to: "/generate", label: "Generate", icon: "generate" },
  { to: "/review", label: "Review Queue", icon: "review" },
  { to: "/bank", label: "Question Bank", icon: "bank" },
  { to: "/practice", label: "Practice Exam", icon: "practice" },
];

/** `username` is null when sign-in is turned off; the sign-out footer is hidden then. */
export function Layout({ username, onLogout, children }: { username: string | null; onLogout: () => void; children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState(0);

  useEffect(() => {
    setOpen(false);
    api.get<{ total: number }>("/questions?status=draft&limit=1").then((r) => setDrafts(r.total), () => {});
  }, [location.pathname]);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`
          }
        >
          <svg viewBox="0 0 24 24" className="size-4.5 shrink-0" fill="currentColor" aria-hidden="true">
            {icons[item.icon]}
          </svg>
          <span className="flex-1">{item.label}</span>
          {item.icon === "review" && drafts > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{drafts}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-teal-700 text-white">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden="true">
          <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />
        </svg>
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">PNLE QBank Studio</p>
        <p className="text-xs text-slate-500">Board exam MCQ builder</p>
      </div>
    </div>
  );

  const footer = username && (
    <div className="border-t border-slate-200 px-3 pt-4">
      <p className="text-xs text-slate-500">
        Signed in as <span className="font-medium text-slate-700">{username}</span>
      </p>
      <button type="button" onClick={onLogout} className="mt-1 text-xs font-medium text-teal-700 hover:underline">
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-64 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        {brand}
        <div className="flex-1 overflow-y-auto px-3">{nav}</div>
        {footer}
      </aside>

      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        {brand}
        <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setOpen(!open)} aria-label="Menu">
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" /></svg>
        </button>
      </header>
      {open && (
        <div className="no-print border-b border-slate-200 bg-white px-4 pb-4 lg:hidden">
          {nav}
          <div className="mt-4">{footer}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
