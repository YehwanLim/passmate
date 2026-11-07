// 마이크 음성을 메인 스레드로 넘기는 AudioWorklet. 변환은 메인 스레드에서 한다.
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
