const state = {
  sessionId: null,
  currentTurn: 0,
  maxTurns: 0,
  incidentId: null,
  mode: "classic",
  classicTitle: "领导质问项目进度",
  classicDescription: "练习在压力下先说现状，再给事实、方案和明确时间。",
  incidentStatus: null,
  activeCustomTraining: false,
};

const messages = document.querySelector("#messages");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const hintButton = document.querySelector("#hint-button");
const finishButton = document.querySelector("#finish-button");
const startButton = document.querySelector("#start-button");
const form = document.querySelector("#message-form");
const turnLabel = document.querySelector("#turn-label");
const statusText = document.querySelector("#status-text");
const reviewPanel = document.querySelector("#review-panel");
const hintCard = document.querySelector("#hint-card");
const classicFlow = document.querySelector("#classic-flow");
const incidentFlow = document.querySelector("#incident-flow");
const classicPathButton = document.querySelector("#classic-path-button");
const incidentPathButton = document.querySelector("#incident-path-button");
const incidentForm = document.querySelector("#incident-form");
const incidentDescription = document.querySelector("#incident-description");
const incidentSubmitButton = document.querySelector("#incident-submit-button");
const incidentDialoguePanel = document.querySelector("#incident-dialogue-panel");
const incidentMessages = document.querySelector("#incident-messages");
const incidentAnswerForm = document.querySelector("#incident-answer-form");
const incidentAnswer = document.querySelector("#incident-answer");
const incidentAnswerButton = document.querySelector("#incident-answer-button");
const confirmSceneButton = document.querySelector("#confirm-scene-button");
const startCustomTrainingButton = document.querySelector("#start-custom-training-button");
const sceneCard = document.querySelector("#scene-card");
const incidentSafety = document.querySelector("#incident-safety");

function setMode(mode) {
  state.mode = mode;
  const isClassic = mode === "classic";
  classicFlow.hidden = !isClassic;
  incidentFlow.hidden = isClassic;
  classicPathButton.classList.toggle("active", isClassic);
  incidentPathButton.classList.toggle("active", !isClassic);
  document.querySelector("#scene-title").textContent = isClassic
    ? state.classicTitle
    : "把真实经历变成可练的场景";
  document.querySelector("#scene-description").textContent = isClassic
    ? state.classicDescription
    : "不需要一次讲完整，系统会逐步帮你补齐关键事实。";
  if (isClassic && !state.sessionId && !state.activeCustomTraining) {
    document.querySelector("#setup-panel").hidden = false;
  }
}

function setIncidentBusy(isBusy, label = "") {
  incidentDescription.disabled = isBusy;
  incidentSubmitButton.disabled = isBusy;
  incidentAnswer.disabled = isBusy;
  incidentAnswerButton.disabled = isBusy;
  confirmSceneButton.disabled = isBusy || state.incidentStatus !== "ready";
  startCustomTrainingButton.disabled = isBusy || state.incidentStatus !== "confirmed";
  if (label) document.querySelector("#incident-status").textContent = label;
}

function renderSimpleList(selector, values, emptyText = "暂未提取") {
  const list = document.querySelector(selector);
  list.replaceChildren();
  (values.length ? values : [emptyText]).forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.appendChild(item);
  });
}

function renderSceneCard(incident) {
  const draft = incident.draft;
  const pressureLabels = { 1: "轻微压力", 2: "明显压力", 3: "高压" };
  document.querySelector("#scene-card-title").textContent = draft.title || "我的真实场景";
  document.querySelector("#scene-card-pressure").textContent = pressureLabels[draft.pressure_level] || "压力待确认";
  document.querySelector("#scene-card-summary").textContent = draft.situation_summary || "";
  document.querySelector("#scene-card-counterpart").textContent = [draft.counterpart_identity, draft.relationship].filter(Boolean).join(" · ");
  document.querySelector("#scene-card-setting").textContent = draft.setting || "没有限定具体地点";
  document.querySelector("#scene-card-trigger").textContent = draft.counterpart_words_or_actions.join("；");
  document.querySelector("#scene-card-response").textContent = draft.user_words_or_actions || "";
  document.querySelector("#scene-card-stuck").textContent = draft.stuck_point || "";
  document.querySelector("#scene-card-goal").textContent = draft.desired_outcome || "";
  renderSimpleList("#scene-card-focus", draft.learning_focus);
  renderSimpleList("#scene-card-role", draft.role_behavior);
  confirmSceneButton.disabled = incident.status === "confirmed";
  confirmSceneButton.textContent = incident.status === "confirmed" ? "场景已保存" : "确认并保存场景";
  startCustomTrainingButton.hidden = incident.status !== "confirmed";
  document.querySelector("#scene-card-status").textContent = incident.status === "confirmed"
    ? "已经保存，可以开始五轮模拟训练"
    : "请先检查这些内容是否符合真实情况";
  sceneCard.hidden = false;
}

