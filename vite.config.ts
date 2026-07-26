import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
// analyzeCoverLetter는 요청 시점에 dynamic import (HMR 무한 재평가 방지)

const PROJECT_ROOT = import.meta.dirname;
const IS_VITEST = process.env.VITEST === "true";
function apiRoute(pathname: string) {
  if (pathname === "/api/analyze") return { file: "api/analyze.js", query: {} };
  if (pathname === "/api/auth/me") return { file: "api/auth/me.js", query: {} };
  if (pathname === "/api/feedback") return { file: "api/feedback.js", query: {} };
  if (pathname === "/api/projects") return { file: "api/projects.js", query: {} };
  if (pathname.startsWith("/api/admin/")) {
    return {
      file: "api/admin/[...route].js",
      query: { route: pathname.slice("/api/admin/".length).split("/").filter(Boolean) },
    };
  }
  if (pathname === "/api/account/deletion") return { file: "api/account/deletion.js", query: {} };
  if (pathname === "/api/account/deletion/cancel") return { file: "api/account/deletion/cancel.js", query: {} };

  const projectAnalysis = pathname.match(/^\/api\/projects\/([^/]+)\/analyses$/);
  if (projectAnalysis) return { file: "api/projects/[projectId]/analyses.js", query: { projectId: projectAnalysis[1] } };

  const project = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (project) return { file: "api/projects/[projectId]/index.js", query: { projectId: project[1] } };

  const analysis = pathname.match(/^\/api\/analysis\/([^/]+)$/);
  if (analysis) return { file: "api/analysis/[id].js", query: { id: analysis[1] } };

  return null;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!body) return resolve(undefined);
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
  });
}

/** Routes Vite development traffic through exactly the Vercel API modules. */
function vitePluginApi(): Plugin {
  return {
    name: "dev-api-server",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url ?? "/", "http://localhost");
        const route = apiRoute(requestUrl.pathname);
        if (!route) return next();

        try {
          const body = await readJsonBody(req);
          const handlerUrl = pathToFileURL(path.join(PROJECT_ROOT, route.file)).href;
          const { default: handler } = await import(handlerUrl);
          const response = {
            json(payload: unknown) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(payload));
              return this;
            },
            setHeader(name: string, value: string | number) {
              res.setHeader(name, value);
              return this;
            },
            status(code: number) {
              res.statusCode = code;
              return this;
            },
          };

          await handler(
            {
              body,
              headers: req.headers,
              method: req.method,
              query: { ...Object.fromEntries(requestUrl.searchParams.entries()), ...route.query },
              url: req.url,
            },
            response,
          );
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "INVALID_REQUEST" }));
        }
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginApi()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: IS_VITEST ? PROJECT_ROOT : path.resolve(import.meta.dirname, "client"),
  test: {
    // Unit tests import the browser auth client but must never require a real
    // Supabase project URL or publishable key. Vite only applies these values
    // under Vitest; Preview and Production still require their real variables.
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.invalid",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
