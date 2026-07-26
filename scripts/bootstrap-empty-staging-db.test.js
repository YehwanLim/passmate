import { describe, expect, it } from "vitest";

import { BOOTSTRAP_PRISMA_COMMANDS, classifyStagingSchema } from "./bootstrap-empty-staging-db.mjs";

describe("classifyStagingSchema", () => {
  it("uses only Prisma db push options supported by the pinned CLI", () => {
    expect(BOOTSTRAP_PRISMA_COMMANDS).toEqual([
      ["db", "push"],
      ["migrate", "status"],
    ]);
  });

  it("permits bootstrap only when the public schema and Prisma history are both absent", () => {
    expect(
      classifyStagingSchema({
        applicationTableNames: [],
        hasPrismaMigrationHistory: false,
      }),
    ).toEqual({ action: "bootstrap" });
  });

  it("refuses bootstrap when application tables already exist", () => {
    expect(
      classifyStagingSchema({
        applicationTableNames: ["users"],
        hasPrismaMigrationHistory: false,
      }),
    ).toEqual({
      action: "abort",
      reason: "APPLICATION_TABLES_PRESENT",
    });
  });

  it("requires an explicit resume acknowledgement after the schema phase completed", () => {
    expect(
      classifyStagingSchema({
        applicationTableNames: ["users"],
        hasPrismaMigrationHistory: false,
      }),
    ).toEqual({
      action: "abort",
      reason: "APPLICATION_TABLES_PRESENT",
    });

    expect(
      classifyStagingSchema({
        applicationTableNames: ["users"],
        hasPrismaMigrationHistory: false,
        allowResume: true,
      }),
    ).toEqual({ action: "resume" });
  });

  it("refuses bootstrap when Prisma migration history already exists", () => {
    expect(
      classifyStagingSchema({
        applicationTableNames: [],
        hasPrismaMigrationHistory: true,
      }),
    ).toEqual({
      action: "abort",
      reason: "PRISMA_MIGRATION_HISTORY_PRESENT",
    });
  });
});