function renderIncident(incident) {
  state.incidentId = incident.incident_id;
  state.incidentStatus = incident.status;
  document.querySelector("#incident-understanding").textContent = incident.acknowledgement;
  incidentMessages.replaceChildren();
  incident.messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `incident-message ${message.speaker}`;
    bubble.textContent = message.content;
    incidentMessages.appendChild(bubble);
  });
  incidentDialoguePanel.hidden = false;

  if (incident.status === "safety_redirect") {
    incidentAnswerForm.hidden = true;
    sceneCard.hidden = true;
    document.querySelector("#incident-safety-message").textContent = incident.safety_message || "请优先联系可信任的人或现实支持资源。";
    incidentSafety.hidden = false;
    return;
  }

  incidentSafety.hidden = true;
  const isReady = incident.status === "ready" || incident.status === "confirmed";
  incidentAnswerForm.hidden = isReady;
  if (isReady) {
    renderSceneCard(incident);
  } else {
    sceneCard.hidden = true;
    incidentAnswer.placeholder = incident.next_question || "按真实情况回答就好……";
    incidentAnswer.focus();
  }
}

function renderBriefing(briefing) {
  document.querySelector("#briefing-setting").textContent = briefing.setting;
  document.querySelector("#briefing-identity").textContent = `${briefing.user_identity}。对话对象：${briefing.counterpart}。`;
  document.querySelector("#briefing-summary").textContent = briefing.situation_summary;
  document.querySelector("#briefing-mission").textContent = briefing.user_mission;
  document.querySelector("#briefing-tip").textContent = briefing.preparation_tip;
  const facts = document.querySelector("#briefing-facts");
  facts.replaceChildren();
  briefing.facts.forEach((fact) => {
    const item = document.createElement("div");
    item.className = "fact-item";
    const label = document.createElement("strong");
    label.textContent = fact.label;
    const value = document.createElement("span");
    value.textContent = fact.value;
    item.append(label, value);
    facts.appendChild(item);
  });
}

function appendMessage(speaker, content) {
  const empty = messages.querySelector(".empty-state");
  if (empty) empty.remove();
  const bubble = document.createElement("div");
  bubble.className = `message ${speaker}`;
  bubble.textContent = content;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function setBusy(isBusy, label = "") {
  input.disabled = isBusy || !state.sessionId;
  sendButton.disabled = isBusy || !state.sessionId;
  hintButton.disabled = isBusy || !state.sessionId;
  finishButton.disabled = isBusy || !state.sessionId;
  startButton.disabled = isBusy || Boolean(state.sessionId);
  statusText.textContent = label || "所有角色对话均由 LLM 生成";
}

function renderHint(hint) {
  document.querySelector("#hint-focus").textContent = hint.question_focus;
  document.querySelector("#hint-move").textContent = hint.communication_move;
  document.querySelector("#hint-starter").textContent = hint.sentence_starter;
  document.querySelector("#hint-warning").textContent = hint.watch_out;
  const facts = document.querySelector("#hint-facts");
  facts.replaceChildren();
  hint.facts_to_use.forEach((fact) => {
    const item = document.createElement("li");
    item.textContent = fact;
    facts.appendChild(item);
  });
  hintCard.hidden = false;
}

async function requestHint() {
  if (!state.sessionId) return;
  setBusy(true, "正在分析对方这一问……");
  try {
    const hint = await api(`/api/training/sessions/${state.sessionId}/hint`, {
      method: "POST",
    });
    renderHint(hint);
    setBusy(false, "提示不会占用训练轮数");
    input.focus();
  } catch (error) {
    setBusy(false, `提示生成失败：${error.message}`);
  }
}

function updateTurnLabel(isActive = true) {
  if (!state.maxTurns) {
    turnLabel.textContent = "尚未开始";
    return;
  }
  const shownTurn = isActive
    ? Math.min(state.currentTurn + 1, state.maxTurns)
    : Math.min(state.currentTurn, state.maxTurns);
  turnLabel.textContent = isActive
    ? `第 ${shownTurn}/${state.maxTurns} 轮`
    : `已结束 · 回答 ${shownTurn}/${state.maxTurns} 轮`;
}

function fillList(selector, items, emptyText) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  const values = items.length ? items : [emptyText];
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.appendChild(item);
  });
}

