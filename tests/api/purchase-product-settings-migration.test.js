import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const enumMigration = readFileSync(
  new URL("../../prisma/migrations/20260907_add_purchase_product_enum_values/migration.sql", import.meta.url),
  "utf8",
);
const tableMigration = readFileSync(
  new URL("../../prisma/migrations/20260907_add_purchase_product_settings/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("purchase product settings migration", () => {
  it("adds the tier products to the enum in its own migration", () => {
    for (const value of ["COMPANY_SINGLE", "STANDARD", "PREMIUM"]) {
      expect(enumMigration).toContain(`ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS '${value}'`);
    }
    // 새 enum 값은 같은 트랜잭션 안에서 쓸 수 없으므로 테이블 마이그레이션과 파일을 나눈다.
    expect(enumMigration).not.toContain("purchase_product_settings");
  });

  it("creates the per-product settings table and backfills every product row", () => {
    expect(tableMigration).toContain("CREATE TABLE purchase_product_settings");
    expect(tableMigration).toContain("product purchase_product PRIMARY KEY");
    expect(tableMigration).toContain("groble_content_id TEXT UNIQUE");
    // 1회권 URL 은 SINGLE 로, 구 3회권 URL 은 스탠다드가 승계한다.
    expect(tableMigration).toMatch(/'SINGLE'[\s\S]*groble_single_payment_url/);
    expect(tableMigration).toMatch(/'STANDARD'[\s\S]*groble_payment_url/);
    for (const value of ["'TRIPLE'", "'COMPANY_SINGLE'", "'PREMIUM'"]) {
      expect(tableMigration).toContain(value);
    }
    // 롤백 여지를 남기기 위해 옛 컬럼은 지우지 않는다.
    expect(tableMigration).not.toMatch(/DROP COLUMN/i);
  });

  it("declares the Prisma model that the settings reader queries", () => {
    expect(schema).toContain("model PurchaseProductSetting");
    expect(schema).toContain('@@map("purchase_product_settings")');
    for (const value of ["COMPANY_SINGLE", "STANDARD", "PREMIUM"]) {
      expect(schema).toContain(value);
    }
  });
});
