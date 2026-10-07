// 근거 글에 없는 숫자를 빈칸으로 바꾸는 공용 검사. 경험→초안(lib/experience-draft.js)과
// 경험 자동 채우기(lib/experience-extract.js)가 함께 쓴다.
export const BLANK_NUMBER = "[실제 수치]";
// 숫자 + (선택) 단위. 1,200 / 30% / 3개월 / 2.5배. 공백은 단위가 붙을 때만 토큰에 넣는다.
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?(?:\s*(?:%|퍼센트|명|배|만\s*원|원|만|억|건|개월|개|회|시간|일|주|년|위|점))?/g;

// "09" 와 "9", "2.80" 과 "2.8" 을 같게 본다.
function canonical(core) {
  return String(Number(core));
}

// 근거 글에 있는 숫자. "2024.09" 처럼 점으로 쓴 날짜는 소수로도, 연·월로도 인정한다.
export function numberCores(text) {
  const cores = new Set();
  for (const match of String(text ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []) {
    cores.add(canonical(match));
    if (match.includes(".")) for (const part of match.split(".")) cores.add(canonical(part));
  }
  return cores;
}

export function guardNumbers(text, allowed) {
  let replaced = 0;
  const next = text.replace(NUMBER_TOKEN, (token) => {
    const core = token.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
    if (core && allowed.has(canonical(core))) return token;
    replaced += 1;
    return BLANK_NUMBER;
  });
  return { text: next, replaced };
}
