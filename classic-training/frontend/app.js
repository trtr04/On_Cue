const state = {
  sessionId: null,
  currentTurn: 0,
  maxTurns: 0,
  incidentId: null,
  mode: "ordinary",
  classicTitle: "领导质问项目进度",
  classicDescription: "练习在压力下先说现状，再给事实、方案和明确时间。",
  incidentStatus: null,
  activeCustomTraining: false,
  scenarios: [],
  selectedScenarioId: "workplace-progress",
};

const messages = document.querySelector("#messages");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const hintButton = document.querySelector("#hint-button");
const finishButton = document.querySelector("#finish-button");
const startButton = document.querySelector("#start-button");
const scenarioSelect = document.querySelector("#scenario-select");
const form = document.querySelector("#message-form");
const turnLabel = document.querySelector("#turn-label");
const statusText = document.querySelector("#status-text");
const reviewPanel = document.querySelector("#review-panel");
const hintCard = document.querySelector("#hint-card");
const classicFlow = document.querySelector("#classic-flow");
const incidentFlow = document.querySelector("#incident-flow");
const classicPathButton = document.querySelector("#classic-path-button");
const puaPathButton = document.querySelector("#pua-path-button");
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
const recordButtons = [...document.querySelectorAll(".record-button")];
const classicRecordButton = document.querySelector("#classic-record-button");
let activeRecording = null;

function setMode(mode) {
  state.mode = mode;
  const isPreset = mode === "ordinary" || mode === "pua";
  classicFlow.hidden = !isPreset;
  incidentFlow.hidden = isPreset;
  classicPathButton.classList.toggle("active", mode === "ordinary");
  puaPathButton.classList.toggle("active", mode === "pua");
  incidentPathButton.classList.toggle("active", mode === "incident");
  if (isPreset) {
    refreshScenarioOptions(mode);
  } else {
    document.querySelector("#scene-title").textContent = "把真实经历变成可练的场景";
    document.querySelector("#scene-description").textContent = "不需要一次讲完整，系统会逐步帮你补齐关键事实。";
  }
  if (isPreset && !state.sessionId && !state.activeCustomTraining) {
    document.querySelector("#setup-panel").hidden = false;
  }
}

function refreshScenarioOptions(mode) {
  if (!state.scenarios.length) return;
  const targetMode = mode === "pua" ? "pua_response" : "ordinary";
  const candidates = state.scenarios.filter((item) => item.training_mode === targetMode);
  if (!candidates.some((item) => item.scenario_id === state.selectedScenarioId)) {
    state.selectedScenarioId = candidates[0]?.scenario_id || "workplace-progress";
  }
  scenarioSelect.replaceChildren();
  candidates.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.scenario_id;
    option.textContent = item.title;
    scenarioSelect.appendChild(option);
  });
  scenarioSelect.value = state.selectedScenarioId;
  const scenario = candidates.find((item) => item.scenario_id === state.selectedScenarioId);
  if (scenario) renderSelectedScenario(scenario);
}

