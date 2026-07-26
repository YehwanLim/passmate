import { describe, expect, it } from "vitest";

import { classifyStagingSchema } from "./bootstrap-empty-staging-db.mjs";

describe("classifyStagingSchema", () => {
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
