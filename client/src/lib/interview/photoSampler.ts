// 피드백용 사진 표본. 면접 내내 찍힌 사진 가운데 지원자가 말하던 순간을 고르게 남긴다.
// 서버에는 끝난 뒤 한 번만 보내고, 저장되지 않는다. 메모리에만 있어 탭을 닫으면 사라진다.

export const PHOTO_SAMPLE_MAX = 12;

export type PhotoSample = { data: string; at: number };

/**
 * 고르게 남기기: 가득 차면 가장 촘촘한 간격의 사진을 하나 빼고 넣는다.
 * 그러면 결과가 시간 축에 대체로 균등하게 퍼진다(완벽한 균등은 아니고 그 정도로 충분하다).
 */
export function createPhotoSampler(max = PHOTO_SAMPLE_MAX) {
  const samples: PhotoSample[] = [];
  return {
    offer(data: string, at: number, speaking: boolean) {
      if (!speaking) return;
      samples.push({ data, at });
      if (samples.length <= max) return;
      let dropIndex = 1;
      let smallestGap = Number.POSITIVE_INFINITY;
      for (let index = 1; index < samples.length - 1; index += 1) {
        const gap = samples[index + 1].at - samples[index - 1].at;
        if (gap < smallestGap) {
          smallestGap = gap;
          dropIndex = index;
        }
      }
      samples.splice(dropIndex, 1);
    },
    take(): string[] {
      return samples.map((sample) => sample.data);
    },
    get size() {
      return samples.length;
    },
  };
}

export type PhotoSampler = ReturnType<typeof createPhotoSampler>;
