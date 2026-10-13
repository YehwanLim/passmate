import { describe, expect, it } from "vitest";

import { JOB_POSTINGS } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS } from "@/constants/jobPostingDetails";
import { findCompanyJobPosting, normalizeCompanyName } from "./companyJobPosting";

describe("normalizeCompanyName", () => {
  it("drops corporate markers, spaces, and case only", () => {
    expect(normalizeCompanyName("(주)한진")).toBe("한진");
    expect(normalizeCompanyName("㈜ 한진")).toBe("한진");
    expect(normalizeCompanyName("주식회사 한진")).toBe("한진");
    expect(normalizeCompanyName("S-Oil")).toBe("s-oil");
  });
});

describe("findCompanyJobPosting", () => {
  const withProcess = JOB_POSTINGS.find((listing) => (JOB_POSTING_DETAILS[listing.slug]?.process.length ?? 0) > 0);

  it("matches a saved posting by its company name or short name, ignoring corporate markers", () => {
    expect(withProcess).toBeDefined();
    const listing = withProcess!;
    expect(findCompanyJobPosting(listing.company)?.listing.slug).toBe(listing.slug);
    expect(findCompanyJobPosting(`(주) ${listing.shortName}`)?.detail).toBe(JOB_POSTING_DETAILS[listing.slug]);
  });

  it("does not guess across group and affiliate names", () => {
    const group = JOB_POSTINGS.find((listing) => listing.company === "CJ그룹");
    if (group) expect(findCompanyJobPosting("CJ제일제당")).toBeNull();
    expect(findCompanyJobPosting("존재하지 않는 회사")).toBeNull();
    expect(findCompanyJobPosting("   ")).toBeNull();
  });

  it("picks the posting that closes last when one company has several", () => {
    for (const listing of JOB_POSTINGS) {
      const match = findCompanyJobPosting(listing.company);
      if (!match) continue;
      const sameCompany = JOB_POSTINGS.filter((other) =>
        normalizeCompanyName(other.company) === normalizeCompanyName(listing.company)
        && (JOB_POSTING_DETAILS[other.slug]?.process.length ?? 0) > 0);
      const latest = Math.max(...sameCompany.map((other) => new Date(other.closesAt).getTime()));
      expect(new Date(match.listing.closesAt).getTime()).toBe(latest);
    }
  });
});
