// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { collectPerfReport, mountPerfOverlay } from "./perfOverlay";

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("perf overlay", () => {
  it("mounts only when ?perf is in the query string", () => {
    expect(mountPerfOverlay()).toBeNull();
    expect(document.getElementById("perf-overlay")).toBeNull();

    window.history.replaceState(null, "", "/?perf=1");
    const pre = mountPerfOverlay();
    expect(pre).not.toBeNull();
    expect(document.getElementById("perf-overlay")?.textContent).toContain("ua ");
  });

  it("survives environments without navigation timing entries", () => {
    // jsdom 에는 navigation/paint 엔트리가 없다. 폰 브라우저가 일부만 지원해도 깨지지 않아야 한다.
    performance.mark("app-module-start");
    const lines = collectPerfReport(1234);
    expect(lines.some(l => l.startsWith("mark app-module-start"))).toBe(true);
    expect(lines.at(-1)).toMatch(/^now 1234 visible/);
  });
});
