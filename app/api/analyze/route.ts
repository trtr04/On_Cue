import patterns from "../../../classic-training/zenmeban-dialogue-advisor/references/knowledge/patterns.json";
import scenes from "../../../classic-training/zenmeban-dialogue-advisor/references/knowledge/scenes.json";
import strategies from "../../../classic-training/zenmeban-dialogue-advisor/references/knowledge/strategies.json";
import voiceProfiles from "../../../classic-training/zenmeban-dialogue-advisor/references/core/voice-profiles.json";
import voiceRouter from "../../../classic-training/zenmeban-dialogue-advisor/references/core/voice-router.json";
import {
  buildSingleSkillPrompt,
  buildSingleSkillSystemPrompt,
  buildSkillRepairPrompt,
  retrieveKnowledgeEvidence,
  skillVoiceQualityIssues,
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

async function requestSkillAnalysis({
  key,
  profile,
  transcript,
  context,
  segments,
  retrieved,
}: {
  key: string;
  profile: (typeof voiceProfiles)[number];
  transcript: string;
  context: string;
  segments: InputSegment[];
  retrieved: ReturnType<typeof retrieveKnowledgeEvidence>;
}) {
  const callModel = async (repairIssues: string[] = [], previousVoice?: unknown) => {
    const response = await fetch(modelEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: runtimeEnv("ONCUE_ANALYSIS_MODEL") || DEFAULT_MODEL,
        temperature: repairIssues.length ? 0.32 : 0.48,
        max_tokens: 2_400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSingleSkillSystemPrompt(profile) },
          {
            role: "user",
            content: repairIssues.length
              ? buildSkillRepairPrompt({ transcript, context, profile, previousVoice, issues: repairIssues })
              : buildSingleSkillPrompt({ transcript, context, segments, retrieved, profile }),
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;
    if (!response.ok) throw new Error(`analysis_model_failed_${profile.voice_id}`);
    return readModelJson(payload?.choices?.[0]?.message?.content);
  };

  let output = await callModel();
  const firstIssues = skillVoiceQualityIssues(output, profile, transcript);
  if (firstIssues.length) {
    const repaired = await callModel(firstIssues, output.voice);
    output = { ...output, voice: repaired.voice };
  }
  const remainingIssues = skillVoiceQualityIssues(output, profile, transcript);
  if (remainingIssues.length) {
    throw new Error(`skill_quality_failed_${profile.voice_id}:${remainingIssues.join("|")}`);
  }
  return { profile, output };
}

function primaryVoiceForScene(retrieved: ReturnType<typeof retrieveKnowledgeEvidence>) {
  const category = String(retrieved[0]?.scene?.category_id || "");
  const candidate = (voiceRouter.category_primary as Record<string, string>)[category];
  return ["A", "B", "C"].includes(candidate) ? candidate : "B";
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
    const roleResults = await Promise.all(voiceProfiles.map((profile) => requestSkillAnalysis({
      key,
      profile,
      transcript,
      context,
      segments,
      retrieved,
    })));
    const primaryVoice = primaryVoiceForScene(retrieved);
    const shared = roleResults.find(({ profile }) => profile.voice_id === primaryVoice)?.output
      || roleResults[0].output;
    const riskLevel = String(shared.risk_level || "none");
    const defaultOrder = [primaryVoice, ...["A", "B", "C"].filter((id) => id !== primaryVoice)];
    const voiceOrder = riskLevel === "urgent" ? voiceRouter.urgent_voice_order : defaultOrder;
    const output = {
      ...shared,
      uncertainty: shared.uncertainty
        || shared.ambiguity_analysis?.missing_information?.[0]
        || "仍需确认对方最在意的结果。",
      primary_voice: primaryVoice,
      voice_order: voiceOrder,
      voice_versions: Object.fromEntries(roleResults.map(({ profile, output: roleOutput }) => [
        profile.voice_id,
        roleOutput.voice,
      ])),
    };
    return Response.json(validateGroundedAnalysis(output, retrieved, knowledge, { transcript, voiceProfiles }));
  } catch (error) {
    console.error("Grounded skill analysis failed", error instanceof Error ? error.message : "unknown_error");
    return Response.json({ error: "grounded_analysis_failed" }, { status: 502 });
  }
}
