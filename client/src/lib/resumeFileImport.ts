import { getAuthorizationHeader } from "@/lib/apiAuth";

export type ResumeImportPair = { question: string; answer: string };
export type ResumeFileKind = "pdf" | "docx" | "doc" | "hwp" | "unknown";

export class ResumeImportError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const MAX_PAIRS = 5;
const MAX_QUESTION_CHARS = 300;

// "1. 질문" / "2) 질문" — 본문 속 번호 목록과 구분하기 위해 뒤에서 길이·어미 검사를 거친다.
const NUMBERED_HEADER = /^(\d{1,2})\s*[.)]\s*(.*)$/;
// "Q1. 질문" / "q2) 질문"
const Q_HEADER = /^[Qq]\s*\d{1,2}\s*[.)\]:]?\s*(.*)$/;
// "[문항 1] 질문" / "문제 2. 질문"
const MUNHANG_HEADER = /^\[?\s*(?:문항|문제)\s*\d{1,2}\s*[\].):]*\s*(.*)$/;

function detectQuestionHeader(line: string): string | null {
  if (!line) return null;

  const munhang = line.match(MUNHANG_HEADER);
  if (munhang) return munhang[1].trim();

  const qStyle = line.match(Q_HEADER);
  if (qStyle) return qStyle[1].trim();

  const numbered = line.match(NUMBERED_HEADER);
  if (numbered) {
    const rest = numbered[2].trim();
    // 짧은 줄이거나 물음형으로 끝나야 문항으로 본다. 긴 서술형 줄은 본문 속 목록.
    if (rest.length <= 200 || /[?？]\s*$/.test(rest)) return rest;
    return null;
  }

  // 단독 줄이 물음표로 끝나면 문항 경계로 본다.
  if (line.length <= 150 && /[?？]$/.test(line)) return line;

  return null;
}

/** 추출된 통짜 텍스트를 최대 5쌍의 질문/답변으로 나누는 휴리스틱. */
export function splitResumeText(text: string): ResumeImportPair[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const preamble: string[] = [];
  const sections: { question: string; answerLines: string[] }[] = [];

  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = detectQuestionHeader(line);
    if (header !== null) {
      sections.push({ question: header.slice(0, MAX_QUESTION_CHARS), answerLines: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].answerLines.push(line);
    } else if (line) {
      preamble.push(line);
    }
  }

  if (sections.length === 0) {
    return [{ question: "", answer: trimmed }];
  }

  const pairs = sections.map(section => ({
    question: section.question,
    answer: section.answerLines.join("\n").trim(),
  }));

  if (preamble.length > 0) {
    pairs[0].answer = [preamble.join("\n"), pairs[0].answer]
      .filter(Boolean)
      .join("\n");
  }

  if (pairs.length > MAX_PAIRS) {
    const overflow = pairs
      .slice(MAX_PAIRS)
      .map(pair => [pair.question, pair.answer].filter(Boolean).join("\n"))
      .join("\n");
    const last = pairs[MAX_PAIRS - 1];
    last.answer = [last.answer, overflow].filter(Boolean).join("\n");
    return pairs.slice(0, MAX_PAIRS);
  }

  return pairs;
}

export function getResumeFileKind(fileName: string): ResumeFileKind {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (fileName.indexOf(".") < 0) return "unknown";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "doc") return "doc";
  if (extension === "hwp") return "hwp";
  return "unknown";
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items) {
        if ("str" in item) {
          pageText += item.str;
          pageText += item.hasEOL ? "\n" : "";
        }
      }
      pages.push(pageText);
    }
    return pages.join("\n");
  } finally {
    await loadingTask.destroy();
  }
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value ?? "";
}

/** PDF/Word 파일에서 텍스트를 추출한다. 전 과정이 브라우저 안에서 처리된다. */
export async function extractTextFromFile(file: File): Promise<string> {
  const kind = getResumeFileKind(file.name);
  if (kind === "doc") {
    throw new ResumeImportError(
      "DOC_UNSUPPORTED",
      "구형 .doc 형식은 지원하지 않아요. Word에서 .docx로 다시 저장한 뒤 올려 주세요."
    );
  }
  if (kind === "hwp") {
    throw new ResumeImportError(
      "HWP_UNSUPPORTED",
      "한글(.hwp) 파일은 지원하지 않아요. 한글에서 PDF로 저장한 뒤 올려 주세요."
    );
  }
  if (kind === "unknown") {
    throw new ResumeImportError(
      "UNSUPPORTED_FILE",
      "PDF 또는 Word(.docx) 파일만 올릴 수 있어요."
    );
  }

  let text: string;
  try {
    text = kind === "pdf" ? await extractPdfText(file) : await extractDocxText(file);
  } catch {
    throw new ResumeImportError(
      "EXTRACTION_FAILED",
      "파일에서 텍스트를 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요."
    );
  }

  if (!text.trim()) {
    throw new ResumeImportError(
      "EMPTY_TEXT",
      "파일에서 글자를 찾지 못했어요. 스캔·이미지 PDF는 텍스트 추출이 되지 않아요."
    );
  }
  return text;
}

function isValidPair(value: unknown): value is ResumeImportPair {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ResumeImportPair).question === "string" &&
    typeof (value as ResumeImportPair).answer === "string"
  );
}

type RequestAiSplitOptions = {
  fetchFn?: typeof fetch;
  getAuth?: () => Promise<Record<string, string>>;
};

/** 서버의 Gemini 문항 분리를 요청한다. 실패 시 예외 — 호출부는 휴리스틱으로 폴백한다. */
export async function requestAiSplit(
  text: string,
  { fetchFn = fetch, getAuth = getAuthorizationHeader }: RequestAiSplitOptions = {}
): Promise<ResumeImportPair[]> {
  const authorization = await getAuth();
  const response = await fetchFn("/api/analyze/split", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorization },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new ResumeImportError("SPLIT_FAILED", "AI 문항 분리에 실패했어요.");
  }
  const payload = (await response.json()) as { questions?: unknown };
  if (!Array.isArray(payload.questions) || !payload.questions.every(isValidPair)) {
    throw new ResumeImportError("SPLIT_FAILED", "AI 문항 분리 응답이 올바르지 않아요.");
  }
  return payload.questions;
}
