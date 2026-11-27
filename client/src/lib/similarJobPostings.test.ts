import { describe, expect, it } from "vitest";
import {
  roleWords,
  similarOpenPostings,
  type SimilarPostingFields,
} from "./similarJobPostings";

const NOW = new Date("2026-10-20T12:00:00+09:00");

function posting(
  slug: string,
  roles: string,
  closesAt: string,
  company = slug,
  title = `${slug} 공채`
): SimilarPostingFields {
  return { slug, company, title, roles, closesAt };
}

const current = posting(
  "closed-sales",
  "국내영업·마케팅",
  "2026-10-10T18:00:00+09:00",
  "가나식품"
);
const slugs = (list: readonly SimilarPostingFields[]) =>
  list.map(item => item.slug);

describe("similarOpenPostings", () => {
  it("puts more shared role words first, then fills by nearest deadline", () => {
    const list = [
      posting("rnd-soon", "연구개발", "2026-10-21T18:00:00+09:00"),
      posting("sales", "해외영업", "2026-10-30T18:00:00+09:00"),
      posting("sales-marketing", "영업·마케팅", "2026-11-05T18:00:00+09:00"),
      posting("hr-later", "인사", "2026-10-25T18:00:00+09:00"),
    ];
    expect(slugs(similarOpenPostings(current, list, NOW))).toEqual([
      "sales-marketing",
      "sales",
      "rnd-soon",
    ]);
  });

  it("puts another open posting of the same company in front", () => {
    const list = [
      posting("sales", "영업·마케팅", "2026-10-21T18:00:00+09:00"),
      posting("same-company", "구매", "2026-11-09T18:00:00+09:00", "가나식품"),
    ];
    expect(slugs(similarOpenPostings(current, list, NOW))[0]).toBe(
      "same-company"
    );
  });

  it("never returns the posting itself or closed ones", () => {
    const list = [
      current,
      posting("closed-other", "영업", "2026-10-19T18:00:00+09:00"),
      posting("open", "생산", "2026-10-28T18:00:00+09:00"),
    ];
    expect(slugs(similarOpenPostings(current, list, NOW))).toEqual(["open"]);
  });

  it("returns at most three, and fewer when fewer are open", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      posting(`p${i}`, "영업", `2026-10-2${i + 1}T18:00:00+09:00`)
    );
    expect(similarOpenPostings(current, many, NOW)).toHaveLength(3);
    expect(slugs(similarOpenPostings(current, many, NOW))).toEqual([
      "p0",
      "p1",
      "p2",
    ]);
    expect(similarOpenPostings(current, many.slice(0, 2), NOW)).toHaveLength(2);
  });

  it("returns nothing when no posting is open", () => {
    expect(
      similarOpenPostings(
        current,
        [current, posting("old", "영업", "2026-10-01T18:00:00+09:00")],
        NOW
      )
    ).toEqual([]);
    expect(similarOpenPostings(current, [], NOW)).toEqual([]);
  });
});

describe("roleWords", () => {
  it("reads synonyms as one word and matches English only as whole words", () => {
    expect(roleWords({ title: "", roles: "R&D·재경" })).toEqual(
      roleWords({ title: "", roles: "연구·재무" })
    );
    expect(roleWords({ title: "", roles: "Security" }).size).toBe(0);
    expect(roleWords({ title: "", roles: "IT 개발" }).size).toBe(1);
  });
});
