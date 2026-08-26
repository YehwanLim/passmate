import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));
const schemaSql = fileURLToPath(new URL("../../prisma/schema.sql", import.meta.url));

/** SQL comments must not count as applied statements. */
function stripComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function migrationSources() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => stripComments(readFileSync(`${migrationsDir}/${entry.name}/migration.sql`, "utf8")));
}

function createdTables(sources) {
  const tables = new Set();
  for (const sql of sources) {
    for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_]+)"?/gi)) {
      tables.add(match[1]);
    }
  }
  return tables;
}

/**
 * A table is protected either by a direct ALTER statement or by appearing in a
 * FOREACH ARRAY[...] loop that enables row level security for each entry.
 */
function protectedTables(sources) {
  const tables = new Set();
  for (const sql of sources) {
    for (const match of sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?"?([a-z_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)) {
      tables.add(match[1]);
    }
    if (!/ENABLE ROW LEVEL SECURITY/i.test(sql)) continue;
    for (const arrayBlock of sql.matchAll(/ARRAY\s*\[([^\]]*)\]/g)) {
      for (const quoted of arrayBlock[1].matchAll(/'([a-z_]+)'/g)) {
        tables.add(quoted[1]);
      }
    }
  }
  return tables;
}

function revokedTables(sources) {
  const tables = new Set();
  for (const sql of sources) {
    for (const match of sql.matchAll(/REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+TABLE\s+(?:public\.)?"?([a-z_]+)"?/gi)) {
      tables.add(match[1]);
    }
    if (!/REVOKE ALL PRIVILEGES/i.test(sql)) continue;
    for (const arrayBlock of sql.matchAll(/ARRAY\s*\[([^\]]*)\]/g)) {
      for (const quoted of arrayBlock[1].matchAll(/'([a-z_]+)'/g)) {
        tables.add(quoted[1]);
      }
    }
  }
  return tables;
}

describe("application tables default to deny", () => {
  const sources = [...migrationSources(), stripComments(readFileSync(schemaSql, "utf8"))];
  const tables = [...createdTables(sources)].sort();

  it("finds the application tables to check", () => {
    expect(tables).toContain("users");
    expect(tables).toContain("analyses");
    expect(tables).toContain("credit_coupons");
    expect(tables).toContain("admin_credit_grants");
  });

  it("enables row level security on every table a migration creates", () => {
    const enabled = protectedTables(sources);
    expect(tables.filter((table) => !enabled.has(table))).toEqual([]);
  });

  it("revokes anon and authenticated privileges on every table a migration creates", () => {
    const revoked = revokedTables(sources);
    expect(tables.filter((table) => !revoked.has(table))).toEqual([]);
  });
});
