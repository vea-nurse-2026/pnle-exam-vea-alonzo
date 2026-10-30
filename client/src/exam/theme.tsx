import { useEffect, useRef, useState } from "react";

// Appearance for the exam site: a color theme plus an optional "liquid glass" layer on top of it.
// Both live on <html> as data-theme / data-glass (styled in index.css). exam.html applies the saved
// choice before the page renders, so there is no flash of the wrong theme.

export type Theme = "light" | "dark" | "gray";

const THEME_KEY = "pnle-theme";
const GLASS_KEY = "pnle-glass";

const THEMES: { value: Theme; label: string; swatch: [string, string, string] }[] = [
  { value: "light", label: "Light", swatch: ["#f2f8fd", "#ffffff", "#4a8bd0"] },
  { value: "dark", label: "Dark", swatch: ["#0b1120", "#172033", "#8cc4f2"] },
  { value: "gray", label: "Grayscale", swatch: ["#f5f5f5", "#ffffff", "#262626"] },
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
}

function initialTheme(): Theme {
  const saved = read(THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "gray") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme, glass: boolean) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.glass = glass ? "on" : "off";
}

export function ThemeMenu() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [glass, setGlass] = useState(() => read(GLASS_KEY) === "on");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apply(theme, glass);
  }, [theme, glass]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (t: Theme) => {
    setTheme(t);
    write(THEME_KEY, t);
  };
  const toggleGlass = () => {
    setGlass(!glass);
    write(GLASS_KEY, glass ? "off" : "on");
  };
  const current = THEMES.find((t) => t.value === theme)!;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M10 2a8 8 0 1 0 0 16V2Z" />
          <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>
          {current.label}
          {glass && " · Glass"}
        </span>
      </button>

      {open && (
        <div role="dialog" aria-label="Appearance" className="glass-panel absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-surface p-3 shadow-lg">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Theme</p>
          <div className="space-y-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={theme === t.value}
                onClick={() => pick(t.value)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                  theme === t.value ? "bg-teal-50 font-medium text-teal-900" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-black/10" style={{ background: t.swatch[0] }}>
                  <span className="flex size-4 items-center justify-center rounded-sm ring-1 ring-black/5" style={{ background: t.swatch[1] }}>
                    <span className="size-2 rounded-full" style={{ background: t.swatch[2] }} />
                  </span>
                </span>
                <span className="flex-1">{t.label}</span>
                {theme === t.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <button type="button" role="switch" aria-checked={glass} onClick={toggleGlass} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left">
              <span>
                <span className="block text-sm font-medium text-slate-800">Liquid glass</span>
                <span className="block text-xs text-slate-500">Translucent panels for any theme</span>
              </span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${glass ? "bg-primary" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${glass ? "left-4.5" : "left-0.5"}`} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
