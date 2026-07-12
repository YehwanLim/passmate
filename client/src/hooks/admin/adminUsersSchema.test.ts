import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin users Supabase schema usage", () => {
  it("queries the users table with existing profile columns", () => {
    const listHook = read("client/src/hooks/admin/useUsersData.ts");
    const detailHook = read("client/src/hooks/admin/useUserDetail.ts");

    expect(listHook).toContain("avatar_url");
    expect(detailHook).toContain("avatar_url");
    expect(listHook).not.toContain("profile_image,");
    expect(detailHook).not.toContain("profile_image, provider");
    expect(listHook).not.toContain("provider,\n          role");
    expect(detailHook).not.toContain("avatar_url, provider");
  });

  it("upserts users with avatar_url instead of non-existent profile_image/provider columns", () => {
    const authContext = read("client/src/contexts/AuthContext.tsx");

    expect(authContext).toContain("avatar_url: profile.profile_image");
    expect(authContext).not.toContain("profile_image: profile.profile_image");
    expect(authContext).not.toContain("provider: profile.provider");
  });
});
