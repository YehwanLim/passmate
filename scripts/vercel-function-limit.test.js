import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "api");

function collectFunctionFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "lib" ? [] : collectFunctionFiles(path);
    }
    return entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")
      ? [relative(API_ROOT, path)]
      : [];
  });
}

describe("Vercel Hobby serverless function limit", () => {
  it("keeps deployed API files within the 12-function Hobby limit", () => {
    const apiFiles = collectFunctionFiles(API_ROOT);

    expect(apiFiles).toHaveLength(12);
  });
});
