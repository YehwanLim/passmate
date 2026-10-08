import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./useCreditSummary.ts", import.meta.url), "utf8");

describe("useCreditSummary", () => {
  // 프로필 메뉴(헤더)가 랜딩에도 있어서, supabase 를 정적으로 부르면 랜딩 진입 청크에 다시 합쳐진다.
  it("supabase 는 동적 import 로만 부른다", () => {
    expect(source).not.toMatch(/^import\s+\{[^}]*supabase[^}]*\}\s+from\s+"@\/lib\/supabase"/m);
    expect(source).toContain('import("@/lib/supabase")');
  });
});
