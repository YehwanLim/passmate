import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./AiModelsPage.tsx", import.meta.url), "utf8");

describe("AiModelsPage fallback model display", () => {
  it("derives the fallback model from saved server settings instead of guessing", () => {
    // 저장된 설정이 근거여야 한다. 추측 표시는 실제로 저장되지 않은 폴백을
    // 저장된 것처럼 보이게 해, 같은 값을 다시 선택해도 onValueChange 가
    // 발화하지 않아 저장 자체가 불가능해진다.
    expect(source).toContain("configPayload.settings?.fallbackModel");
    expect(source).not.toContain("model.id !== defaultModel?.id");
  });
});
