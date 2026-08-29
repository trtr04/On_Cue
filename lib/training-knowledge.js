const MODULE_RULES = Object.freeze({
  "pua-workplace-general": {
    sources: ["职场PUA话术集合.md"],
    label: "通用职场压力话术库",
  },
  "pua-workplace-interview": {
    sources: ["女性职场PUA话术.md"],
    label: "女性职场面试越界话术库",
    text: /简历|应聘|岗位|男朋友|结婚|要孩子|招女生|月经|稳定投入/,
  },
  "pua-workplace-accountability": {
    sources: ["职场PUA话术集合.md"],
    label: "职场追责与能力施压话术库",
    text: /项目|时间安排|推动|态度|别人都能|同事都|主见|不行|问题|能力/,
  },
  "pua-workplace-overtime": {
    sources: ["职场PUA话术集合.md"],
    label: "加班与周末边界话术库",
    text: /加班|周末|休息天|晚上|领导还没走|电话为什么|多做一点|额外增加/,
  },
  "pua-workplace-compensation": {
    sources: ["职场PUA话术集合.md"],
    label: "薪资、成长与回报话术库",
    text: /工资|涨薪|成本|房租水电|成长|机会|升职|放权|挑大梁/,
  },
  "pua-workplace-gender": {
    sources: ["女性职场PUA话术.md"],
    label: "女性职场性别与婚育偏见话术库",
  },
  "pua-workplace-emotional-pressure": {
    sources: ["职场PUA话术集合.md"],
    label: "感恩、忠诚与态度绑架话术库",
    text: /失望|感恩|为了你好|苦心|态度|珍惜|知足|随时可以走|找不到工作|不合群|成长/,
  },
  "pua-family-marriage": {
    sources: ["家庭PUA话术.md"],
    label: "家庭催婚催生话术库",
    section: /催婚|催生/,
  },
  "pua-family-prying": {
    sources: ["家庭PUA话术.md"],
    label: "亲戚隐私打听话术库",
    section: /亲戚聚会|打听/,
  },
  "pua-family-son-preference": {
    sources: ["家庭PUA话术.md"],
    label: "家庭重男轻女话术库",
    section: /重男轻女/,
  },
  "pua-family-emotion-dumping": {
    sources: ["家庭PUA话术.md"],
    label: "家庭负面情绪转移话术库",
    section: /负面情绪|挫折教育/,
  },
});

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function tokens(value) {
  const text = normalize(value);
  const result = new Set();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= text.length - size; index += 1) {
      result.add(text.slice(index, index + size));
    }
  }
  return result;
}

function parseCorpus(source, markdown) {
  let section = source.replace(/\.md$/i, "");
  const entries = [];
  String(markdown || "").split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (/^#{1,3}\s+/.test(line)) {
      section = line.replace(/^#{1,3}\s+/, "").trim();
      return;
    }
    const text = line.replace(/^[-*]\s+/, "").trim();
    if (text.length < 6) return;
    entries.push({
      id: `${source}:${entries.length + 1}`,
      source,
      section,
      text,
    });
  });
  return entries;
}

export function buildTrainingKnowledge(corpora) {
  return Object.entries(corpora || {}).flatMap(([source, markdown]) => parseCorpus(source, markdown));
}

export function getTrainingKnowledgeRule(moduleId) {
  const rule = MODULE_RULES[moduleId];
  if (!rule) throw new Error("TRAINING_KNOWLEDGE_MODULE_NOT_FOUND");
  return rule;
}

function candidatesFor(moduleId, knowledge) {
  const rule = getTrainingKnowledgeRule(moduleId);
  const sourceSet = new Set(rule.sources);
  const candidates = (knowledge || []).filter((item) =>
    sourceSet.has(item.source)
    && (!rule.section || rule.section.test(item.section))
    && (!rule.text || rule.text.test(item.text)),
  );
  if (!candidates.length) throw new Error("TRAINING_KNOWLEDGE_EMPTY");
  return candidates;
}

function similarity(queryTokens, item) {
  const itemTokens = tokens(`${item.section} ${item.text}`);
  let overlap = 0;
  queryTokens.forEach((token) => {
    if (itemTokens.has(token)) overlap += token.length;
  });
  return overlap;
}

export function retrieveTrainingEvidence({
  moduleId,
  query,
  knowledge,
  previousOpponentMessages = [],
  limit = 4,
}) {
  const queryTokens = tokens(query);
  const previous = previousOpponentMessages.map(normalize).filter(Boolean);
  return candidatesFor(moduleId, knowledge)
    .filter((item) => !previous.some((message) => {
      const candidate = normalize(item.text);
      return candidate && (message.includes(candidate) || candidate.includes(message));
    }))
    .map((item) => ({ item, score: similarity(queryTokens, item) }))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, Math.max(1, Math.min(Number(limit) || 4, 6)))
    .map(({ item }) => item);
}

export function trainingKnowledgeMetadata(moduleId, evidence) {
  const rule = getTrainingKnowledgeRule(moduleId);
  return {
    module_id: moduleId,
    label: rule.label,
    sources: [...new Set((evidence || []).map((item) => item.source))],
    retrieved_count: (evidence || []).length,
    source: "module-knowledge+model",
  };
}

export function formatTrainingEvidence(evidence) {
  return JSON.stringify((evidence || []).map(({ id, source, section, text }) => ({
    id,
    source,
    section,
    text,
  })));
}
