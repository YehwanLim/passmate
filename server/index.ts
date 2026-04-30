import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json());

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { questions, content, company, jobKeyword } = req.body;
      
      // 새 형식(questions[]) 또는 이전 형식(content string) 지원
      if (!questions && (!content || typeof content !== "string")) {
        return res.status(400).json({ error: "questions 또는 content가 필요합니다." });
      }

      const { analyzeCoverLetter } = await import("./api/analyze.js");
      
      const input = questions 
        ? { questions, company, jobKeyword }
        : content;
      
      const result = await analyzeCoverLetter(input);
      
      res.json(result);
    } catch (error: any) {
      console.error("Analyze error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Gemini API 핑 테스트
  app.get("/api/test-gemini", async (_req, res) => {
    try {
      // Raw fetch mode
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ ok: false, error: "GEMINI_API_KEY가 .env에 설정되지 않았습니다." });
      }
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const apiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "안녕 제미나이? 한 줄로 짧게 대답해." }] }]
        })
      });

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        throw new Error(`API Error ${apiRes.status}: ${errorText}`);
      }

      const data = await apiRes.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "(응답 없음)";
      console.log("[test-gemini] 응답:", text);
      res.json({ ok: true, reply: text });
    } catch (error: any) {
      console.error("[test-gemini] 실패:", error.message);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
