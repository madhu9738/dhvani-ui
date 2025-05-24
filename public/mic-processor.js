class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      for (let i = 0; i < input[0].length; i++) {
        const sample = Math.max(-1, Math.min(1, input[0][i])) * 32767;
        this.frame.push(sample);
        if (this.frame.length === 480) {
          this.port.postMessage(Int16Array.from(this.frame));
          this.frame = [];
        }
      }
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
