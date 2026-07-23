# Authenticated Analysis Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비로그인 사용자는 분석을 실행할 수 없고, 로그인 후 무료 분석 화면으로 자동 복귀하게 한다.

**Architecture:** `/api/analyze`를 인증 검증의 단일 진입점으로 삼고, Vercel·Vite·Express 실행 경로 모두 같은 처리기를 호출한다. 클라이언트는 분석 진입을 인증으로 보호하고 Supabase access token을 분석 요청에 전달하며, 로그인 카드는 무료 이용 조건을 명확히 안내한다.

**Tech Stack:** React 19, TypeScript, Wouter, Supabase Auth, Vite, Express, Vercel Functions, Vitest

## Global Constraints

- 비로그인으로 `/analyze`에 직접 접근해도 `/login?redirect=/analyze`로 이동해야 한다.
- 인증 판별 중에는 분석 폼과 실행 버튼을 보이지 않는다.
- 로그인 화면에는 정확히 `로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.`라는 안내를 포함한다.
- 분석 요청은 `Authorization: Bearer <access token>`을 전달한다.
- 토큰이 없거나 유효하지 않은 분석 API 요청은 AI 모델 호출 전에 `401 { error: "Unauthorized" }`로 끝난다.
- Vercel 함수, Vite 개발 미들웨어, Express 프로덕션 서버는 동일한 API 처리기를 사용한다.
- 기존 사용자 변경사항과 무관한 파일은 스테이징하거나 수정하지 않는다.

---

### Task 1: 분석 API의 인증 경계 추가

**Files:**
- Create: `tests/api/analyze-auth.test.js`
- Modify: `api/analyze.js:1-490`

**Interfaces:**
- Consumes: `requireAuthenticatedUser(req)` from `lib/auth.js`; missing `Authorization` 헤더에는 `null`을 반환한다.
- Produces: `POST /api/analyze`가 인증되지 않은 요청에 `{ error: "Unauthorized" }`와 HTTP 401을 반환한다.

- [ ] **Step 1: 인증 없는 분석 요청의 실패 테스트를 작성한다.**

Create `tests/api/analyze-auth.test.js`:

```js
import { describe, expect, it } from "vitest";
import analyzeHandler from "../../api/analyze.js";

function createResponse() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    end() {},
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

describe("analyze API authentication", () => {
  it("rejects an unauthenticated request before analysis input is processed", async () => {
    const response = createResponse();

    await analyzeHandler(
      {
        body: { questions: [{ question: "문항", answer: "가".repeat(200) }] },
        headers: {},
        method: "POST",
      },
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(response.headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});
```

- [ ] **Step 2: 테스트가 현재 게스트 요청을 허용해 실패하는지 확인한다.**

Run: `pnpm exec vitest run tests/api/analyze-auth.test.js`

Expected: FAIL because the handler currently tries to process the supplied input instead of returning 401.

- [ ] **Step 3: API 처리기에 인증 검증을 추가한다.**

At the imports in `api/analyze.js`, add:

```js
import { requireAuthenticatedUser } from "../lib/auth.js";
```

Replace the entire default handler in `api/analyze.js` with:

```js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = req.body;
    const input = payload?.questions ? payload : payload?.content;
    if (!input) {
      return res.status(400).json({ error: "questions 또는 content가 필요합니다." });
    }

    if (input.questions && Array.isArray(input.questions)) {
      input.questions = input.questions.map((question) => ({
        question: sanitizeInput(question.question || ""),
        answer: sanitizeInput(question.answer || ""),
      }));
      if (input.company) input.company = sanitizeInput(input.company);
      if (input.jobKeyword) input.jobKeyword = sanitizeInput(input.jobKeyword);

      const totalChars = input.questions.reduce(
        (sum, question) => sum + (question.answer?.length || 0),
        0,
      );
      if (totalChars < 200) {
        return res.status(400).json({
          error: "CHAR_MINIMUM",
          message: "최소 200자 이상 입력해야 분석할 수 있습니다.",
        });
      }
      if (totalChars > 6000) {
        return res.status(400).json({
          error: "CHAR_OVER_LIMIT",
          message: "글자 수 제한(6,000자)을 초과했습니다.",
        });
      }
      if (!input.questions.some((question) => question.answer && question.answer.trim().length > 0)) {
        return res.status(400).json({
          error: "EMPTY_CONTENT",
          message: "답변 내용을 입력해 주세요.",
        });
      }
    }

    const result = await analyzeCoverLetter(input);
    if (result.error === "CONTEXT_IRRELEVANT") {
      return res.status(400).json(result);
    }
    if (result.error === "RATE_LIMIT") {
      return res.status(429).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("API Error:", error);
    const errorResponse = getAnalyzeApiErrorResponse(error);
    return res.status(errorResponse.status).json(errorResponse.body);
  }
}
```

The authentication check occurs before `payload` validation and `analyzeCoverLetter(input)`.

- [ ] **Step 4: 인증 테스트와 기존 API 오류 테스트를 통과시킨다.**

Run: `pnpm exec vitest run tests/api/analyze-auth.test.js tests/api/analyze-error.test.js`

