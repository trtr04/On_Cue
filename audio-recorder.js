function mergeChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.length; });
  return merged;
}

function resample16k(samples, sourceRate) {
  if (sourceRate === 16000) return samples;
  const ratio = sourceRate / 16000;
  const output = new Float32Array(Math.round(samples.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), samples.length);
    let total = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) total += samples[sourceIndex];
    output[index] = total / Math.max(1, end - start);
  }
  return output;
}

function wavBlob(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  samples.forEach((sample) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += 2;
  });
  return new Blob([buffer], { type: "audio/wav" });
}

export class WavRecorder {
  active = null;

  async start({ limitSeconds = 90, onTick = () => {}, onLimit = () => {} } = {}) {
    if (this.active) throw new Error("已有录音正在进行");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error("当前浏览器不支持录音");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const context = new AudioContext();
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    const active = { stream, context, source, processor, silent, chunks: [], sampleRate: context.sampleRate, startedAt: Date.now(), timer: null };
    processor.onaudioprocess = (event) => active.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    source.connect(processor); processor.connect(silent); silent.connect(context.destination);
    active.timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - active.startedAt) / 1000);
      onTick(elapsed, limitSeconds);
      if (elapsed >= limitSeconds) this.stop().then(onLimit);
    }, 250);
    this.active = active;
  }

  async stop() {
    const active = this.active;
    if (!active) return null;
    this.active = null;
    clearInterval(active.timer);
    active.processor.disconnect(); active.source.disconnect(); active.silent.disconnect();
    active.stream.getTracks().forEach((track) => track.stop());
    await active.context.close();
    return wavBlob(resample16k(mergeChunks(active.chunks), active.sampleRate));
  }
}
