import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../prisma/migrations/20261003_add_application_workspace/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("작업실 마이그레이션", () => {
  it("기존 테이블은 컬럼 추가만 하고 지우거나 바꾸지 않는다", () => {
    expect(sql).toContain("ALTER TABLE projects ADD COLUMN deadline TIMESTAMPTZ");
    expect(sql).toContain("ALTER TABLE projects ADD COLUMN posting_slug VARCHAR(120)");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/ALTER\s+COLUMN/i);
  });

  it("문항·경험은 부모가 지워지면 함께 지워진다(계정 purge 경로)", () => {
    expect(sql).toMatch(/project_id UUID NOT NULL REFERENCES projects\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    expect(sql).toContain("UNIQUE (project_id, position)");
  });

  it("새 테이블도 다른 테이블처럼 RLS 를 켜고 anon 권한을 회수한다", () => {
    expect(sql).toContain("ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE experiences ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE application_questions FROM anon");
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE experiences FROM anon");
  });

  it("schema.prisma 에 같은 모델이 있다", () => {
    expect(schema).toMatch(/model ApplicationQuestion \{/);
    expect(schema).toMatch(/model Experience \{/);
    expect(schema).toMatch(/deadline\s+DateTime\?/);
    expect(schema).toMatch(/@@unique\(\[projectId, position\]\)/);
  });
});
