import { describe, expect, it } from "vitest";
import { loginPathFrom } from "./AuthButton";

describe("loginPathFrom", () => {
  it("랜딩에서 누른 헤더 로그인은 로그인 뒤 분석 폼으로 보낸다", () => {
    expect(loginPathFrom("/")).toBe("/login?redirect=%2Fanalyze");
  });

  it("다른 페이지에서는 기존처럼 /login 으로만 간다", () => {
    expect(loginPathFrom("/guide")).toBe("/login");
    expect(loginPathFrom("/analyze")).toBe("/login");
  });
});
