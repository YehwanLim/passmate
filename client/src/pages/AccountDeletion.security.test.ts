import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("account deletion UI", () => {
  it("uses only authenticated deletion and cancellation APIs", () => {
    const page = source("client/src/pages/AccountDeletion.tsx");
    const app = source("client/src/App.tsx");

    expect(page).toContain('"/api/account/deletion"');
    expect(page).toContain('"/api/account/deletion/cancel"');
    expect(page).toContain("getAuthorizationHeader");
    expect(app).toContain('path={"/account/deletion"}');
  });
});
