
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      const pcm = input[0].map(sample => Math.max(-1, Math.min(1, sample)) * 32767);
      this.port.postMessage(Int16Array.from(pcm));
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
