import { describe, expect, it } from "vitest";
import {
  getResumeFileKind,
  requestAiSplit,
  splitResumeText,
} from "./resumeFileImport";

describe("splitResumeText", () => {
  it("빈 텍스트는 빈 배열을 돌려준다", () => {
    expect(splitResumeText("")).toEqual([]);
    expect(splitResumeText("   \n\n  ")).toEqual([]);
  });

  it("번호 매긴 문항을 질문과 답변 쌍으로 나눈다", () => {
    const text = [
      "1. 지원동기를 작성해 주세요. (500자)",
      "저는 어릴 때부터 소프트웨어에 관심이 많았습니다.",
      "그래서 이 회사에 지원했습니다.",
      "2. 입사 후 포부를 작성해 주세요.",
      "입사 후에는 최고의 엔지니어가 되겠습니다.",
    ].join("\n");

    expect(splitResumeText(text)).toEqual([
      {
        question: "지원동기를 작성해 주세요. (500자)",
        answer:
          "저는 어릴 때부터 소프트웨어에 관심이 많았습니다.\n그래서 이 회사에 지원했습니다.",
      },
      {
        question: "입사 후 포부를 작성해 주세요.",
        answer: "입사 후에는 최고의 엔지니어가 되겠습니다.",
      },
    ]);
  });

  it("Q 표기 문항을 나눈다", () => {
    const text = [
      "Q1. 성장 과정을 말해 주세요.",
      "성실하게 자랐습니다.",
      "Q2) 갈등 해결 경험은?",
      "팀 프로젝트에서 조율했습니다.",
    ].join("\n");

    expect(splitResumeText(text)).toEqual([
      { question: "성장 과정을 말해 주세요.", answer: "성실하게 자랐습니다." },
      { question: "갈등 해결 경험은?", answer: "팀 프로젝트에서 조율했습니다." },
    ]);
  });

  it("[문항 N] 표기 문항을 나눈다", () => {
    const text = [
      "[문항 1] 직무 역량을 기술하시오.",
      "역량이 많습니다.",
      "[문항 2] 협업 경험을 기술하시오.",
      "협업을 잘합니다.",
    ].join("\n");

    expect(splitResumeText(text)).toEqual([
      { question: "직무 역량을 기술하시오.", answer: "역량이 많습니다." },
      { question: "협업 경험을 기술하시오.", answer: "협업을 잘합니다." },
    ]);
  });

  it("물음표로 끝나는 짧은 단독 줄을 문항 경계로 본다", () => {
    const text = [
      "가장 힘들었던 경험은 무엇인가요?",
      "수험 생활이 힘들었습니다.",
      "그 경험에서 무엇을 배웠나요?",
      "끈기를 배웠습니다.",
    ].join("\n");

    expect(splitResumeText(text)).toEqual([
      { question: "가장 힘들었던 경험은 무엇인가요?", answer: "수험 생활이 힘들었습니다." },
      { question: "그 경험에서 무엇을 배웠나요?", answer: "끈기를 배웠습니다." },
    ]);
  });

  it("패턴이 없으면 전체를 답변 하나로 담고 질문은 비워 둔다", () => {
    const text = "저는 성실한 사람입니다.\n항상 최선을 다합니다.";
    expect(splitResumeText(text)).toEqual([
      { question: "", answer: "저는 성실한 사람입니다.\n항상 최선을 다합니다." },
    ]);
  });

  it("첫 문항 앞에 있는 머리말 텍스트는 버리지 않고 첫 답변 앞에 붙인다", () => {
    const text = ["홍길동 자기소개서", "1. 지원동기", "열심히 하겠습니다."].join("\n");
    const result = splitResumeText(text);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("지원동기");
    expect(result[0].answer).toContain("열심히 하겠습니다.");
  });

  it("문항이 5개를 넘으면 초과분을 다섯 번째 답변에 합친다", () => {
    const text = Array.from({ length: 7 }, (_, i) =>
      [`${i + 1}. 질문 ${i + 1}`, `답변 ${i + 1}`].join("\n")
    ).join("\n");

    const result = splitResumeText(text);
    expect(result).toHaveLength(5);
    expect(result[4].answer).toContain("답변 5");
    expect(result[4].answer).toContain("질문 6");
    expect(result[4].answer).toContain("답변 7");
  });

  it("질문은 300자로 자른다", () => {
    const longQuestion = `1. ${"가".repeat(400)}?`;
    const result = splitResumeText(`${longQuestion}\n답변입니다.`);
    expect(result[0].question.length).toBeLessThanOrEqual(300);
    expect(result[0].answer).toBe("답변입니다.");
  });

  it("본문 문장 속 번호 목록(짧지 않은 줄)은 문항으로 오인하지 않는다", () => {
    const longBody = `1. 저는 다음과 같은 성과를 냈습니다. ${"성과 내용을 길게 서술합니다. ".repeat(20)}`;
    const result = splitResumeText(longBody);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("");
  });
});

describe("getResumeFileKind", () => {
  it("확장자로 파일 종류를 판별한다 (대소문자 무시)", () => {
    expect(getResumeFileKind("자소서.pdf")).toBe("pdf");
    expect(getResumeFileKind("resume.DOCX")).toBe("docx");
    expect(getResumeFileKind("old.doc")).toBe("doc");
    expect(getResumeFileKind("한글문서.hwp")).toBe("hwp");
    expect(getResumeFileKind("image.png")).toBe("unknown");
    expect(getResumeFileKind("noextension")).toBe("unknown");
  });
});

describe("requestAiSplit", () => {
  const okPairs = [{ question: "지원동기", answer: "열심히 하겠습니다." }];

  it("서버가 준 질문/답변 쌍을 돌려준다", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ questions: okPairs }), { status: 200 });
    const getAuth = async () => ({ Authorization: "Bearer token" });

    await expect(
      requestAiSplit("텍스트", { fetchFn, getAuth })
    ).resolves.toEqual(okPairs);
  });

  it("실패 응답이면 예외를 던진다 (호출부가 휴리스틱으로 폴백)", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ error: "SPLIT_FAILED" }), { status: 502 });
    const getAuth = async () => ({ Authorization: "Bearer token" });

    await expect(
      requestAiSplit("텍스트", { fetchFn, getAuth })
    ).rejects.toThrow();
  });

  it("응답 형태가 어긋나면 예외를 던진다", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ questions: "broken" }), { status: 200 });
    const getAuth = async () => ({ Authorization: "Bearer token" });

    await expect(
      requestAiSplit("텍스트", { fetchFn, getAuth })
    ).rejects.toThrow();
  });
});
