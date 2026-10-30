import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${url}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/auth/")) window.dispatchEvent(new Event("auth:expired"));
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Builds a query string, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Fetches `url` (skipped when null) and refetches whenever it changes or `reload` is called. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(Boolean(url));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let live = true;
    setLoading(true);
    api.get<T>(url).then(
      (d) => {
        if (!live) return;
        setData(d);
        setError(undefined);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setError(errorMessage(e));
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Server timestamps are UTC "YYYY-MM-DD HH:MM:SS" or ISO strings. */
export function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
