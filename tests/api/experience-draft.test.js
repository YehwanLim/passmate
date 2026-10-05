import { describe, expect, it } from "vitest";
import { normalizeDraftOutput } from "../../lib/experience-draft.js";

const EXPS = [
  { id: "e1", title: "카페 단골 만들기", period: "2024", situation: "리뷰 2.8점", action: "불만 표 정리", result: "재방문 1,200명", tags: [] },
  { id: "e2", title: "동아리 회계", period: null, situation: "", action: "", result: "", tags: [] },
];
const ctx = { experiences: EXPS, postingText: "" };
const sentence = (text, kind = "experience", sourceIds = ["e1"]) => ({ text, kind, sourceIds });

describe("normalizeDraftOutput", () => {
  it("경험에 없는 숫자는 [실제 수치]로, 있는 숫자는 그대로(쉼표 무시)", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "고객 문제" }],
      sentences: [sentence("재방문을 1200명까지 늘렸고 매출은 30% 올랐습니다.")],
    }, ctx);
    expect(out.sentences[0].text).toBe("재방문을 1200명까지 늘렸고 매출은 [실제 수치] 올랐습니다.");
    expect(out.replacedNumbers).toBe(1);
  });

  it("단위 없는 숫자를 바꿀 때 뒤 공백은 남긴다", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "r" }],
      sentences: [sentence("매출 30 올랐습니다.")],
    }, ctx);
    expect(out.sentences[0].text).toBe("매출 [실제 수치] 올랐습니다.");
  });

  it("남의 경험 id 는 버리고, 출처가 빈 experience 문장은 unsourced", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "x9", reason: "?" }, { experienceId: "e1", reason: "맞음" }],
      sentences: [sentence("팀을 이끌었습니다.", "experience", ["x9"])],
    }, ctx);
    expect(out.chosen).toEqual([{ experienceId: "e1", title: "카페 단골 만들기", reason: "맞음" }]);
    expect(out.sentences[0]).toMatchObject({ sourceIds: [], unsourced: true });
  });

  it("job·plan 문장의 숫자는 공고 글과 비교한다", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "r" }],
      sentences: [sentence("이 직무는 3개 서비스를 맡습니다.", "job", [])],
    }, { experiences: EXPS, postingText: "3개 서비스 운영" });
    expect(out.sentences[0].text).toBe("이 직무는 3개 서비스를 맡습니다.");
  });

  it("문단은 kind 가 바뀔 때 빈 줄로 나누고 글자 수를 센다", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "r" }],
      sentences: [sentence("가.", "job", []), sentence("나.", "experience"), sentence("다.", "plan", [])],
    }, ctx);
    expect(out.draftText).toBe("가.\n\n나.\n\n다.");
    expect(out.charCount).toBe(out.draftText.length);
  });

  it("needs_more 는 문장 하나만 돌려준다", () => {
    expect(normalizeDraftOutput({ status: "needs_more", needMore: "팀 갈등을 푼 경험이 필요해요" }, ctx))
      .toEqual({ status: "needs_more", needMore: "팀 갈등을 푼 경험이 필요해요" });
  });

  it("문장이 하나도 안 남거나 형태가 틀리면 null", () => {
    expect(normalizeDraftOutput({ status: "ok", chosen: [], sentences: [] }, ctx)).toBeNull();
    expect(normalizeDraftOutput("nope", ctx)).toBeNull();
  });
});
