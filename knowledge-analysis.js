const KNOWLEDGE_PATHS = {
  scenes: "/knowledge/scenes.json",
  patterns: "/knowledge/patterns.json",
  strategies: "/knowledge/strategies.json",
};

const CATEGORY_HINTS = {
  campus: ["导师", "老师", "同学", "校园", "奖学金", "课程", "小组"],
  workplace: ["领导", "老板", "同事", "项目", "加班", "薪资", "面试", "工作"],
  family: ["父母", "妈妈", "爸爸", "亲戚", "家里", "催婚", "孩子"],
  intimate: ["对象", "男友", "女友", "伴侣", "恋爱", "分手"],
  friends: ["朋友", "闺蜜", "聚会"],
  online: ["群聊", "朋友圈", "网友", "评论", "私信"],
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function termsFrom(text) {
  const compact = normalize(text);
  const terms = new Set();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      terms.add(compact.slice(index, index + size));
    }
  }
  return [...terms];
}

function textList(value) {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((item) => (typeof item === "string" ? item : Object.values(item || {})))
    .join(" ");
}

function scoreScene(query, scene) {
  const terms = termsFrom(query);
  const title = normalize(`${scene.title || ""} ${scene.scene_archetype || ""}`);
  const aliases = normalize(textList(scene.search_aliases));
  const dialogue = normalize(textList(scene.dialogue));
  const facts = normalize(textList(scene.observable_facts));
  const wider = normalize(
    `${scene.scene_category || ""} ${scene.relationship_dynamics || ""} ${textList(scene.tags)} ${textList(scene.interaction_type)}`,
  );

  let score = 0;
  terms.forEach((term) => {
    if (title.includes(term)) score += term.length * 8;
    if (aliases.includes(term)) score += term.length * 6;
    if (dialogue.includes(term)) score += term.length * 4;
    if (facts.includes(term)) score += term.length * 3;
    if (wider.includes(term)) score += term.length * 2;
  });

  const compactQuery = normalize(query);
  Object.entries(CATEGORY_HINTS).forEach(([category, hints]) => {
    if (scene.category_id !== category) return;
    score += hints.filter((hint) => compactQuery.includes(hint)).length * 30;
  });
  return score;
}

function resolveReferences(references, collection, key = "id") {
  const wanted = new Set(
    (references || []).map((item) => (typeof item === "string" ? item : item.pattern_id || item.strategy_id)),
  );
  return (collection || []).filter((item) => wanted.has(item[key]));
}

export function analyzeConfirmedTranscript(transcript, knowledge) {
  const confirmedText = String(transcript || "").trim();
  if (!confirmedText) throw new Error("TRANSCRIPT_REQUIRED");
  if (!knowledge || !Array.isArray(knowledge.scenes) || knowledge.scenes.length === 0) {
    throw new Error("KNOWLEDGE_BASE_UNAVAILABLE");
  }

  const ranked = knowledge.scenes
    .map((scene) => ({ scene, score: scoreScene(confirmedText, scene) }))
    .sort((left, right) => right.score - left.score || left.scene.id.localeCompare(right.scene.id));
  const best = ranked[0].scene;
  const voices = best.voice_versions || {};
  if (!["A", "B", "C"].every((voice) => voices[voice])) {
    throw new Error("KNOWLEDGE_VOICE_CONTRACT_INVALID");
  }

  const evidence = (best.observable_facts || []).slice(0, 3);
  return {
    scene: best,
    sceneRead: best.scene_read,
    voices,
    voiceOrder: best.voice_order || ["A", "B", "C"],
    primaryVoice: best.primary_voice || "B",
    evidence,
    patterns: resolveReferences(best.pattern_refs, knowledge.patterns),
    strategies: resolveReferences(best.strategy_refs, knowledge.strategies),
    uncertainty: best.uncertainty || "知识库匹配只提供相似场景参考，结论需要随新信息更新。",
    riskLevel: best.risk_level || "none",
    confidence: ranked[0].score > 180 ? "high" : ranked[0].score > 70 ? "medium" : "low",
    alternatives: ranked.slice(1, 3).map(({ scene, score }) => ({ id: scene.id, title: scene.title, score })),
    sourceStats: {
      scenes: knowledge.scenes.length,
      patterns: knowledge.patterns?.length || 0,
      strategies: knowledge.strategies?.length || 0,
    },
  };
}

function assertKnowledgeArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`INVALID_KNOWLEDGE_${name.toUpperCase()}`);
  return value;
}

export async function loadKnowledgeBase(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("FETCH_UNAVAILABLE");
  const entries = await Promise.all(
    Object.entries(KNOWLEDGE_PATHS).map(async ([name, path]) => {
      const response = await fetchImpl(path, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`KNOWLEDGE_LOAD_FAILED_${name.toUpperCase()}`);
      return [name, assertKnowledgeArray(await response.json(), name)];
    }),
  );
  return Object.fromEntries(entries);
}

