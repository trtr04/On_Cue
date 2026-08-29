const TRANSFORMER_URLS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2/+esm",
  "https://unpkg.com/@huggingface/transformers@3.5.2/+esm",
];
const LOCAL_MODEL = "Xenova/whisper-base";
const MODEL_HOSTS = ["https://huggingface.co/", "https://hf-mirror.com/"];

const PLACEHOLDER_SNIPPETS = [
  "自动转写会出现在这里",
  "这里会填入这次录音",
  "这里会自动填入",
  "正在整理这次录音",
  "正在听，请开始说话",
  "没有录到音频",
  "转写失败",
  "自动转写暂时失败",
  "首次转写需要加载",
];

let localPipelinePromise = null;

export function isTranscriptPlaceholder(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return PLACEHOLDER_SNIPPETS.some((snippet) => text.includes(snippet));
}

export function parseTranscriptTurns(value) {
  const text = String(value || "").trim();
  if (!text || isTranscriptPlaceholder(text)) return [];
  const turns = [];
  text.split(/\n+/).forEach((line) => {
    const match = line.match(/^([^：:]{1,12})[：:]\s*(.*)$/);
    if (match) {
      turns.push({ speaker: match[1].trim() || "我", text: match[2].trim() });
      return;
    }
    if (turns.length) {
      turns[turns.length - 1].text = `${turns[turns.length - 1].text}\n${line}`.trim();
      return;
    }
    turns.push({ speaker: "我", text: line.trim() });
  });
  return turns.filter((turn) => turn.speaker || turn.text);
}

export function serializeTranscriptTurns(turns) {
  return (turns || [])
    .map((turn) => {
      const speaker = String(turn.speaker || "我").trim() || "我";
      const text = String(turn.text || "").trim();
      return text ? `${speaker}：${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function formatTranscriptText(value) {
  const text = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return "";
  if (/^(我|对方|导师|领导|家人|同事)[：:]/m.test(text) || text.includes("\n")) {
    return text.replace(/^(\S+):/gm, "$1：");
  }
  return `我：${text}`;
}

export function filenameForAudio(blob, fallback = "recording.webm") {
  const type = String(blob?.type || "").toLowerCase();
  if (type.includes("mp4") || type.includes("aac") || type.includes("m4a")) return "recording.m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "recording.mp3";
  if (type.includes("wav")) return "recording.wav";
  if (type.includes("ogg")) return "recording.ogg";
  if (type.includes("webm")) return "recording.webm";
  return fallback;
}

export function blobFromDataUrl(dataUrl) {
  const value = String(dataUrl || "");
  const comma = value.indexOf(",");
  if (comma < 0) return null;
  const header = value.slice(0, comma);
  const data = value.slice(comma + 1);
  const mime = header.match(/data:(.*?);/)?.[1] || "audio/webm";
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

async function transcribeViaApi(blob) {
  const form = new FormData();
  form.append("audio", blob, filenameForAudio(blob));
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `api_${response.status}`);
  }
  const payload = await response.json();
  const text = formatTranscriptText(payload?.text);
  if (!text) throw new Error("empty_api_transcript");
  return { text, source: payload.source || "api" };
}

async function loadTransformers() {
  let lastError = null;
  for (const url of TRANSFORMER_URLS) {
    try {
      return await import(/* @vite-ignore */ url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("transformers_unavailable");
}

async function decodeToWhisperAudio(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("no_audio_context");
  const context = new AudioContextClass();
  try {
    const copied = (await blob.arrayBuffer()).slice(0);
    const buffer = await context.decodeAudioData(copied);
    const channel = buffer.numberOfChannels > 1 ? mixToMono(buffer) : buffer.getChannelData(0);
    const samples = resample(channel, buffer.sampleRate, 16000);
    return { raw: samples, sampling_rate: 16000 };
  } finally {
    await context.close().catch(() => {});
  }
}

function mixToMono(buffer) {
  const length = buffer.length;
  const mixed = new Float32Array(length);
  const count = buffer.numberOfChannels;
  for (let channel = 0; channel < count; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) mixed[index] += data[index] / count;
  }
  return mixed;
}

function resample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const t = position - left;
    output[index] = input[left] * (1 - t) + input[right] * t;
  }
  return output;
}

async function createLocalPipeline(remoteHost) {
  const { pipeline, env } = await loadTransformers();
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  if (remoteHost) env.remoteHost = remoteHost;
  try {
    return await pipeline("automatic-speech-recognition", LOCAL_MODEL, { dtype: "q8" });
  } catch {
    return pipeline("automatic-speech-recognition", LOCAL_MODEL);
  }
}

async function getLocalPipeline() {
  if (!localPipelinePromise) {
    localPipelinePromise = (async () => {
      let lastError = null;
      for (const host of MODEL_HOSTS) {
        try {
          return await createLocalPipeline(host);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("local_model_failed");
    })();
  }
  try {
    return await localPipelinePromise;
  } catch (error) {
    localPipelinePromise = null;
    throw error;
  }
}

async function transcribeViaLocalWhisper(blob) {
  const transcriber = await getLocalPipeline();
  const audio = await decodeToWhisperAudio(blob);
  const result = await transcriber(audio.raw, {
    language: "chinese",
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const text = formatTranscriptText(result?.text);
  if (!text) throw new Error("empty_local_transcript");
  return { text, source: "whisper-local" };
}

export async function transcribeAudioBlob(blob, { onStatus } = {}) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("missing_audio");
  }
  onStatus?.("cloud");
  try {
    return await transcribeViaApi(blob);
  } catch {
    onStatus?.("local");
    return await transcribeViaLocalWhisper(blob);
  }
}