function renderReview(review) {
  document.querySelector("#review-summary").textContent = review.summary;
  fillList("#review-strengths", review.strengths, "本轮对话较短，暂时没有足够证据。");
  fillList("#review-improvements", review.priority_improvements, "继续完成更多对话后再判断。");

  const dimensions = document.querySelector("#review-dimensions");
  dimensions.replaceChildren();
  review.dimensions.forEach((dimension) => {
    const card = document.createElement("article");
    card.className = "dimension-card";
    const heading = document.createElement("div");
    heading.className = "dimension-heading";
    const name = document.createElement("h3");
    name.textContent = dimension.name;
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = dimension.score === null ? "证据不足" : `${dimension.score}/5`;
    const evidence = document.createElement("p");
    evidence.className = "dimension-evidence";
    evidence.textContent = `对话证据：${dimension.evidence}`;
    const feedback = document.createElement("p");
    feedback.textContent = dimension.feedback;
    heading.append(name, score);
    card.append(heading, evidence, feedback);
    dimensions.appendChild(card);
  });

  document.querySelector("#better-response").textContent = review.better_response;
  document.querySelector("#next-practice").textContent = review.next_practice;
  reviewPanel.hidden = false;
  reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function finishAndReview() {
  if (!state.sessionId) return;
  setBusy(true, "正在根据本轮对话生成复盘……");
  try {
    const review = await api(`/api/training/sessions/${state.sessionId}/finish`, {
      method: "POST",
    });
    state.sessionId = null;
    updateTurnLabel(false);
    renderReview(review);
    const completedCustomTraining = state.activeCustomTraining;
    document.querySelector("#setup-panel").hidden = completedCustomTraining;
    state.activeCustomTraining = false;
    setBusy(false, "复盘已生成，可以重新开始训练");
    startButton.disabled = false;
  } catch (error) {
    setBusy(false, `复盘生成失败：${error.message}`);
  }
}

function activateTrainingSession(data, scenario = null, roleName = "直属领导") {
  state.activeCustomTraining = Boolean(scenario);
  state.sessionId = data.session_id;
  state.currentTurn = data.current_turn;
  state.maxTurns = data.max_turns;
  messages.replaceChildren();
  appendMessage("opponent", data.opponent_message);
  document.querySelector("#role-label").textContent = roleName;
  document.querySelector("#setup-panel").hidden = true;
  reviewPanel.hidden = true;
  hintCard.hidden = true;
  if (scenario) {
    renderBriefing(scenario.briefing);
    document.querySelector("#scene-title").textContent = scenario.title;
    document.querySelector("#scene-description").textContent = scenario.short_description;
  }
  updateTurnLabel();
  setBusy(false);
  input.focus();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(response.ok ? "后端返回了无法识别的数据" : raw || `服务器错误（${response.status}）`);
  }
  if (!response.ok) throw new Error(data.detail || "请求失败，请重试");
  return data;
}

