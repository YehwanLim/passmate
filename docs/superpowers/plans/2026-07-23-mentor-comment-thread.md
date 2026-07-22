# Mentor Comment Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the lower mentor-comment section as three timestamped, card-free feedback comments in a continuous thread.

**Architecture:** Keep `splitMentorComment` as the single source for the three comment bodies and labels. Replace only the `section-pm-comment` JSX in `ReportResult.tsx` with a mapped avatar-and-content thread; Tailwind utility classes provide the responsive layout and its low-contrast connecting line.

**Tech Stack:** React 19, TypeScript, Tailwind CSS utilities, Vitest.

## Global Constraints

- Change only the lower `section-pm-comment`; retain the upper `현직자 코멘트` summary unchanged.
- Keep the existing `pmComment` schema and `splitMentorComment` helper unchanged.
- Render titles in this order: `읽힌 인상`, `더 선명해질 지점`, `면접에서 준비할 것`.
- Each comment renders only its avatar, mentor name, timestamp, title, and body.
- Do not render `01`–`03`, color-coded title variants, colored bars, card backgrounds, borders, or shadows in the lower section.
- Keep the dark premium theme, a low-contrast 1px connecting line, generous vertical spacing, and the existing rich-text sanitization path.
- Preserve existing unrelated unstaged changes; do not stage or commit mixed page-file changes.

---

## File Structure

- Modify: `client/src/pages/ReportResult.tsx` — replace the lower mentor-comment block with the avatar-led comment thread.
- Modify: `client/src/pages/ReportResult.identity.test.ts` — replace obsolete numbered-editorial assertions with lower-section thread assertions.

### Task 1: Render and verify the mentor feedback thread

**Files:**
- Modify: `client/src/pages/ReportResult.identity.test.ts:29-47`
- Modify: `client/src/pages/ReportResult.tsx:1049-1081`

**Interfaces:**
- Consumes: `mentorCommentBlocks: MentorCommentBlock[]`, where each item has `title: string` and `text: string`.
- Consumes: `renderCleanText(text: string): ReactNode` and `UI_LABELS.JUST_NOW`.
- Produces: Three semantic `<article>` comments in the lower `section-pm-comment`, each with its own mentor metadata and title/body content.

- [ ] **Step 1: Write the failing source-structure regression test**

  Replace the obsolete numbered-editorial test with this test body in `client/src/pages/ReportResult.identity.test.ts`:

  ```ts
  it("renders lower mentor comments as a timestamped feedback thread", () => {
    const lowerMentorSection = source.split('id="section-pm-comment"')[1]

    expect(lowerMentorSection).toContain("mentor-comment-thread")
    expect(lowerMentorSection).toContain("Mentor Hansi")
    expect(lowerMentorSection).toContain("UI_LABELS.JUST_NOW")
    expect(lowerMentorSection).toContain("rounded-full")
    expect(lowerMentorSection).toContain("absolute left-5")
    expect(lowerMentorSection).toContain("text-[18px] font-semibold")
    expect(lowerMentorSection).toContain("{block.title}")
    expect(lowerMentorSection).toContain("{renderCleanText(block.text)}")
    expect(lowerMentorSection).not.toContain('String(index + 1).padStart(2, "0")')
    expect(lowerMentorSection).not.toContain("numberClassName")
  })
  ```

- [ ] **Step 2: Run the regression test and confirm the expected failure**

  Run:

  ```bash
  pnpm exec vitest run client/src/pages/ReportResult.identity.test.ts
  ```

  Expected: the new test fails because the lower section still renders `String(index + 1).padStart(2, "0")` and has no `mentor-comment-thread` class.

- [ ] **Step 3: Replace only the lower section with the minimal thread markup**

  In `client/src/pages/ReportResult.tsx`, keep the existing section heading. Replace the single shared avatar and numbered `mentorCommentBlocks` map with this mapping inside a `<div className="mentor-comment-thread relative">`:

  ```tsx
  {mentorCommentBlocks.map((block, index) => (
    <article
      key={block.title}
      className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-5"
    >
      {index < mentorCommentBlocks.length - 1 && (
        <span aria-hidden="true" className="absolute left-5 top-12 bottom-0 w-px bg-white/[0.06] sm:left-[22px]" />
      )}
      <div className="relative z-10 flex size-10 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 sm:size-11">
        <span className="text-xs font-bold tracking-tight text-indigo-400">H</span>
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm font-medium text-white">Mentor Hansi</span>
          <span className="text-xs text-zinc-600">{UI_LABELS.JUST_NOW}</span>
        </div>
        <h4 className="mb-3 text-[18px] font-semibold tracking-tight text-zinc-100">{block.title}</h4>
        <p className="text-[17px] font-normal leading-[1.8] text-zinc-200">{renderCleanText(block.text)}</p>
      </div>
    </article>
  ))}
  ```

  Do not change `MENTOR_COMMENT_STYLES` or the upper summary card, which are outside the lower section's scope.

- [ ] **Step 4: Run the regression test and confirm it passes**

  Run:

  ```bash
  pnpm exec vitest run client/src/pages/ReportResult.identity.test.ts
  ```

  Expected: PASS with all identity-display assertions green.

- [ ] **Step 5: Verify type safety and related helper behavior**

  Run:

  ```bash
  pnpm exec vitest run client/src/pages/reportFirstImpression.test.ts client/src/pages/ReportResult.identity.test.ts
  pnpm check
  ```

  Expected: both Vitest files pass and TypeScript exits with code 0.

- [ ] **Step 6: Inspect the focused diff without staging unrelated work**

  Run:

  ```bash
  git diff --check -- client/src/pages/ReportResult.tsx client/src/pages/ReportResult.identity.test.ts
  git diff -- client/src/pages/ReportResult.tsx client/src/pages/ReportResult.identity.test.ts
  ```

  Expected: only the lower mentor-comment JSX and its replacement regression test describe this task. Do not create a source commit because both files contain pre-existing unstaged changes outside this task.
