const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const TRANSCRIBE_PROMPT = "这是一段中文对话现场录音，请逐字转写原话，不要总结，不要翻译。";

type Provider = {
  source: string;
  url: string;
  key: string;
  model: string;
};

function providers(): Provider[] {
  const oncueKey = process.env.ONCUE_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const list: Provider[] = [];
  if (oncueKey) {
    const base = new URL((process.env.ONCUE_API_BASE_URL || "https://api.openai.com/v1").trim());
    if (base.protocol !== "https:") throw new Error("ONCUE_API_BASE_URL must use https");
    base.pathname = `${base.pathname.replace(/\/$/, "")}/audio/transcriptions`;
    list.push({
      source: "oncue",
      url: base.toString(),
      key: oncueKey,
      model: process.env.ONCUE_STT_MODEL?.trim() || "gpt-4o-mini-transcribe",
    });
  }
  if (groqKey) {
    list.push({
      source: "groq",
      url: GROQ_URL,
      key: groqKey,
      model: "whisper-large-v3-turbo",
    });
  }
  if (openaiKey) {
    list.push(
      {
        source: "openai",
        url: OPENAI_URL,
        key: openaiKey,
        model: "gpt-4o-mini-transcribe",
      },
      {
        source: "openai",
        url: OPENAI_URL,
        key: openaiKey,
        model: "whisper-1",
      },
    );
  }
  return list;
}

function extensionFor(type: string, name: string): string {
  const hint = `${type} ${name}`.toLowerCase();
  if (hint.includes("mp4") || hint.includes("aac") || hint.includes("m4a")) return "m4a";
  if (hint.includes("mpeg") || hint.includes("mp3")) return "mp3";
  if (hint.includes("wav")) return "wav";
  if (hint.includes("ogg")) return "ogg";
  if (hint.includes("mpga")) return "mpga";
  return "webm";
}

async function transcribeWith(provider: Provider, audio: Blob, filename: string) {
  const body = new FormData();
  body.append("file", audio, filename);
  body.append("model", provider.model);
  body.append("language", "zh");
  body.append("response_format", "json");
  body.append("prompt", TRANSCRIBE_PROMPT);

  const response = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}` },
    body,
  });
  const payload = (await response.json().catch(() => null)) as { text?: string; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `${provider.source} ${response.status}`);
  }
  const text = String(payload?.text || "").trim();
  if (!text) throw new Error(`${provider.source} empty`);
  return { text, source: provider.source, model: provider.model };
}

export async function POST(request: Request) {
  const available = providers();
  if (available.length === 0) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "missing_audio" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio_too_large" }, { status: 413 });
  }

  const originalName = audio instanceof File ? audio.name : "recording.webm";
  const filename = `recording.${extensionFor(audio.type, originalName)}`;
  const errors: string[] = [];

  for (const provider of available) {
    try {
      const result = await transcribeWith(provider, audio, filename);
      return Response.json(result);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return Response.json({ error: "transcription_failed", details: errors.slice(0, 3) }, { status: 502 });
}
