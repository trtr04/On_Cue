import patterns from "../../../classic-training/zenmeban-dialogue-advisor/references/knowledge/patterns.json";
import scenes from "../../../classic-training/zenmeban-dialogue-advisor/references/knowledge/scenes.json";
import strategies from "../../../classic-training/zenmeban-dialogue-advisor/references/knowledge/strategies.json";
import voiceProfiles from "../../../classic-training/zenmeban-dialogue-advisor/references/core/voice-profiles.json";
import voiceRouter from "../../../classic-training/zenmeban-dialogue-advisor/references/core/voice-router.json";
import systemPrompt from "../../../classic-training/zenmeban-dialogue-advisor/references/core/system-prompt.md?raw";
import {
  buildGroundedPrompt,
  retrieveKnowledgeEvidence,
  validateGroundedAnalysis,
} from "../../../lib/knowledge-grounding.js";
import { runtimeEnv } from "../../../lib/runtime-env";

const MAX_TRANSCRIPT_LENGTH = 8_000;
const MAX_CONTEXT_LENGTH = 1_200;
const DEFAULT_API_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_SEGMENTS = 800;
const knowledge = { scenes, patterns, strategies };

type InputSegment = {
  id: string;
  speakerId: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
  isUserEdited: boolean;
};

function modelEndpoint() {
  const base = runtimeEnv("ONCUE_API_BASE_URL") || DEFAULT_API_BASE;
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("invalid_api_base");
  url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
  return url.toString();
}

function modelKey() {
  return runtimeEnv("ONCUE_API_KEY") || runtimeEnv("OPENAI_API_KEY");
}

function readModelJson(content: unknown) {
  const text = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

function sanitizeSegments(value: unknown): InputSegment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SEGMENTS).map((item, index) => {
    const segment = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const confidence = Number(segment.confidence);
    return {
      id: String(segment.id || `segment-${index + 1}`).slice(0, 80),
      speakerId: String(segment.speakerId || "待确认").slice(0, 80),
      text: String(segment.text || "").trim().slice(0, 1200),
      startMs: Math.max(0, Number(segment.startMs) || 0),
      endMs: Math.max(0, Number(segment.endMs) || 0),
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : null,
      isUserEdited: Boolean(segment.isUserEdited),
    };
  }).filter((segment) => segment.text);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    transcript?: unknown;
    context?: unknown;
    segments?: unknown;
  } | null;
  const transcript = String(body?.transcript || "").trim();
  const context = String(body?.context || "").trim();
  const segments = sanitizeSegments(body?.segments);
  if (!transcript) return Response.json({ error: "transcript_required" }, { status: 400 });
  if (transcript.length > MAX_TRANSCRIPT_LENGTH || context.length > MAX_CONTEXT_LENGTH) {
    return Response.json({ error: "analysis_input_too_large" }, { status: 413 });
  }

  const key = modelKey();
  if (!key) return Response.json({ error: "analysis_model_not_configured" }, { status: 503 });

  try {
    const retrieved = retrieveKnowledgeEvidence(`${transcript}\n${context}`, knowledge, 5);
    const response = await fetch(modelEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: runtimeEnv("ONCUE_ANALYSIS_MODEL") || DEFAULT_MODEL,
        temperature: 0.25,
        max_tokens: 3_500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: buildGroundedPrompt({
              transcript,
              context,
              segments,
              retrieved,
              voiceProfiles,
              voiceRouter,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;
    if (!response.ok) return Response.json({ error: "analysis_model_failed" }, { status: 502 });
    const output = readModelJson(payload?.choices?.[0]?.message?.content);
    return Response.json(validateGroundedAnalysis(output, retrieved, knowledge, { transcript, voiceProfiles }));
  } catch {
    return Response.json({ error: "grounded_analysis_failed" }, { status: 502 });
  }
}
