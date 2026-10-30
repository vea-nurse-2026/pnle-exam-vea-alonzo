import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api.ts";
import { Button, ErrorBox, Field, inputCls } from "../components/ui.tsx";

export function Login({ setup, onSignedIn }: { setup: boolean; onSignedIn: (user: { id: number; username: string }) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (setup && password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const { user } = await api.post<{ user: { id: number; username: string } }>(setup ? "/auth/setup" : "/auth/login", { username, password });
      onSignedIn(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-teal-700 text-white">
          <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
            <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />
          </svg>
        </span>
        <h1 className="text-xl font-semibold text-slate-900">{setup ? "Create the admin account" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {setup ? "First run: this account will manage sources, questions, and reviews." : "PNLE QBank Studio"}
        </p>

        <div className="mt-6 space-y-4">
          <ErrorBox message={error} />
          <Field label="Username">
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </Field>
          <Field label="Password" hint={setup ? "At least 8 characters." : undefined}>
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={setup ? "new-password" : "current-password"}
              required
            />
          </Field>
          {setup && (
            <Field label="Confirm password">
              <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </Field>
          )}
          <Button type="submit" variant="primary" className="w-full" busy={busy}>
            {setup ? "Create account" : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  );
}
