from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException

from .config import PROJECT_DIR, settings
from .models import (
    HintOutput,
    IncidentAnalysisOutput,
    IncidentRecord,
    ReviewOutput,
    SimulatorOutput,
    TrainingBlueprintOutput,
    TrainingSession,
)

logger = logging.getLogger(__name__)


class LLMService:
    """Calls Zhipu Chat Completions for every role utterance."""

    def __init__(self) -> None:
        self.system_prompt = (PROJECT_DIR / "prompts" / "simulator-system.md").read_text(encoding="utf-8")
        self.review_prompt = (PROJECT_DIR / "prompts" / "review-system.md").read_text(encoding="utf-8")
        self.hint_prompt = (PROJECT_DIR / "prompts" / "hint-system.md").read_text(encoding="utf-8")
        self.incident_intake_prompt = (PROJECT_DIR / "prompts" / "incident-intake-system.md").read_text(encoding="utf-8")
        self.training_blueprint_prompt = (PROJECT_DIR / "prompts" / "training-blueprint-system.md").read_text(encoding="utf-8")

    def generate_opening(self, session: TrainingSession, scenario: dict, role: dict) -> SimulatorOutput:
        context = self._build_context(session, scenario, role)
        context["request_type"] = "opening"
        context["instruction"] = "生成角色的第一句话。必须引用场景中的具体人物关系、地点、原话、行为或事件事实，让用户立刻知道正在谈哪件事；直接进入角色，不评价用户，不预先解决任何学习目标。"
        return self._remote_turn(context, session.learning_goal_ids)

    def generate_turn(self, session: TrainingSession, scenario: dict, role: dict) -> SimulatorOutput:
        if not settings.llm_enabled:
            raise HTTPException(
                status_code=503,
                detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。",
            )
        context = self._build_context(session, scenario, role)
        context["request_type"] = "reply"
        context["instruction"] = (
            "先识别用户最新回答新提供了什么信息，再像真实领导一样对此作出简短反应，"
            "然后只追问一个尚未解决的关键点。不得复述或换一种说法重复此前已经问过的问题。"
        )
        output = self._remote_turn(context, session.learning_goal_ids)

        previous_opponent_messages = [
            message.content for message in session.messages if message.speaker == "opponent"
        ]
        if self._repeats_previous_question(output.opponent_message, previous_opponent_messages):
            retry_context = dict(context)
            retry_context["rejected_reply"] = output.opponent_message
            retry_context["instruction"] = (
                "上一版回复与角色此前说过的话重复，已被系统拒绝。不得再次询问已经问过的核心问题。"
                "先承接用户最新一句话中的有效信息，再从场景尚未解决的训练目标中选择一个新方向，"
                "自然地说一句话。"
            )
            output = self._remote_turn(retry_context, session.learning_goal_ids)
        return output

    def generate_review(self, session: TrainingSession, scenario: dict) -> ReviewOutput:
        if not settings.llm_enabled:
            raise HTTPException(status_code=503, detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。")
        context = {
            "session_id": session.session_id,
            "scenario": scenario,
            "learning_goal_ids": session.learning_goal_ids,
            "response_framework": session.response_framework,
            "conversation_history": [message.model_dump() for message in session.messages],
            "end_reason": session.state.end_reason,
        }
        last_rate_limit_message = "该模型当前访问量过大，请稍后再试。"
        for model_index, model in enumerate(settings.zhipu_models):
            payload = {
                "model": model,
                "temperature": 0.3,
                "max_tokens": 1200,
                "stream": False,
                "response_format": {"type": "json_object"},
                "request_id": f"{session.session_id}-review-{uuid4().hex[:12]}-m{model_index}",
                "messages": [
                    {"role": "system", "content": self.review_prompt},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            }
            request = urllib.request.Request(
                settings.zhipu_api_url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.zhipu_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=settings.zhipu_timeout_seconds) as response:
                    body = json.loads(response.read().decode("utf-8"))
                content = body["choices"][0]["message"]["content"]
                output = self._parse_review_output(content)
                returned_goal_ids = {item.goal_id for item in output.dimensions}
                if returned_goal_ids != set(session.learning_goal_ids):
                    raise HTTPException(status_code=502, detail="LLM 复盘维度与训练目标不一致")
                return output
            except urllib.error.HTTPError as exc:
                provider_message = self._provider_error_message(exc)
                logger.warning("智谱复盘模型 %s 返回 HTTP %s：%s", model, exc.code, provider_message)
                if exc.code != 429:
                    raise HTTPException(status_code=502, detail=f"智谱 API 返回 HTTP {exc.code}：{provider_message}") from exc
                last_rate_limit_message = provider_message
            except (urllib.error.URLError, KeyError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("智谱复盘请求或结构化输出失败：%s", exc)
                raise HTTPException(status_code=502, detail="智谱复盘生成失败或返回格式无效。") from exc
        raise HTTPException(status_code=503, detail=f"智谱模型暂时繁忙：{last_rate_limit_message}")

    def generate_hint(self, session: TrainingSession, scenario: dict) -> HintOutput:
        if not settings.llm_enabled:
            raise HTTPException(status_code=503, detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。")
        context = {
            "session_id": session.session_id,
            "scenario": scenario,
            "difficulty": session.difficulty,
            "session_state": session.state.model_dump(),
            "conversation_history": [message.model_dump() for message in session.messages],
            "instruction": "只帮助用户组织当前这一轮回答，不评价整场表现，也不要替用户写出完整答案。",
        }
        last_rate_limit_message = "该模型当前访问量过大，请稍后再试。"
        for model_index, model in enumerate(settings.zhipu_models):
            payload = {
                "model": model,
                "temperature": 0.4,
                "max_tokens": 500,
                "stream": False,
                "response_format": {"type": "json_object"},
                "request_id": f"{session.session_id}-hint-{uuid4().hex[:12]}-m{model_index}",
                "messages": [
                    {"role": "system", "content": self.hint_prompt},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            }
            request = urllib.request.Request(
                settings.zhipu_api_url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.zhipu_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=settings.zhipu_timeout_seconds) as response:
                    body = json.loads(response.read().decode("utf-8"))
                return self._parse_hint_output(body["choices"][0]["message"]["content"])
            except urllib.error.HTTPError as exc:
                provider_message = self._provider_error_message(exc)
                logger.warning("智谱提示模型 %s 返回 HTTP %s：%s", model, exc.code, provider_message)
                if exc.code != 429:
                    raise HTTPException(status_code=502, detail=f"智谱 API 返回 HTTP {exc.code}：{provider_message}") from exc
                last_rate_limit_message = provider_message
            except (urllib.error.URLError, KeyError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("智谱提示请求或结构化输出失败：%s", exc)
                raise HTTPException(status_code=502, detail="解题提示生成失败或返回格式无效。") from exc
        raise HTTPException(status_code=503, detail=f"智谱模型暂时繁忙：{last_rate_limit_message}")

    def analyze_incident(self, incident: IncidentRecord) -> IncidentAnalysisOutput:
        if not settings.llm_enabled:
            raise HTTPException(status_code=503, detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。")
        context = {
            "incident_id": incident.incident_id,
            "current_draft": incident.draft.model_dump(),
            "conversation_history": [message.model_dump() for message in incident.messages],
            "previous_missing_fields": incident.missing_fields,
        }
        last_rate_limit_message = "该模型当前访问量过大，请稍后再试。"
        for model_index, model in enumerate(settings.zhipu_models):
            payload = {
                "model": model,
                "temperature": 0.35,
                "max_tokens": 1000,
                "stream": False,
                "response_format": {"type": "json_object"},
                "request_id": f"{incident.incident_id}-intake-{uuid4().hex[:12]}-m{model_index}",
                "messages": [
                    {"role": "system", "content": self.incident_intake_prompt},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            }
            request = urllib.request.Request(
                settings.zhipu_api_url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.zhipu_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=settings.zhipu_timeout_seconds) as response:
                    body = json.loads(response.read().decode("utf-8"))
                return self._parse_incident_output(body["choices"][0]["message"]["content"])
            except urllib.error.HTTPError as exc:
                provider_message = self._provider_error_message(exc)
                logger.warning("智谱场景整理模型 %s 返回 HTTP %s：%s", model, exc.code, provider_message)
                if exc.code != 429:
                    raise HTTPException(status_code=502, detail=f"智谱 API 返回 HTTP {exc.code}：{provider_message}") from exc
                last_rate_limit_message = provider_message
            except (urllib.error.URLError, KeyError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("智谱场景整理请求或结构化输出失败：%s", exc)
                raise HTTPException(status_code=502, detail="真实经历整理失败或返回格式无效。") from exc
        raise HTTPException(status_code=503, detail=f"智谱模型暂时繁忙：{last_rate_limit_message}")

    def generate_training_blueprint(self, incident: IncidentRecord) -> TrainingBlueprintOutput:
        if not settings.llm_enabled:
            raise HTTPException(status_code=503, detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。")
        context = {
            "incident_id": incident.incident_id,
            "confirmed_scene": incident.draft.model_dump(),
            "original_conversation": [message.model_dump() for message in incident.messages],
        }
        last_rate_limit_message = "该模型当前访问量过大，请稍后再试。"
        for model_index, model in enumerate(settings.zhipu_models):
            payload = {
                "model": model,
                "temperature": 0.35,
                "max_tokens": 1200,
                "stream": False,
                "response_format": {"type": "json_object"},
                "request_id": f"{incident.incident_id}-blueprint-{uuid4().hex[:12]}-m{model_index}",
                "messages": [
                    {"role": "system", "content": self.training_blueprint_prompt},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            }
            request = urllib.request.Request(
                settings.zhipu_api_url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.zhipu_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=settings.zhipu_timeout_seconds) as response:
                    body = json.loads(response.read().decode("utf-8"))
                return self._parse_training_blueprint(body["choices"][0]["message"]["content"])
            except urllib.error.HTTPError as exc:
                provider_message = self._provider_error_message(exc)
                logger.warning("智谱训练蓝图模型 %s 返回 HTTP %s：%s", model, exc.code, provider_message)
                if exc.code != 429:
                    raise HTTPException(status_code=502, detail=f"智谱 API 返回 HTTP {exc.code}：{provider_message}") from exc
                last_rate_limit_message = provider_message
            except (urllib.error.URLError, KeyError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("智谱训练蓝图请求或结构化输出失败：%s", exc)
                raise HTTPException(status_code=502, detail="专属训练生成失败或返回格式无效。") from exc
        raise HTTPException(status_code=503, detail=f"智谱模型暂时繁忙：{last_rate_limit_message}")

    @staticmethod
    def _build_context(session: TrainingSession, scenario: dict, role: dict) -> dict:
        return {
            "session_id": session.session_id,
            "scenario": scenario,
            "role": role,
            "difficulty": session.difficulty,
            "session_state": session.state.model_dump(),
            "conversation_history": [message.model_dump() for message in session.messages],
        }

    def _remote_turn(self, context: dict, allowed_goal_ids: list[str]) -> SimulatorOutput:
        if not settings.llm_enabled:
            raise HTTPException(
                status_code=503,
                detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。",
            )
        last_rate_limit_message = "该模型当前访问量过大，请稍后再试。"
        for model_index, model in enumerate(settings.zhipu_models):
            payload = {
                "model": model,
                "temperature": 0.7,
                "max_tokens": 400,
                "stream": False,
                "response_format": {"type": "json_object"},
                # A request ID must identify one provider call, not one training
                # session. Reusing it across turns can make an upstream service
                # treat a new turn as a duplicate request.
                "request_id": f"{context['session_id']}-{uuid4().hex[:12]}-m{model_index}",
                "messages": [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            }
            request = urllib.request.Request(
                settings.zhipu_api_url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.zhipu_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=settings.zhipu_timeout_seconds) as response:
                    body = json.loads(response.read().decode("utf-8"))
                content = body["choices"][0]["message"]["content"]
                output = self._parse_structured_output(content)
                self._validate_goal_ids(output, allowed_goal_ids)
                if model_index:
                    logger.info("智谱主模型繁忙，已使用备用模型 %s。", model)
                return output
            except urllib.error.HTTPError as exc:
                provider_message = self._provider_error_message(exc)
                logger.warning("智谱模型 %s 返回 HTTP %s：%s", model, exc.code, provider_message)
                if exc.code != 429:
                    raise HTTPException(
                        status_code=502,
                        detail=f"智谱 API 返回 HTTP {exc.code}：{provider_message}",
                    ) from exc
                last_rate_limit_message = provider_message
                continue
            except (urllib.error.URLError, KeyError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("智谱 API 请求或结构化输出失败：%s", exc)
                raise HTTPException(status_code=502, detail="智谱 API 请求失败或返回格式无效。") from exc
            except HTTPException:
                raise
            except Exception as exc:
                logger.exception("处理智谱模型响应时发生未预料错误")
                raise HTTPException(
                    status_code=502,
                    detail=f"处理智谱模型响应失败（{type(exc).__name__}）。",
                ) from exc

        raise HTTPException(
            status_code=503,
            detail=f"智谱模型暂时繁忙：{last_rate_limit_message}",
        )

    @staticmethod
    def _repeats_previous_question(candidate: str, previous_messages: list[str]) -> bool:
        def normalize(text: str) -> str:
            return re.sub(r"[\W_]+", "", text, flags=re.UNICODE).lower()

        candidate_normalized = normalize(candidate)
        if not candidate_normalized:
            return False
        for previous in previous_messages:
            previous_normalized = normalize(previous)
            if candidate_normalized == previous_normalized:
                return True
            if SequenceMatcher(None, candidate_normalized, previous_normalized).ratio() >= 0.82:
                return True
        return False

    @staticmethod
    def _provider_error_message(exc: urllib.error.HTTPError) -> str:
        provider_message = "请求被智谱 API 拒绝。"
        try:
            error_body = json.loads(exc.read().decode("utf-8"))
            if not isinstance(error_body, dict):
                return provider_message
            error_value = error_body.get("error")
            if isinstance(error_value, dict):
                return str(error_value.get("message") or provider_message)
            if isinstance(error_value, str):
                return error_value
            message = error_body.get("message")
            return str(message or provider_message)
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError, TypeError):
            return provider_message

    @staticmethod
    def _parse_structured_output(content: str | dict) -> SimulatorOutput:
        if isinstance(content, dict):
            return SimulatorOutput.model_validate(content)
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return SimulatorOutput.model_validate_json(cleaned.strip())

    @staticmethod
    def _parse_review_output(content: str | dict) -> ReviewOutput:
        if isinstance(content, dict):
            return ReviewOutput.model_validate(content)
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return ReviewOutput.model_validate_json(cleaned.strip())

    @staticmethod
    def _parse_hint_output(content: str | dict) -> HintOutput:
        if isinstance(content, dict):
            return HintOutput.model_validate(content)
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return HintOutput.model_validate_json(cleaned.strip())

    @staticmethod
    def _parse_incident_output(content: str | dict) -> IncidentAnalysisOutput:
        if isinstance(content, dict):
            return IncidentAnalysisOutput.model_validate(content)
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return IncidentAnalysisOutput.model_validate_json(cleaned.strip())

    @staticmethod
    def _parse_training_blueprint(content: str | dict) -> TrainingBlueprintOutput:
        if isinstance(content, dict):
            return TrainingBlueprintOutput.model_validate(content)
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return TrainingBlueprintOutput.model_validate_json(cleaned.strip())

    @staticmethod
    def _validate_goal_ids(output: SimulatorOutput, allowed_goal_ids: list[str]) -> None:
        returned = set(output.resolved_goal_ids) | set(output.unresolved_goal_ids)
        if not returned.issubset(set(allowed_goal_ids)):
            raise HTTPException(status_code=502, detail="LLM returned unknown learning goal IDs")

llm_service = LLMService()
