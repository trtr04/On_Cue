const CLASSIC_API_BASE = "/api/classic";

async function requestClassic(path, options = {}) {
  const response = await fetch(`${CLASSIC_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(response.ok ? "经典训练服务返回了无法识别的数据" : raw || "经典训练服务请求失败");
  }
  if (!response.ok) {
    const message = payload.detail || payload.error || `经典训练服务暂时不可用（${response.status}）`;
    throw new Error(message === "classic_backend_not_configured" ? "经典训练服务尚未配置在线地址" : message);
  }
  return payload;
}

export function listClassicScenarios() {
  return requestClassic("/scenarios");
}

export function createClassicTrainingSession(scenarioId, difficulty = 1) {
  return requestClassic("/training/sessions", {
    method: "POST",
    body: JSON.stringify({ scenario_id: scenarioId, difficulty }),
  });
}

export function sendClassicTrainingTurn(sessionId, message) {
  return requestClassic(`/training/sessions/${encodeURIComponent(sessionId)}/turns`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function getClassicTrainingHint(sessionId) {
  return requestClassic(`/training/sessions/${encodeURIComponent(sessionId)}/hint`, { method: "POST" });
}

export function finishClassicTrainingSession(sessionId) {
  return requestClassic(`/training/sessions/${encodeURIComponent(sessionId)}/finish`, { method: "POST" });
}
