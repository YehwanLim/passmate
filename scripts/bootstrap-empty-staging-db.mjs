import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIRECTORY = join(SCRIPT_DIRECTORY, "..", "prisma", "migrations");

export const BOOTSTRAP_PRISMA_COMMANDS = [
  ["db", "push"],
  ["migrate", "status"],
];

export function classifyStagingSchema({ applicationTableNames, hasPrismaMigrationHistory, allowResume = false }) {
  if (hasPrismaMigrationHistory) {
    return { action: "abort", reason: "PRISMA_MIGRATION_HISTORY_PRESENT" };
  }

  if (applicationTableNames.length > 0) {
    if (allowResume) {
      return { action: "resume" };
    }

    return { action: "abort", reason: "APPLICATION_TABLES_PRESENT" };
  }

  return { action: "bootstrap" };
}

async function inspectPublicSchema(connectionString) {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const [tables, migrationHistory] = await Promise.all([
      pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'
        ORDER BY table_name
      `),
      pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = '_prisma_migrations'
        ) AS exists
      `),
    ]);

    return {
      applicationTableNames: tables.rows.map((row) => row.table_name),
      hasPrismaMigrationHistory: migrationHistory.rows[0].exists,
    };
  } finally {
    await pool.end();
  }
}

function runPrisma(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Prisma command failed: prisma ${args.join(" ")}`);
  }
}

function migrationNames() {
  return readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(MIGRATIONS_DIRECTORY, name, "migration.sql")))
    .sort();
}

async function applyMigrationSqlAndRecordHistory(connectionString) {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    for (const name of migrationNames()) {
      const sql = readFileSync(join(MIGRATIONS_DIRECTORY, name, "migration.sql"), "utf8");
      console.log(`Applying migration SQL: ${name}`);
      await pool.query(sql);

      console.log(`Recording migration baseline: ${name}`);
      runPrisma(["migrate", "resolve", "--applied", name]);
    }
  } finally {
    await pool.end();
  }
}

export async function bootstrapEmptyStagingDatabase({
  directUrl = process.env.DIRECT_URL,
  allowResume = false,
} = {}) {
  if (!directUrl) {
    throw new Error("DIRECT_URL is required for the one-time staging bootstrap");
  }

  const schemaState = await inspectPublicSchema(directUrl);
  const decision = classifyStagingSchema({ ...schemaState, allowResume });

  if (decision.action === "abort") {
    const tableSummary = schemaState.applicationTableNames.join(", ") || "none";
    throw new Error(
      `Refusing to bootstrap a non-empty database (${decision.reason}; public tables: ${tableSummary}).`,
    );
  }

  if (decision.action === "bootstrap") {
    console.log("Verified an empty staging public schema. Creating the Prisma schema without data loss.");
    runPrisma(BOOTSTRAP_PRISMA_COMMANDS[0]);
  } else {
    console.log("Resuming the acknowledged schema-only bootstrap state without resetting data.");
  }

  console.log("Applying versioned migration SQL for triggers, RLS, and security functions.");
  await applyMigrationSqlAndRecordHistory(directUrl);

  console.log("Checking the final migration state.");
  runPrisma(BOOTSTRAP_PRISMA_COMMANDS[1]);
}

async function main() {
  await bootstrapEmptyStagingDatabase({ allowResume: process.argv.includes("--resume") });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Staging bootstrap failed");
    process.exitCode = 1;
  });
}