function setIncidentBusy(isBusy, label = "") {
  incidentDescription.disabled = isBusy;
  incidentSubmitButton.disabled = isBusy;
  incidentAnswer.disabled = isBusy;
  incidentAnswerButton.disabled = isBusy;
  confirmSceneButton.disabled = isBusy || state.incidentStatus !== "ready";
  startCustomTrainingButton.disabled = isBusy || state.incidentStatus !== "confirmed";
  recordButtons
    .filter((button) => button.dataset.purpose === "incident_narration")
    .forEach((button) => { button.disabled = isBusy || Boolean(activeRecording); });
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
  scenarioSelect.disabled = isBusy || Boolean(state.sessionId);
  classicRecordButton.disabled = isBusy || !state.sessionId || Boolean(activeRecording);
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
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
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

function setRecordStatus(recording, message) {
  const status = document.querySelector(`#${recording.button.dataset.status}`);
  if (status) status.textContent = message;
}

function mergeAudioChunks(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

function resampleTo16k(samples, sourceRate) {
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

function encodeWav(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  samples.forEach((sample) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += 2;
  });
  return new Blob([buffer], { type: "audio/wav" });
}

function appendTranscript(target, text) {
  const separator = target.value.trim() ? "\n" : "";
  const nextValue = `${target.value.trimEnd()}${separator}${text}`;
  const maximum = Number(target.getAttribute("maxlength")) || Infinity;
  if (nextValue.length > maximum) throw new Error(`转写后超过输入框 ${maximum} 字限制，请先整理已有文字`);
  target.value = nextValue;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus();
}

async function uploadRecording(recording, blob) {
  const body = new FormData();
  body.append("purpose", recording.purpose);
  body.append("audio", blob, `recording-${Date.now()}.wav`);
  const result = await api("/api/transcriptions", { method: "POST", body });
  appendTranscript(recording.target, result.text);
  const seconds = (result.duration_ms / 1000).toFixed(1);
  setRecordStatus(recording, `已转写 ${seconds} 秒录音，请检查文字${recording.purpose === "classic_turn" ? "后发送" : "；可继续录音追加"}`);
}

async function stopRecording(reachedLimit = false) {
  const recording = activeRecording;
  if (!recording || recording.stopping) return;
  recording.stopping = true;
  clearInterval(recording.timer);
  recording.processor.disconnect();
  recording.source.disconnect();
  recording.silentGain.disconnect();
  recording.stream.getTracks().forEach((track) => track.stop());
  await recording.audioContext.close();
  recording.button.classList.remove("recording");
  recording.button.textContent = "开始录音";
  recordButtons.forEach((button) => { button.disabled = true; });
  setRecordStatus(recording, reachedLimit ? "已到时间上限，正在转成文字……" : "正在转成文字……");

  try {
    const merged = mergeAudioChunks(recording.chunks);
    const samples = resampleTo16k(merged, recording.sampleRate);
    await uploadRecording(recording, encodeWav(samples));
  } catch (error) {
    setRecordStatus(recording, `转写失败：${error.message}`);
  } finally {
    activeRecording = null;
    setBusy(false);
    setIncidentBusy(false);
  }
}

async function startRecording(button) {
  if (activeRecording) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
    const placeholder = { button };
    setRecordStatus(placeholder, "当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari");
    return;
  }
  button.disabled = true;
  const placeholder = { button };
  setRecordStatus(placeholder, "正在请求麦克风权限……");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const audioContext = new AudioContext();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    const recording = {
      button,
      target: document.querySelector(`#${button.dataset.target}`),
      purpose: button.dataset.purpose,
      limitSeconds: Number(button.dataset.limit),
      stream,
      audioContext,
      source,
      processor,
      silentGain,
      sampleRate: audioContext.sampleRate,
      chunks: [],
      startedAt: Date.now(),
      timer: null,
      stopping: false,
    };
    processor.onaudioprocess = (event) => {
      recording.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);
    activeRecording = recording;
    recordButtons.forEach((item) => { item.disabled = item !== button; });
    button.disabled = false;
    button.classList.add("recording");
    button.textContent = "结束录音";
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - recording.startedAt) / 1000);
      const remaining = Math.max(0, recording.limitSeconds - elapsed);
      setRecordStatus(recording, `正在录音 ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")} · 剩余 ${remaining} 秒`);
      if (elapsed >= recording.limitSeconds) stopRecording(true);
    };
    updateTimer();
    recording.timer = setInterval(updateTimer, 250);
  } catch (error) {
    button.disabled = false;
    const denied = error.name === "NotAllowedError";
    setRecordStatus(placeholder, denied ? "没有麦克风权限，请在浏览器地址栏中允许后重试" : `无法开始录音：${error.message}`);
  }
}

recordButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (activeRecording?.button === button) stopRecording(false);
    else startRecording(button);
  });
});

async function loadScenario() {
  try {
    const scenarios = await api("/api/scenarios");
    state.scenarios = scenarios;
    setMode(state.mode);
  } catch (error) {
    document.querySelector("#briefing-setting").textContent = "场景加载失败";
    document.querySelector("#briefing-summary").textContent = error.message;
    startButton.disabled = true;
  }
}

function renderSelectedScenario(scenario) {
  document.querySelector("#scene-title").textContent = scenario.title;
  document.querySelector("#scene-description").textContent = scenario.short_description;
  state.classicTitle = scenario.title;
  state.classicDescription = scenario.short_description;
  renderBriefing(scenario.briefing);
}

loadScenario();

scenarioSelect.addEventListener("change", () => {
  state.selectedScenarioId = scenarioSelect.value;
  const scenario = state.scenarios.find((item) => item.scenario_id === state.selectedScenarioId);
  if (scenario) renderSelectedScenario(scenario);
});

startButton.addEventListener("click", async () => {
  setBusy(true, "正在创建训练……");
  messages.replaceChildren();
  reviewPanel.hidden = true;
  hintCard.hidden = true;
  try {
    const difficulty = Number(document.querySelector("#difficulty").value);
    const data = await api("/api/training/sessions", {
      method: "POST",
      body: JSON.stringify({ scenario_id: state.selectedScenarioId, difficulty }),
    });
    const selectedScenario = state.scenarios.find((item) => item.scenario_id === state.selectedScenarioId);
    const isPUA = selectedScenario?.training_mode === "pua_response";
    activateTrainingSession(data, null, isPUA ? "压力方" : "直属领导");
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

classicPathButton.addEventListener("click", () => setMode("ordinary"));
puaPathButton.addEventListener("click", () => setMode("pua"));
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
    setMode("ordinary");
    activateTrainingSession(result.session, result.scenario, result.role_display_name);
  } catch (error) {
    setIncidentBusy(false, `训练生成失败：${error.message}`);
  }
});
