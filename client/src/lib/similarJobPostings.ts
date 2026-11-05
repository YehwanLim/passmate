import { openPostings } from "./jobPostingDates";

/**
 * 마감된 공고 페이지 아래 "지금 지원할 수 있는 비슷한 공고"를 고른다. 기준은 셋뿐이다.
 *  1. 같은 회사의 다른 접수 중 공고를 맨 앞에(마감 가까운 순)
 *  2. 공고 제목·모집 직무에서 직무 낱말(영업·마케팅·연구…)이 많이 겹칠수록 앞에, 같으면 마감 가까운 순
 *  3. 그래도 모자라면 겹치는 낱말이 없는 접수 중 공고를 마감 가까운 순으로 채운다
 * 지금 공고 자신과 마감된 공고는 넣지 않는다. 공고 수와 상관없이 같은 규칙으로 동작한다.
 */
export type SimilarPostingFields = {
  slug: string;
  company: string;
  title: string;
  roles: string;
  closesAt: string;
};

/**
 * 직무 낱말 묶음. 앞 이름 하나로 세고, 뒤는 같은 뜻으로 치는 표기다.
 * 영문 표기는 단어 경계로만 맞춘다("IT"가 "Security" 안에서 걸리지 않게). lookbehind 는 옛 iOS Safari 가 못 읽어 쓰지 않는다.
 */
const ROLE_WORDS: readonly (readonly string[])[] = [
  ["영업", "MR", "PB", "Sales"],
  ["마케팅"],
  ["연구", "R&D"],
  ["개발", "SW", "IT", "전산"],
  ["생산", "제조", "공정"],
  ["품질", "QA", "QC"],
  ["재무", "재경", "회계", "자금"],
  ["인사", "노무"],
  ["구매"],
  ["물류", "SCM"],
  ["기획"],
  ["경영지원", "경영관리"],
  ["안전"],
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = ROLE_WORDS.map(
  words =>
    new RegExp(
      words
        .map(word =>
          /^[A-Za-z&]+$/.test(word)
            ? `(?:^|[^A-Za-z])${escape(word)}(?![A-Za-z])`
            : escape(word)
        )
        .join("|"),
      "i"
    )
);

/** 제목·모집 직무에 나오는 직무 낱말 묶음의 번호 */
export function roleWords(
  posting: Pick<SimilarPostingFields, "title" | "roles">
): Set<number> {
  const text = `${posting.title} ${posting.roles}`;
  const found = new Set<number>();
  MATCHERS.forEach((matcher, index) => {
    if (matcher.test(text)) found.add(index);
  });
  return found;
}

export function similarOpenPostings<T extends SimilarPostingFields>(
  current: SimilarPostingFields,
  list: readonly T[],
  now: Date,
  limit = 3
): T[] {
  // openPostings 가 이미 마감 가까운 순이고 sort 는 안정 정렬이라, 아래 정렬에서 같은 순위는 마감 순이 유지된다.
  const candidates = openPostings(list, now).filter(
    posting => posting.slug !== current.slug
  );
  const mine = roleWords(current);
  const overlap = (posting: T) => {
    let count = 0;
    roleWords(posting).forEach(index => {
      if (mine.has(index)) count += 1;
    });
    return count;
  };
  // 같은 회사는 어떤 겹침 수보다 높은 순위를 준다.
  const sameCompany = ROLE_WORDS.length + 1;
  const rank = new Map(
    candidates.map(posting => [
      posting,
      posting.company === current.company ? sameCompany : overlap(posting),
    ])
  );
  return [...candidates]
    .sort((a, b) => rank.get(b)! - rank.get(a)!)
    .slice(0, Math.max(0, limit));
}