Expected: both files pass.

- [ ] **Step 5: 이 작업 파일만 커밋한다.**

```bash
git add api/analyze.js tests/api/analyze-auth.test.js
git commit -m "feat: require authentication for analysis API"
```

### Task 2: 모든 런타임이 인증된 분석 처리기를 사용하게 통합

**Files:**
- Create: `tests/api/analyze-runtime-routing.test.js`
- Modify: `vite.config.ts:501-543`
- Modify: `server/index.ts:15-39`

**Interfaces:**
- Consumes: `api/analyze.js`의 default handler `(req, res) => Promise<void>`.
- Produces: Vite와 Express의 `/api/analyze` 경로가 원본 `headers`, `body`, `method`를 같은 처리기에 전달한다.

- [ ] **Step 1: 개발·프로덕션 경로가 공통 처리기를 쓰는 계약 테스트를 작성한다.**

Create `tests/api/analyze-runtime-routing.test.js`:

```js
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../../server/index.ts", import.meta.url), "utf8");

describe("analysis runtime routing", () => {
  it("forwards Vite requests and their authorization headers to the Vercel handler", () => {
    expect(viteSource).toContain('path.join(PROJECT_ROOT, "api", "analyze.js")');
    expect(viteSource).toContain("headers: req.headers");
    expect(viteSource).toContain('req.method !== "POST" && req.method !== "OPTIONS"');
    expect(viteSource).not.toContain('import("./server/api/analyze")');
  });

  it("delegates the Express route to the Vercel handler", () => {
    expect(serverSource).toContain('default: analyzeHandler');
    expect(serverSource).toContain("return analyzeHandler(req, res)");
    expect(serverSource).not.toContain("analyzeCoverLetter");
  });
});
```

- [ ] **Step 2: 테스트가 현재 런타임별 직접 호출 때문에 실패하는지 확인한다.**

Run: `pnpm exec vitest run tests/api/analyze-runtime-routing.test.js`

Expected: FAIL because Vite imports `server/api/analyze` directly and Express calls `analyzeCoverLetter` directly.

- [ ] **Step 3: Vite 미들웨어를 공통 처리기 어댑터로 교체한다.**

Replace the current `/api/analyze` middleware in `vite.config.ts` with:

```ts
server.middlewares.use("/api/analyze", (req, res, next) => {
  if (req.method !== "POST" && req.method !== "OPTIONS") return next();

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const handlerUrl = pathToFileURL(
        path.join(PROJECT_ROOT, "api", "analyze.js"),
      ).href;
      const { default: handler } = await import(`${handlerUrl}?t=${Date.now()}`);
      const response = {
        end() {
          res.end();
        },
        json(payload: unknown) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        },
        setHeader(name: string, value: string) {
          res.setHeader(name, value);
        },
        status(code: number) {
          res.statusCode = code;
          return this;
        },
      };

      await handler(
        {
          body: body ? JSON.parse(body) : undefined,
          headers: req.headers,
          method: req.method,
          url: req.url,
        },
        response,
      );
    } catch (error: any) {
      console.error("[api/analyze] failed:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message || "Internal server error" }));
    }
  });
});
```

- [ ] **Step 4: Express 경로가 공통 처리기에 위임하게 교체한다.**

Replace the current `app.post("/api/analyze", ...)` body in `server/index.ts` with:

```ts
app.post("/api/analyze", async (req, res) => {
  const { default: analyzeHandler } = await import("../api/analyze.js");
  return analyzeHandler(req, res);
});
```

Do not retain the previous early body validation or `analyzeCoverLetter` import; the common handler owns both validation and error responses.

- [ ] **Step 5: 런타임 통합 계약과 API 인증 테스트를 통과시킨다.**

Run: `pnpm exec vitest run tests/api/analyze-runtime-routing.test.js tests/api/analyze-auth.test.js`

Expected: both files pass.

- [ ] **Step 6: 이 작업 파일만 커밋한다.**

```bash
git add server/index.ts tests/api/analyze-runtime-routing.test.js vite.config.ts
git commit -m "refactor: share authenticated analysis handler"
```

### Task 3: 분석 화면 보호, 로그인 복귀, 무료 안내 추가

**Files:**
- Create: `client/src/hooks/useRequireAuth.test.ts`
- Create: `client/src/pages/analyzeAuthAccess.test.ts`
- Modify: `client/src/hooks/useRequireAuth.ts:1-35`
- Modify: `client/src/pages/Analyze.tsx:1-820`
- Modify: `client/src/pages/Login.tsx:95-107`

**Interfaces:**
- Produces: `getLoginRedirectPath(redirectPath?: string): string`; `useRequireAuth({ redirectPath?: string })`.
- Consumes: `supabase.auth.getSession()` from `client/src/lib/supabase.ts`; successful sessions expose `access_token`.

- [ ] **Step 1: 로그인 복귀 경로와 분석 접근 계약의 실패 테스트를 작성한다.**

