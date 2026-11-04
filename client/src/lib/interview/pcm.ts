// 오디오 변환 순수 함수. 마이크(보통 48kHz 실수) → Live 입력(16kHz 16비트), Live 출력(24kHz 16비트) → 재생용 실수.

export const LIVE_INPUT_SAMPLE_RATE = 16000;
export const LIVE_OUTPUT_SAMPLE_RATE = 24000;

/** 구간 평균으로 표본을 줄인다. 간단한 저역 통과 효과가 있어 쉿 소리가 덜 뭉개진다. */
export function downsampleToInt16(samples: Float32Array, inputRate: number, targetRate = LIVE_INPUT_SAMPLE_RATE): Int16Array {
  if (inputRate < targetRate) throw new Error("INPUT_RATE_TOO_LOW");
  const ratio = inputRate / targetRate;
  const length = Math.floor(samples.length / ratio);
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += samples[cursor];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    output[index] = value < 0 ? Math.round(value * 32768) : Math.round(value * 32767);
  }
  return output;
}

export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + 0x8000)));
  }
  return btoa(binary);
}

/** 서버가 보낸 16비트 PCM(base64)을 Web Audio 가 쓰는 -1~1 실수로 바꾼다. */
export function base64ToFloat32(data: string): Float32Array {
  const binary = atob(data);
  const output = new Float32Array(Math.floor(binary.length / 2));
  for (let index = 0; index < output.length; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    const value = (high << 8) | low;
    output[index] = (value >= 0x8000 ? value - 0x10000 : value) / 32768;
  }
  return output;
}

/** 음량(실효값). 마이크 레벨 표시와 "말하는 중" 판단에 쓴다. */
export function rootMeanSquare(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / samples.length);
}

/** 여러 블록을 하나로 이어 붙인다. 100ms 단위로 모아 보내기 위해 쓴다. */
export function concatFloat32(blocks: Float32Array[], total: number): Float32Array {
  const merged = new Float32Array(total);
  let offset = 0;
  for (const block of blocks) {
    merged.set(block, offset);
    offset += block.length;
  }
  return merged;
}
