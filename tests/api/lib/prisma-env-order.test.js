import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// 회귀 방지: 로컬 dev(Vite API 미들웨어)에서는 lib/prisma.js가 dotenv.config()를
// 호출하는 lib/auth.js보다 먼저 평가될 수 있다. Pool 생성 전에 .env를 로드하지
// 않으면 pg가 localhost 기본값으로 연결을 시도해 모든 API가 P1003/500이 된다.
const prismaSource = readFileSync(new URL("../../../lib/prisma.js", import.meta.url), "utf8");

describe("lib/prisma.js env loading", () => {
  it("loads .env before creating the pg pool", () => {
    const dotenvIndex = prismaSource.indexOf("dotenv.config(");
    const poolIndex = prismaSource.indexOf("new pg.Pool(");
    expect(dotenvIndex).toBeGreaterThan(-1);
    expect(poolIndex).toBeGreaterThan(-1);
    expect(dotenvIndex).toBeLessThan(poolIndex);
  });
});
