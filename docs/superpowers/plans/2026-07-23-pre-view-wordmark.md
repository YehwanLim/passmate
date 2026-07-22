# Pre:View Wordmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared PassMate lockup with the approved colon-accented Pre:View wordmark and publish a high-resolution transparent PNG asset.

**Architecture:** The shared `Logo` component is the only in-product rendering point for the header/footer brand lockup. It will render semantic text rather than an icon, so current call sites retain their typography sizing. A matching SVG in `client/public` is the source of a 2048 × 512 transparent PNG export for non-UI use.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, SVG, macOS image conversion tooling.

## Global Constraints

- Render the mark exactly as `Pre:View`; only `:` uses `#38BDF8`.
- Keep wordmark tracking at `-0.045em` and colon-side spacing at `0.045em`.
- Do not rename existing `passmate_*` persistence keys or unrelated product copy.
- Export `client/public/pre-view-wordmark.png` as transparent 2048 × 512 pixels.

---

### Task 1: Lock the shared wordmark contract with a failing test

**Files:**
- Create: `client/src/components/Logo.test.ts`
- Modify: `client/src/components/Logo.tsx`

**Interfaces:**
- Consumes: `Logo` component props `textClassName?: string` and `logoColor?: string`.
- Produces: A shared rendered `Pre:View` wordmark with a blue colon and no legacy icon SVG.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Logo.tsx", import.meta.url), "utf8");

describe("Pre:View wordmark", () => {
  it("renders a colon-only blue Pre:View wordmark without the legacy checkmark", () => {
    expect(source).toMatch(/>\s*Pre\s*<span/);
    expect(source).toMatch(/<\/span>\s*View\s*<\/span>/);
    expect(source).toContain('padding: "0 0.045em"');
    expect(source).toContain('letterSpacing: "-0.045em"');
    expect(source).not.toContain('viewBox="0 0 24 24"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/components/Logo.test.ts`

Expected: FAIL because `Logo.tsx` still renders the legacy SVG checkmark and lacks the approved Pre:View wordmark tokens.

- [ ] **Step 3: Write minimal implementation**

```tsx
<span
  className={`font-bold ${textClassName}`}
  style={{ letterSpacing: "-0.045em" }}
>
  Pre
  <span style={{ color: logoColor, display: "inline-block", padding: "0 0.045em" }}>:</span>
  View
</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/components/Logo.test.ts`

Expected: PASS with one passing test.

### Task 2: Publish matching source and PNG brand assets

**Files:**
- Create: `client/public/pre-view-wordmark.svg`
- Create: `client/public/pre-view-wordmark.png`

**Interfaces:**
- Consumes: The approved white/blue Pre:View color and spacing values.
- Produces: A transparent 2048 × 512 asset pair for external use.

- [ ] **Step 1: Create the SVG source**

```svg
<svg width="2048" height="512" viewBox="0 0 2048 512" xmlns="http://www.w3.org/2000/svg">
  <text x="96" y="332" fill="#F5F5F5" font-family="Inter, Arial, sans-serif" font-size="256" font-weight="750" letter-spacing="-11">Pre</text>
  <text x="510" y="332" fill="#38BDF8" font-family="Inter, Arial, sans-serif" font-size="256" font-weight="750">:</text>
  <text x="585" y="332" fill="#F5F5F5" font-family="Inter, Arial, sans-serif" font-size="256" font-weight="750" letter-spacing="-11">View</text>
</svg>
```

- [ ] **Step 2: Export the PNG**

Run: `sips -s format png client/public/pre-view-wordmark.svg --out client/public/pre-view-wordmark.png`

Expected: `client/public/pre-view-wordmark.png` is created.

- [ ] **Step 3: Verify asset dimensions and alpha channel**

Run: `sips -g pixelWidth -g pixelHeight -g hasAlpha client/public/pre-view-wordmark.png`

Expected: `pixelWidth: 2048`, `pixelHeight: 512`, and `hasAlpha: yes`.

### Task 3: Verify production integration

**Files:**
- Verify: `client/src/components/Logo.test.ts`
- Verify: `client/src/components/Logo.tsx`
- Verify: `client/public/pre-view-wordmark.png`

- [ ] **Step 1: Run the focused wordmark test**

Run: `npx vitest run client/src/components/Logo.test.ts`

Expected: PASS with one passing test.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm run check`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0 and generated Vite/server bundles.
