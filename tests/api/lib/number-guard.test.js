import { describe, expect, it } from "vitest";
import { BLANK_NUMBER, guardNumbers, numberCores } from "../../../lib/number-guard.js";

describe("number-guard", () => {
  it("근거 글에 있는 숫자만 남기고 나머지는 [실제 수치]로 바꾼다(쉼표·앞자리 0 무시)", () => {
    const allowed = numberCores("재방문 1,200명, 2024.09 시작");
    const out = guardNumbers("1200명이 왔고 매출은 30% 늘었고 9월에 시작했다", allowed);
    expect(out.text).toBe(`1200명이 왔고 매출은 ${BLANK_NUMBER} 늘었고 9월에 시작했다`);
    expect(out.replaced).toBe(1);
  });

  it("점 날짜는 소수와 연·월 둘 다로 인정한다", () => {
    const cores = numberCores("2024.09~11");
    expect(cores.has("2024.09")).toBe(true);
    expect(cores.has("2024")).toBe(true);
    expect(cores.has("9")).toBe(true);
    expect(cores.has("11")).toBe(true);
  });
});