async function loadScenario() {
  try {
    const scenarios = await api("/api/scenarios");
    const scenario = scenarios.find((item) => item.scenario_id === "workplace-progress");
    if (!scenario) throw new Error("没有找到领导进度场景");
    document.querySelector("#scene-title").textContent = scenario.title;
    document.querySelector("#scene-description").textContent = scenario.short_description;
    state.classicTitle = scenario.title;
    state.classicDescription = scenario.short_description;
    if (state.mode === "classic") setMode("classic");
    renderBriefing(scenario.briefing);
  } catch (error) {
    document.querySelector("#briefing-setting").textContent = "场景加载失败";
    document.querySelector("#briefing-summary").textContent = error.message;
    startButton.disabled = true;
  }
}

loadScenario();

startButton.addEventListener("click", async () => {
  setBusy(true, "正在创建训练……");
  messages.replaceChildren();
  reviewPanel.hidden = true;
  hintCard.hidden = true;
  try {
    const difficulty = Number(document.querySelector("#difficulty").value);
    const data = await api("/api/training/sessions", {
      method: "POST",
      body: JSON.stringify({ scenario_id: "workplace-progress", difficulty }),
    });
    activateTrainingSession(data);
  } catch (error) {
    state.sessionId = null;
    messages.innerHTML = `<p class="empty-state"></p>`;
    messages.querySelector("p").textContent = error.message;
    setBusy(false, "创建失败");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || !state.sessionId) return;
  appendMessage("user", message);
  input.value = "";
  hintCard.hidden = true;
  setBusy(true, "对方正在回应……");
  try {
    const data = await api(`/api/training/sessions/${state.sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    state.currentTurn = data.current_turn;
    appendMessage("opponent", data.opponent_message);
    updateTurnLabel(!data.end_session);
    if (data.end_session) {
      await finishAndReview();
      return;
    }
    setBusy(false);
    input.focus();
  } catch (error) {
    appendMessage("opponent", `系统提示：${error.message}`);
    setBusy(false, "发送失败");
  }
});

finishButton.addEventListener("click", finishAndReview);
hintButton.addEventListener("click", requestHint);

classicPathButton.addEventListener("click", () => setMode("classic"));
incidentPathButton.addEventListener("click", () => setMode("incident"));

incidentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const description = incidentDescription.value.trim();
  if (description.length < 10) return;
  state.incidentId = null;
  incidentDialoguePanel.hidden = true;
  sceneCard.hidden = true;
  incidentSafety.hidden = true;
  setIncidentBusy(true, "正在理解这段经历并判断还缺什么……");
  try {
    const incident = await api("/api/incidents", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    renderIncident(incident);
    setIncidentBusy(false, incident.status === "ready" ? "信息已经足够，请确认场景卡" : "一次只补充一个问题即可");
  } catch (error) {
    setIncidentBusy(false, `整理失败：${error.message}`);
  }
});

incidentAnswerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const answer = incidentAnswer.value.trim();
  if (!answer || !state.incidentId) return;
  setIncidentBusy(true, "正在把新信息补进场景……");
  try {
    const incident = await api(`/api/incidents/${state.incidentId}/answers`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
    incidentAnswer.value = "";
    renderIncident(incident);
    setIncidentBusy(false, incident.status === "ready" ? "信息已经足够，请确认场景卡" : "还差一个关键信息");
  } catch (error) {
    setIncidentBusy(false, `补充失败：${error.message}`);
  }
});

confirmSceneButton.addEventListener("click", async () => {
  if (!state.incidentId) return;
  setIncidentBusy(true, "正在保存场景卡……");
  try {
    const incident = await api(`/api/incidents/${state.incidentId}/confirm`, { method: "POST" });
    renderIncident(incident);
    setIncidentBusy(false, "场景已保存");
    confirmSceneButton.disabled = true;
  } catch (error) {
    setIncidentBusy(false, `保存失败：${error.message}`);
  }
});

startCustomTrainingButton.addEventListener("click", async () => {
  if (!state.incidentId) return;
  setIncidentBusy(true, "正在生成专属角色和训练目标……");
  try {
    const result = await api(`/api/incidents/${state.incidentId}/training`, { method: "POST" });
    setIncidentBusy(false, "专属训练已开始");
    setMode("classic");
    activateTrainingSession(result.session, result.scenario, result.role_display_name);
  } catch (error) {
    setIncidentBusy(false, `训练生成失败：${error.message}`);
  }
});
