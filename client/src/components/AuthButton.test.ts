import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AuthButton.tsx", import.meta.url),
  "utf8"
);

describe("AuthButton header polish", () => {
  it("uses the same restrained header hover treatment as landing navigation", () => {
    expect(source).toContain("header-action-link");
    expect(source).toContain('id="header-login-btn"');
    expect(source).toContain('id="header-profile-btn"');
  });

  it("offers application and entitlement destinations before logout for authenticated users", () => {
    const projectsIndex = source.indexOf('id="header-my-projects-btn"');
    const entitlementsIndex = source.indexOf('id="header-entitlements-btn"');
    const logoutIndex = source.indexOf('id="header-logout-btn"');

    expect(projectsIndex).toBeGreaterThan(-1);
    expect(entitlementsIndex).toBeGreaterThan(projectsIndex);
    expect(logoutIndex).toBeGreaterThan(entitlementsIndex);
    expect(source).toContain('handleNavigate("/my")');
    expect(source).toContain('handleNavigate("/entitlements")');
    expect(source).toContain("navigate(path)");
    expect(source).toContain("setDropdownOpen(false)");
  });

  it("does not offer account deletion from the profile dropdown", () => {
    expect(source).not.toContain("계정 삭제");
    expect(source).not.toContain('navigate("/account/deletion")');
  });

  it("offers application and entitlement destinations before logout for authenticated users", () => {
    const projectsIndex = source.indexOf('id="header-my-projects-btn"');
    const entitlementsIndex = source.indexOf('id="header-entitlements-btn"');
    const logoutIndex = source.indexOf('id="header-logout-btn"');

    expect(projectsIndex).toBeGreaterThan(-1);
    expect(entitlementsIndex).toBeGreaterThan(projectsIndex);
    expect(logoutIndex).toBeGreaterThan(entitlementsIndex);
    expect(source).toContain('handleNavigate("/my")');
    expect(source).toContain('handleNavigate("/entitlements")');
    expect(source).toContain("setDropdownOpen(false)");
  });
});
