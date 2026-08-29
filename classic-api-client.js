const API_ROOT = "/api/classic";

export async function classicApi(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(response.ok ? "后端返回了无法识别的数据" : raw || `服务器错误（${response.status}）`);
  }
  if (!response.ok) throw new Error(data.detail || "请求失败，请重试");
  return data;
}

export const classicTraining = {
  health: () => classicApi("/health"),
  scenarios: () => classicApi("/scenarios"),
  start: (scenarioId, difficulty) => classicApi("/training/sessions", {
    method: "POST",
    body: JSON.stringify({ scenario_id: scenarioId, difficulty }),
  }),
  turn: (sessionId, message) => classicApi(`/training/sessions/${sessionId}/turns`, {
    method: "POST",
    body: JSON.stringify({ message }),
  }),
  hint: (sessionId) => classicApi(`/training/sessions/${sessionId}/hint`, { method: "POST" }),
  finish: (sessionId) => classicApi(`/training/sessions/${sessionId}/finish`, { method: "POST" }),
  createIncident: (description) => classicApi("/incidents", {
    method: "POST",
    body: JSON.stringify({ description }),
  }),
  answerIncident: (incidentId, answer) => classicApi(`/incidents/${incidentId}/answers`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  }),
  confirmIncident: (incidentId) => classicApi(`/incidents/${incidentId}/confirm`, { method: "POST" }),
  adviseIncident: (incidentId, segments) => classicApi(`/incidents/${incidentId}/advisor`, {
    method: "POST",
    body: JSON.stringify({ transcript_confirmed: true, segments }),
  }),
  trainIncident: (incidentId) => classicApi(`/incidents/${incidentId}/training`, { method: "POST" }),
  transcribe: (purpose, wavBlob) => {
    const body = new FormData();
    body.append("purpose", purpose);
    body.append("audio", wavBlob, `recording-${Date.now()}.wav`);
    return classicApi("/transcriptions", { method: "POST", body });
  },
};
