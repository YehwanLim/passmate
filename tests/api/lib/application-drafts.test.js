import { describe, expect, it } from "vitest";
import { ApiError } from "../../../lib/api-handler.js";
import {
  MAX_ANSWER_CHARS,
  normalizeProjectCreate,
  normalizeProjectMeta,
  normalizeQuestionDrafts,
  normalizeQuestionSave,
} from "../../../lib/application-drafts.js";

describe("normalizeQuestionDrafts", () => {
  it("position 을 1부터 매기고 답변의 공백·줄바꿈은 그대로 둔다", () => {
    const drafts = normalizeQuestionDrafts([
      { prompt: " 지원 동기 ", charLimit: 700, answer: "첫 줄\n\n둘째 줄  " },
      { prompt: "협업 경험" },
    ]);
    expect(drafts).toEqual([
      { position: 1, prompt: "지원 동기", charLimit: 700, answer: "첫 줄\n\n둘째 줄  " },
      { position: 2, prompt: "협업 경험", charLimit: null, answer: "" },
    ]);
  });

  it("문항 6개, 모르는 키, 너무 긴 문항·답변, 잘못된 글자 수 제한은 400", () => {
    const six = Array.from({ length: 6 }, () => ({ prompt: "q" }));
    for (const bad of [
      six,
      [{ prompt: "q", extra: 1 }],
      [{ prompt: "가".repeat(301) }],
      [{ prompt: "q", answer: "가".repeat(MAX_ANSWER_CHARS + 1) }],
      [{ prompt: "q", charLimit: 0 }],
      [{ prompt: "q", charLimit: 1.5 }],
      "not-array",
    ]) {
      expect(() => normalizeQuestionDrafts(bad)).toThrow(ApiError);
    }
  });

  it("답변의 널 문자는 지운다", () => {
    expect(normalizeQuestionDrafts([{ prompt: "q", answer: "a\0b" }])[0].answer).toBe("ab");
  });
});

describe("normalizeProjectCreate", () => {
  it("회사는 필수, 나머지는 선택이다", () => {
    expect(normalizeProjectCreate({ company: "한솔제지" })).toEqual({
      company: "한솔제지",
      jobKeyword: null,
      deadline: null,
      postingSlug: null,
      questions: [],
    });
    expect(() => normalizeProjectCreate({})).toThrow(ApiError);
    expect(() => normalizeProjectCreate({ company: "   " })).toThrow(ApiError);
  });

  it("마감은 ISO 문자열을 Date 로, 슬러그는 소문자·숫자·하이픈만 받는다", () => {
    const draft = normalizeProjectCreate({
      company: "한솔제지",
      deadline: "2026-10-11T23:59:00+09:00",
      postingSlug: "hansol-2026h2",
    });
    expect(draft.deadline.toISOString()).toBe("2026-10-11T14:59:00.000Z");
    expect(draft.postingSlug).toBe("hansol-2026h2");
    expect(() => normalizeProjectCreate({ company: "A", deadline: "내일" })).toThrow(ApiError);
    expect(() => normalizeProjectCreate({ company: "A", postingSlug: "Bad Slug" })).toThrow(ApiError);
    expect(() => normalizeProjectCreate({ company: "A", unknown: 1 })).toThrow(ApiError);
  });
});

describe("normalizeProjectMeta", () => {
  it("보낸 키만 돌려주고, 마감 null 은 마감 지우기다", () => {
    expect(normalizeProjectMeta({ deadline: null })).toEqual({ deadline: null });
    expect(normalizeProjectMeta({ jobKeyword: "영업" })).toEqual({ jobKeyword: "영업" });
  });

  it("빈 본문, 빈 회사명, 모르는 키는 400", () => {
    expect(() => normalizeProjectMeta({})).toThrow(ApiError);
    expect(() => normalizeProjectMeta({ company: "" })).toThrow(ApiError);
    expect(() => normalizeProjectMeta({ title: "x" })).toThrow(ApiError);
  });
});

describe("normalizeQuestionSave", () => {
  it("baseUpdatedAt 은 선택이며 ISO 문자열이면 Date 로 바꾼다", () => {
    expect(normalizeQuestionSave({ questions: [] })).toEqual({ questions: [], baseUpdatedAt: null });
    const saved = normalizeQuestionSave({ questions: [], baseUpdatedAt: "2026-10-03T01:00:00.000Z" });
    expect(saved.baseUpdatedAt.toISOString()).toBe("2026-10-03T01:00:00.000Z");
    expect(() => normalizeQuestionSave({ questions: [], baseUpdatedAt: "어제" })).toThrow(ApiError);
    expect(() => normalizeQuestionSave({})).toThrow(ApiError);
  });
});
