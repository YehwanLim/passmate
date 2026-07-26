import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

export const BOOTSTRAP_PRISMA_COMMANDS = [
  ["db", "push"],
  ["migrate", "deploy"],
  ["migrate", "status"],
];

export function classifyStagingSchema({ applicationTableNames, hasPrismaMigrationHistory }) {
  if (hasPrismaMigrationHistory) {
    return { action: "abort", reason: "PRISMA_MIGRATION_HISTORY_PRESENT" };
  }

  if (applicationTableNames.length > 0) {
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

export async function bootstrapEmptyStagingDatabase({ directUrl = process.env.DIRECT_URL } = {}) {
  if (!directUrl) {
    throw new Error("DIRECT_URL is required for the one-time staging bootstrap");
  }

  const schemaState = await inspectPublicSchema(directUrl);
  const decision = classifyStagingSchema(schemaState);

  if (decision.action !== "bootstrap") {
    const tableSummary = schemaState.applicationTableNames.join(", ") || "none";
    throw new Error(
      `Refusing to bootstrap a non-empty database (${decision.reason}; public tables: ${tableSummary}).`,
    );
  }

  console.log("Verified an empty staging public schema. Creating the Prisma schema without data loss.");
  runPrisma(BOOTSTRAP_PRISMA_COMMANDS[0]);

  console.log("Applying versioned migrations for triggers, RLS, and security functions.");
  runPrisma(BOOTSTRAP_PRISMA_COMMANDS[1]);

  console.log("Checking the final migration state.");
  runPrisma(BOOTSTRAP_PRISMA_COMMANDS[2]);
}

async function main() {
  await bootstrapEmptyStagingDatabase();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Staging bootstrap failed");
    process.exitCode = 1;
  });
}
