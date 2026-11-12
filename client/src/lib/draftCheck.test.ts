import { describe, expect, it } from "vitest";
import { checkDraft, type DraftCheckItem } from "./draftCheck";

const byKey = (items: DraftCheckItem[], key: DraftCheckItem["key"]) => items.find(item => item.key === key)!;

const GOOD =
  "고객 이탈 원인을 숫자로 찾아 재구매율을 12% 올린 경험이 있습니다. " +
  "카페 아르바이트를 하며 단골이 줄어드는 이유가 궁금해 3주 동안 주문 기록 400건을 정리했습니다. " +
  "평일 오후 대기 시간이 길다는 점을 확인하고 점장님께 주문 순서를 바꾸자고 제안했습니다. " +
  "그 결과 평균 대기 시간이 6분에서 3분으로 줄었고 한 달 뒤 재방문 손님이 눈에 띄게 늘었습니다.";

describe("checkDraft", () => {
  it("잘 쓴 글은 모든 항목이 좋아요로 나온다", () => {
    const items = checkDraft(GOOD);
    expect(items.map(item => item.key)).toEqual(["length", "opening", "numbers", "cliche", "longSentence", "repeat"]);
    expect(items.filter(item => item.status === "improve")).toEqual([]);
  });

  it("200자보다 짧으면 길이를 짚는다", () => {
    expect(byKey(checkDraft("짧은 글입니다."), "length").status).toBe("improve");
    expect(byKey(checkDraft(GOOD), "length").status).toBe("good");
  });

  it("글자 수 제한을 적으면 넘쳤는지, 너무 비었는지 본다", () => {
    expect(byKey(checkDraft(GOOD, 200), "length")).toEqual(
      expect.objectContaining({ status: "improve", detail: expect.stringContaining("넘어요") }),
    );
    expect(byKey(checkDraft(GOOD, 1000), "length")).toEqual(
      expect.objectContaining({ status: "improve", detail: expect.stringContaining("800자") }),
    );
    expect(byKey(checkDraft(GOOD, GOOD.length + 20), "length").status).toBe("good");
  });

  it("배경 이야기로 시작하거나 첫 문장이 너무 길면 결론부터 쓰자고 한다", () => {
    const childhood = `저는 어릴 때부터 사람 만나는 것을 좋아했습니다. ${GOOD}`;
    expect(byKey(checkDraft(childhood), "opening")).toEqual(
      expect.objectContaining({ status: "improve", detail: expect.stringContaining("어릴 때부터") }),
    );
    const long = `${"제가 지원한 이유는 여러 가지가 있지만 가장 큰 이유를 말씀드리자면 ".repeat(3)}입니다. ${GOOD}`;
    expect(byKey(checkDraft(long), "opening").status).toBe("improve");
  });

  it("숫자가 하나도 없으면 결과를 숫자로 보여주자고 한다", () => {
    const noNumbers = GOOD.replace(/\d+%?/g, "많이");
    expect(byKey(checkDraft(noNumbers), "numbers").status).toBe("improve");
  });

  it("흔한 표현을 찾아 그 말을 짚는다", () => {
    const item = byKey(checkDraft(`${GOOD} 앞으로도 열심히 하고 최선을 다하는 성실한 사람이 되겠습니다.`), "cliche");
    expect(item.status).toBe("improve");
    expect(item.detail).toContain("열심히");
    expect(item.detail).toContain("최선을 다");
    expect(item.detail).toContain("성실");
  });

  it("120자가 넘는 문장은 앞부분을 보여준다", () => {
    const long = `${"팀원들과 매일 회의를 하며 문제를 정리하고 역할을 나누고 진행 상황을 공유하고 ".repeat(3)}마무리했습니다.`;
    const item = byKey(checkDraft(`${GOOD} ${long}`), "longSentence");
    expect(item.status).toBe("improve");
    expect(item.detail).toContain("팀원들과 매일");
  });

  it("같은 낱말을 네 번 넘게 쓰면 짚는다(조사는 떼고 센다)", () => {
    const repeated = `${GOOD} 고객을 만나고 고객이 원하는 것을 고객에게 묻고 고객의 말을 들었습니다.`;
    const item = byKey(checkDraft(repeated), "repeat");
    expect(item.status).toBe("improve");
    expect(item.detail).toContain("고객");
  });

  it("빈 글은 아무 항목도 내지 않는다", () => {
    expect(checkDraft("   ")).toEqual([]);
  });
});
