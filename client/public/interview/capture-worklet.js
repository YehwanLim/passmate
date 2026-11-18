// 마이크 음성을 메인 스레드로 넘기는 AudioWorklet. 변환(16kHz 16비트)은 메인 스레드에서 한다.
// 정적 파일로 두는 이유: 배포 CSP(script-src)에 blob: 이 없어 blob URL 모듈은 막힌다.
class InterviewCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor("interview-capture", InterviewCaptureProcessor);
