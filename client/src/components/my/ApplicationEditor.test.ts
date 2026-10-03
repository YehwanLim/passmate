import { describe, expect, it } from "vitest";
import { parseCharLimit } from "./ApplicationEditor";

describe("parseCharLimit", () => {
  it("1..10000 정수만 받고 나머지는 null", () => {
    expect(parseCharLimit("700")).toBe(700);
    expect(parseCharLimit("1")).toBe(1);
    expect(parseCharLimit("10000")).toBe(10000);
    for (const bad of ["", " ", "0", "-3", "1.5", "10001", "abc"]) expect(parseCharLimit(bad)).toBeNull();
  });
});