Create `client/src/hooks/useRequireAuth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getLoginRedirectPath } from "./useRequireAuth";

describe("getLoginRedirectPath", () => {
  it("keeps the requested protected route as an encoded login redirect", () => {
    expect(getLoginRedirectPath("/analyze")).toBe("/login?redirect=%2Fanalyze");
  });

  it("uses the regular login route when no return path is requested", () => {
    expect(getLoginRedirectPath()).toBe("/login");
  });
});
```

Create `client/src/pages/analyzeAuthAccess.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");

describe("analysis authentication access", () => {
  it("guards the analysis route and attaches the Supabase access token", () => {
    expect(analyzeSource).toContain('useRequireAuth({ redirectPath: "/analyze" })');
    expect(analyzeSource).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(analyzeSource).toContain("if (response.status === 401)");
    expect(analyzeSource).toContain('navigate("/login?redirect=/analyze")');
  });

  it("tells users that logging in enables free analysis", () => {
    expect(loginSource).toContain("로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.");
  });
});
```

- [ ] **Step 2: 새 테스트가 보호 훅과 로그인 문구 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run client/src/hooks/useRequireAuth.test.ts client/src/pages/analyzeAuthAccess.test.ts`

Expected: FAIL because `getLoginRedirectPath`와 분석 인증 계약, 무료 안내 문구가 아직 없다.

- [ ] **Step 3: 재사용 가능한 로그인 복귀 경로를 훅에 추가한다.**

Replace `client/src/hooks/useRequireAuth.ts` with:

```ts
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

type RequireAuthOptions = {
  redirectPath?: string;
};

export function getLoginRedirectPath(redirectPath?: string): string {
  return redirectPath ? `/login?redirect=${encodeURIComponent(redirectPath)}` : "/login";
}

export function useRequireAuth(options: RequireAuthOptions = {}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(getLoginRedirectPath(options.redirectPath));
    }
  }, [isLoading, isAuthenticated, navigate, options.redirectPath]);

  return { user, isLoading, isAuthenticated };
}
```

- [ ] **Step 4: 분석 화면을 보호하고 인증 토큰을 전송한다.**

In `client/src/pages/Analyze.tsx`, replace the authentication import with:

```ts
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/lib/supabase";
```

Replace `const { user } = useAuth();` with:

```ts
const { user, isLoading: authLoading, isAuthenticated } = useRequireAuth({
  redirectPath: "/analyze",
});
```

Immediately before the final `return (` of the `Analyze` component, add:

```tsx
if (authLoading || !isAuthenticated) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}
```

At the start of `executeSubmit`, before `setIsLoading(true)`, retrieve the session and redirect if it is absent:

```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  navigate("/login?redirect=/analyze");
  return;
}
```

Use this exact header object in the existing `fetch("/api/analyze", ...)` call:

```ts
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${session.access_token}`,
},
```

Immediately after receiving the fetch response and before the 429 branch, add:

```ts
if (response.status === 401) {
  navigate("/login?redirect=/analyze");
  return;
}
```

Do not move the existing duplicate check, character-limit logic, timeout cleanup, analytics events, or error modal branches.

- [ ] **Step 5: 로그인 카드에 무료 분석 안내를 넣는다.**

In the existing explanatory paragraph in `client/src/pages/Login.tsx`, use this exact copy:

```tsx
<p className="text-[14px] text-gray-400 text-center mb-8 leading-relaxed">
  Google 계정으로 간편하게 로그인하고
  <br />
  로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.
</p>
```

- [ ] **Step 6: 클라이언트 회귀 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm exec vitest run client/src/hooks/useRequireAuth.test.ts client/src/pages/analyzeAuthAccess.test.ts client/src/pages/analyzeErrorMessage.test.ts && pnpm check`

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 7: 이 작업 파일만 커밋한다.**

```bash
git add client/src/hooks/useRequireAuth.ts client/src/hooks/useRequireAuth.test.ts client/src/pages/Analyze.tsx client/src/pages/Login.tsx client/src/pages/analyzeAuthAccess.test.ts
git commit -m "feat: require login before resume analysis"
```

### Task 4: 전체 변경 검증

**Files:**
- Modify: no production files

**Interfaces:**
- Consumes: Tasks 1–3의 API 인증, 런타임 통합, 클라이언트 접근 제어.
- Produces: 전체 테스트·타입 검사·프로덕션 빌드가 성공한 검증 기록.

- [ ] **Step 1: 전체 관련 테스트를 실행한다.**

Run:

```bash
pnpm exec vitest run \
  tests/api/analyze-auth.test.js \
  tests/api/analyze-error.test.js \
  tests/api/analyze-runtime-routing.test.js \
  client/src/hooks/useRequireAuth.test.ts \
  client/src/pages/analyzeAuthAccess.test.ts \
  client/src/pages/analyzeErrorMessage.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: 타입 검사와 프로덕션 빌드를 실행한다.**

Run: `pnpm check && pnpm build`

Expected: both commands exit 0.

- [ ] **Step 3: 의도한 변경만 남았는지 확인한다.**

Run: `git status --short && git diff --check HEAD`

Expected: this feature's committed files are clean; pre-existing user changes remain untouched and are not staged.
