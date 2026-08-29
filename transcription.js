const PLACEHOLDER_SNIPPETS = [
  "自动转写会出现在这里",
  "这里会填入这次录音",
  "转写内容会显示在这里",
  "这里会自动填入",
  "正在整理这次录音",
  "正在整理录音转写",
  "正在听，请开始说话",
  "没有录到音频",
  "转写失败",
  "自动转写暂时失败",
  "首次转写需要加载",
];

export function isTranscriptPlaceholder(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return PLACEHOLDER_SNIPPETS.some((snippet) => text.includes(snippet));
}

export function splitTranscriptSentences(value) {
  const text = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!text) return [];
  return (text.match(/[^。！？!?；;.\n]+[。！？!?；;.]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function parseTranscriptTurns(value) {
  const text = String(value || "").trim();
  if (!text || isTranscriptPlaceholder(text)) return [];
  const turns = [];
  text.split(/\n+/).forEach((line) => {
    const match = line.match(/^([^：:]{1,12})[：:]\s*(.*)$/);
    const speaker = match ? match[1].trim() || "待确认" : "待确认";
    const content = match ? match[2] : line;
    splitTranscriptSentences(content).forEach((sentence) => {
      turns.push({ speaker, text: sentence });
    });
  });
  return turns.filter((turn) => turn.speaker || turn.text);
}

function speakerName(index, speakerId) {
  if (index === 0) return "对方";
  if (index === 1) return "我";
  return `说话人 ${String(speakerId || index + 1).slice(0, 12)}`;
}

export function normalizeDiarizedSegments(value) {
  if (!Array.isArray(value)) return [];
  const speakers = new Map();
  const turns = [];
  value.slice(0, 800).forEach((raw, segmentIndex) => {
    if (!raw || typeof raw !== "object") return;
    const speakerId = String(raw.speakerId ?? raw.speaker ?? "").trim().slice(0, 40);
    const segmentText = String(raw.text || "").trim().slice(0, 2_000);
    if (!speakerId || !segmentText) return;
    if (!speakers.has(speakerId)) speakers.set(speakerId, speakerName(speakers.size, speakerId));
    const sentences = splitTranscriptSentences(segmentText);
    if (!sentences.length) return;
    const rawStart = Number(raw.startMs ?? Number(raw.start) * 1_000);
    const rawEnd = Number(raw.endMs ?? Number(raw.end) * 1_000);
    const startMs = Number.isFinite(rawStart) ? Math.max(0, Math.round(rawStart)) : 0;
    const endMs = Number.isFinite(rawEnd) ? Math.max(startMs, Math.round(rawEnd)) : startMs;
    const totalWeight = sentences.reduce((sum, sentence) => sum + Math.max(1, sentence.length), 0);
    let consumedWeight = 0;
    sentences.forEach((sentence, sentenceIndex) => {
      const sentenceWeight = Math.max(1, sentence.length);
      const sentenceStart = startMs + Math.round((endMs - startMs) * consumedWeight / totalWeight);
      consumedWeight += sentenceWeight;
      const sentenceEnd = sentenceIndex === sentences.length - 1
        ? endMs
        : startMs + Math.round((endMs - startMs) * consumedWeight / totalWeight);
      turns.push({
        id: `${String(raw.id || `segment-${segmentIndex + 1}`).slice(0, 80)}-${sentenceIndex + 1}`,
        speaker: speakers.get(speakerId),
        speakerId,
        text: sentence,
        startMs: sentenceStart,
        endMs: sentenceEnd,
        confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : null,
        isUserEdited: false,
      });
    });
  });
  return turns;
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
  if (/^[^：:\n]{1,12}[：:]/m.test(text) || text.includes("\n")) {
    return text.replace(/^(\S+):/gm, "$1：");
  }
  return `待确认：${text}`;
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
  return {
    text,
    segments: normalizeDiarizedSegments(payload?.segments),
    source: payload.source || "api",
    model: payload.model || "",
    diarized: Boolean(payload?.diarized),
  };
}

export function transcriptionPlan() {
  return ["api"];
}

export async function transcribeAudioBlob(blob, { onStatus } = {}) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("missing_audio");
  }
  onStatus?.("api");
  return transcribeViaApi(blob);
}
