import { describe, expect, it } from "vitest";
import { JOB_POSTINGS } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS } from "@/constants/jobPostingDetails";
import { jobPostingMeta } from "./jobPostingMeta";
import { resolveRouteMeta } from "./seo";

describe("jobPostingMeta", () => {
  it("keeps every posting title short enough for a result page and indexable", () => {
    for (const posting of JOB_POSTINGS) {
      const meta = jobPostingMeta(posting, JOB_POSTING_DETAILS[posting.slug]);
      expect(meta.title.length, posting.slug).toBeLessThanOrEqual(60);
      expect(meta.title, posting.slug).toContain(posting.title);
      expect(meta.robots, posting.slug).toBeUndefined();
      expect(meta.ogType).toBe("article");
      expect(meta.title, posting.slug).not.toContain("채용 채용");
    }
  });

  it("gives an unknown posting path an indexable default until the page overrides it", () => {
    const meta = resolveRouteMeta("/jobs/some-posting", "");
    expect(meta.robots).toBeUndefined();
    expect(meta.canonical).toBe("https://pre-view.me/jobs/some-posting");
  });
});
