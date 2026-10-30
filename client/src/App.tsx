import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { api } from "./api.ts";
import { Layout } from "./components/Layout.tsx";
import { Loading } from "./components/ui.tsx";
import { Bank } from "./pages/Bank.tsx";
import { Blueprint } from "./pages/Blueprint.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Generate } from "./pages/Generate.tsx";
import { Login } from "./pages/Login.tsx";
import { Practice } from "./pages/Practice.tsx";
import { PracticeRun } from "./pages/PracticeRun.tsx";
import { PrintView } from "./pages/PrintView.tsx";
import { Review } from "./pages/Review.tsx";
import { Sources } from "./pages/Sources.tsx";
import { SubjectsProvider } from "./state.tsx";

type User = { id: number; username: string };
type Auth = { status: "loading" } | { status: "signedOut"; setup: boolean } | { status: "signedIn"; user: User; loginRequired: boolean };

export function App() {
  const [auth, setAuth] = useState<Auth>({ status: "loading" });

  useEffect(() => {
    const check = () =>
      api
        .get<{ loginRequired: boolean; setupRequired: boolean; user: User | null }>("/auth/me")
        .then((r) =>
          setAuth(r.user ? { status: "signedIn", user: r.user, loginRequired: r.loginRequired } : { status: "signedOut", setup: r.setupRequired }),
        )
        .catch(() => setAuth({ status: "signedOut", setup: false }));
    check();
    window.addEventListener("auth:expired", check);
    return () => window.removeEventListener("auth:expired", check);
  }, []);

  if (auth.status === "loading") return <div className="px-8"><Loading /></div>;
  if (auth.status === "signedOut") return <Login setup={auth.setup} onSignedIn={(user) => setAuth({ status: "signedIn", user, loginRequired: true })} />;

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setAuth({ status: "signedOut", setup: false });
  };

  return (
    <SubjectsProvider>
      <Routes>
        <Route path="/print" element={<PrintView />} />
        <Route
          path="*"
          element={
            <Layout username={auth.loginRequired ? auth.user.username : null} onLogout={logout}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sources" element={<Sources />} />
                <Route path="/blueprint" element={<Blueprint />} />
                <Route path="/generate" element={<Generate />} />
                <Route path="/review" element={<Review />} />
                <Route path="/bank" element={<Bank />} />
                <Route path="/practice" element={<Practice />} />
                <Route path="/practice/:id" element={<PracticeRun />} />
                <Route path="*" element={<p className="text-sm text-slate-500">Page not found.</p>} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </SubjectsProvider>
  );
}
