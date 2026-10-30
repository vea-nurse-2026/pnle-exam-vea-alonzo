import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// In dev, "/" would otherwise serve the studio's index.html (it lives in the same folder).
// Serve the exam page there instead, matching the "/" rewrite in vercel.json.
const examAtRoot: Plugin = {
  name: "exam-at-root",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/" || req.url === "/index.html" || req.url?.startsWith("/?")) req.url = "/exam.html" + (req.url.split("?")[1] ? `?${req.url.split("?")[1]}` : "");
      next();
    });
  },
};

// The static online exam site (deployed to Vercel). Its question bank, exam-public/questions.json,
// is written by `npm run publish:exam` in the studio.
export default defineConfig({
  plugins: [examAtRoot, react(), tailwindcss()],
  publicDir: "exam-public",
  build: {
    outDir: "dist-exam",
    rollupOptions: { input: "exam.html" },
  },
  server: { port: 5191, strictPort: true, open: "/" },
});
