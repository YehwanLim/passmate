import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../prisma/migrations/20261023_add_instagram_dm/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("instagram auto DM migration", () => {
  it("creates the status enum and both tables", () => {
    expect(migration).toContain(
      "CREATE TYPE instagram_dm_status AS ENUM ('SENDING', 'GATE_SENT', 'LINK_SENT', 'FAILED')",
    );
    expect(migration).toContain("CREATE TABLE instagram_dm_deliveries");
    expect(migration).toContain("comment_id VARCHAR(64) NOT NULL UNIQUE");
    expect(migration).toContain("CREATE TABLE instagram_credentials");
  });

  it("never stores comment text or usernames", () => {
    expect(migration).not.toMatch(/comment_text|username/i);
  });

  it("closes both tables to the public Supabase roles", () => {
    for (const table of ["instagram_dm_deliveries", "instagram_credentials"]) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE ${table} FROM anon`);
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE ${table} FROM authenticated`);
    }
  });

  it("only adds objects", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bALTER TABLE (?!instagram_)/i);
  });

  it("declares the Prisma models the handlers query", () => {
    expect(schema).toContain("model InstagramDmDelivery");
    expect(schema).toContain('@@map("instagram_dm_deliveries")');
    expect(schema).toContain("model InstagramCredential");
    expect(schema).toContain('@@map("instagram_credentials")');
    expect(schema).toContain('@@map("instagram_dm_status")');
  });
});
