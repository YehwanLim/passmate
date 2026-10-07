import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../prisma/migrations/20261005_add_experience_draft/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("경험 초안 마이그레이션", () => {
  it("컬럼 추가만 하고 지우거나 바꾸지 않는다", () => {
    expect(sql).toContain("ALTER TABLE projects ADD COLUMN job_posting_id UUID");
    expect(sql).toMatch(/REFERENCES job_postings\(id\) ON DELETE SET NULL/);
    expect(sql).toContain("ALTER TABLE application_questions ADD COLUMN draft_experience_ids TEXT[] NOT NULL DEFAULT '{}'");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/ALTER\s+COLUMN/i);
  });

  it("schema.prisma 에 같은 칸이 있다", () => {
    expect(schema).toMatch(/jobPostingId\s+String\?\s+@map\("job_posting_id"\) @db\.Uuid/);
    expect(schema).toMatch(/draftExperienceIds\s+String\[\]\s+@default\(\[\]\) @map\("draft_experience_ids"\)/);
  });
});
