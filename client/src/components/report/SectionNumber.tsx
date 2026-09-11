// 섹션 제목 앞의 흐린 번호. 잡지 폴리오처럼 제목과 같은 크기, 낮은 명도로 순서만 남긴다.
export function SectionNumber({ value }: { value: string }) {
  return <span className="mr-3.5 font-semibold tabular-nums text-zinc-700">{value}</span>;
}
