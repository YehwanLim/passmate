import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin users server boundary", () => {
  it("loads only the list and detail projections from authenticated admin APIs", () => {
    const listHook = read("client/src/hooks/admin/useUsersData.ts");
    const detailHook = read("client/src/hooks/admin/useUserDetail.ts");

    expect(listHook).toContain("adminApiFetch");
    expect(listHook).toContain("/api/admin/users?");
    expect(detailHook).toContain("adminApiFetch");
    expect(detailHook).toContain("/api/admin/users/");
    expect(listHook).not.toMatch(/\.from\(\s*["']/);
    expect(detailHook).not.toMatch(/\.from\(\s*["']/);
  });

  it("keeps user-table writes out of the browser authentication context", () => {
    const authContext = read("client/src/contexts/AuthContext.tsx");

    expect(authContext).not.toContain('.from("users")');
    expect(authContext).not.toContain(".upsert(");
  });
});
