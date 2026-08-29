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
from .dialogue_policy import build_allowed_moves
from .expression_retriever import expression_retriever
from .models import (
    HintOutput,
    IncidentAnalysisOutput,
    IncidentRecord,
    ReviewOutput,
    SimulatorOutput,
    TrainingBlueprintOutput,
    TrainingSession,
)
from .pua_rag import pua_retriever

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
        allowed_moves = build_allowed_moves(session, role, opening=True)
        context["allowed_moves"] = allowed_moves
        self._attach_retrieval(
            context=context,
            session=session,
            scenario=scenario,
            role=role,
            query=f"{scenario.get('title', '')} {scenario.get('opening_guidance', {}).get('intent', '')}",
            previous_opponent_messages=[],
            allowed_moves=allowed_moves,
        )
        if scenario.get("training_mode") == "pua_response":
            context["instruction"] = (
                "生成受控 PUA 应对训练的角色开场。只使用 controlled_pressure_examples 中符合当前模块和难度的"
                "一种压力手法，自然改写后直接进入角色；不要介绍训练规则，不要一次堆叠多种攻击。"
            )
        else:
            context["instruction"] = "生成角色的第一句话。必须引用场景中的具体人物关系、地点、原话、行为或事件事实，让用户立刻知道正在谈哪件事；直接进入角色，不评价用户，不预先解决任何学习目标。"
        return self._remote_turn(context, session.learning_goal_ids)

    def generate_turn(self, session: TrainingSession, scenario: dict, role: dict) -> SimulatorOutput:
        if not settings.llm_enabled:
            raise HTTPException(
                status_code=503,
                detail="智谱 API 尚未配置，请设置 ZHIPU_API_KEY。",
            )
        context = self._build_context(session, scenario, role)
        previous_opponent_messages = [
            message.content for message in session.messages if message.speaker == "opponent"
        ]
        latest_user_message = next(
            (message.content for message in reversed(session.messages) if message.speaker == "user"),
            "",
        )
        user_response_type = self._classify_user_response(latest_user_message)
        previous_boundary_count = sum(
            self._classify_user_response(message.content) == "boundary"
            for message in session.messages[:-1]
            if message.speaker == "user"
        )
        reached_last_turn = session.current_turn + 1 >= session.max_turns
        should_close_pua = scenario.get("training_mode") == "pua_response" and (
            user_response_type in {"exit", "compliance"}
            or (
                user_response_type == "boundary"
                and (session.difficulty == 1 or previous_boundary_count >= 1)
            )
        )
        closing = reached_last_turn or should_close_pua
        context["request_type"] = "closing" if closing else "reply"
        context["server_user_response_hint"] = user_response_type
        context["must_close_after_this_reply"] = closing
        allowed_moves = build_allowed_moves(session, role, closing=closing)
        context["allowed_moves"] = allowed_moves
        retrieval_query = " ".join([
            scenario.get("title", ""),
            latest_user_message,
            " ".join(str(move.get("intent", "")) for move in allowed_moves),
        ])
        self._attach_retrieval(
            context=context,
            session=session,
            scenario=scenario,
            role=role,
            query=retrieval_query,
            previous_opponent_messages=previous_opponent_messages,
            allowed_moves=allowed_moves,
        )
        if closing:
            context["instruction"] = (
                "这是本场对话的收口轮。根据 server_user_response_hint 从 allowed_moves 选择一种自然结局："
                "确认接受、承认边界、保留分歧或说明后续。最后一句必须结束谈话，不得提出新问题，"
                "不得输出动作名称、训练术语或后台判断。end_session 必须为 true。"
            )
        else:
            context["instruction"] = (
                "先识别用户最新回答新提供了什么信息，再像角色卡中的真实人物一样对此作出简短反应，"
                "然后只从 allowed_moves 选择一个尚未使用的动作。不得复述或换一种说法重复此前已经问过的问题。"
                "根据 training_mode 严格使用对应检索通道，不得混用普通表达与受控压力材料。"
            )
        output: SimulatorOutput | None = None
        rejected: list[dict[str, str | None]] = []
        for _ in range(3):
            attempt_context = dict(context)
            if rejected:
                attempt_context["rejected_replies"] = rejected
                attempt_context["instruction"] = (
                    "此前生成已被系统拒绝。"
                    + (
                        "本轮必须自然收口，不得出现任何问句、动作标签或训练术语。"
                        if closing else
                        "只使用 allowed_moves 中未问过的新意图；先承接用户刚补充的事实，再推进一个新方向。"
                    )
                    + "不要改写 rejected_replies。"
                )
            output = self._remote_turn(attempt_context, session.learning_goal_ids)
            invalid = self._output_repeats(
                session,
                output,
                previous_opponent_messages,
                check_full_utterance=scenario.get("training_mode") == "pua_response",
            ) or self._contains_internal_language(output.opponent_message)
            if closing and self._contains_question(output.opponent_message):
                invalid = True
            if not invalid:
                output.user_response_type = output.user_response_type or user_response_type
                if closing:
                    output.phase = "closed"
                    output.end_session = True
                    output.end_reason = self._closing_reason(
                        user_response_type,
                        reached_last_turn,
                    )
                    output.closure_type = output.closure_type or output.end_reason
                    output.question_intent = None
                    output.missing_slot = None
                return output
            rejected.append({
                "opponent_message": output.opponent_message,
                "move_id": output.move_id,
                "question_intent": output.question_intent,
            })

        assert output is not None
        output.opponent_message, output.move_id = self._fallback_role_message(
            context,
            output.move_id,
            closing,
            scenario,
            previous_opponent_messages,
        )
        output.question_intent = None
        output.missing_slot = None
        output.user_response_type = user_response_type
        if closing:
            output.phase = "closed"
            output.end_session = True
            output.end_reason = self._closing_reason(user_response_type, reached_last_turn)
            output.closure_type = output.end_reason
        return output

    @staticmethod
    def _classify_user_response(text: str) -> str:
        compact = re.sub(r"\s+", "", text)
        exit_markers = ("到此为止", "不聊了", "结束对话", "请停止", "我先走了", "不再谈")
        boundary_markers = (
            "与面试无关", "和面试没有关系", "与工作无关", "不方便回答", "拒绝回答",
            "不接受", "不讨论", "请回到", "只讨论", "这是隐私", "这个问题无关",
            "回到面试", "回到岗位", "岗位本身", "还有其他问题", "其他感兴趣",
        )
        compliance_markers = (
            "我接受", "没问题", "我会按", "我可以做到", "肯定可以", "愿意配合",
            "会配合", "按您说的", "按你说的", "一定会", "我会做到",
        )
        if any(marker in compact for marker in exit_markers):
            return "exit"
        if any(marker in compact for marker in boundary_markers):
            return "boundary"
        if any(marker in compact for marker in compliance_markers):
            return "compliance"
        if any(marker in compact for marker in ("为什么", "依据", "标准", "具体是指", "请说明")):
            return "clarification"
        if any(marker in compact for marker in ("我不是", "不用担心", "我保证", "我肯定")):
            return "self_justification"
        return "unclear"

    @staticmethod
    def _closing_reason(user_response_type: str, reached_last_turn: bool) -> str:
        if user_response_type == "exit":
            return "user_exit"
        if user_response_type == "compliance":
            return "user_complied"
        if user_response_type == "boundary":
            return "boundary_held"
        return "max_turns_reached" if reached_last_turn else "conversation_closed"

    @staticmethod
    def _contains_internal_language(text: str) -> bool:
        internal_phrases = (
            "弱化用户边界", "用户边界", "要求其继续自证", "allowed_moves", "move_id",
            "训练目标", "本模块", "后台判断", "压力手法标签", "server_user_response_hint",
            "你还是没有按我的要求回应",
        )
        return any(phrase in text for phrase in internal_phrases)

    def _fallback_role_message(
        self,
        context: dict,
        generated_move_id: str | None,
        closing: bool,
        scenario: dict,
        previous_opponent_messages: list[str],
    ) -> tuple[str, str | None]:
        moves = context.get("allowed_moves", [])
        response_type = context.get("server_user_response_hint")
        preferred_closing_id = {
            "compliance": "close_after_compliance",
            "boundary": "close_after_boundary",
            "exit": "close_after_boundary",
        }.get(response_type, "close_with_disagreement")
        preferred_id = preferred_closing_id if closing else generated_move_id
        selected = next((move for move in moves if move.get("move_id") == preferred_id), None)
        if selected is None and moves:
            selected = moves[0]
        if selected and selected.get("fallback_line"):
            return str(selected["fallback_line"]), selected.get("move_id")

        if not closing:
            reference_key = (
                "controlled_pressure_examples"
                if scenario.get("training_mode") == "pua_response"
                else "expression_references"
            )
            for reference in context.get(reference_key, []):
                line = reference.get("text") or reference.get("utterance")
                if line and not self._repeats_previous_utterance(line, previous_opponent_messages):
                    return str(line), selected.get("move_id") if selected else None

        if scenario.get("pua_domain") == "family":
            return "行，你的意思我知道了。今天先说到这里。", None
        if scenario.get("training_mode") == "pua_response":
            return "你的态度我知道了，后续我们按现有流程处理。今天先到这里。", None
        return "好，目前能确认的先到这里，后续按刚才说定的安排推进。", None

    def _output_repeats(
        self,
        session: TrainingSession,
        output: SimulatorOutput,
        previous_opponent_messages: list[str],
        check_full_utterance: bool = False,
    ) -> bool:
        if output.move_id and output.move_id in session.state.asked_move_ids:
            return True
        if output.question_intent and self._repeats_previous_intent(
            output.question_intent,
            session.state.asked_question_intents,
        ):
            return True
        if self._repeats_previous_question(output.opponent_message, previous_opponent_messages):
            return True
        return check_full_utterance and self._repeats_previous_utterance(
            output.opponent_message,
            previous_opponent_messages,
        )

    @staticmethod
    def _attach_retrieval(
        context: dict,
        session: TrainingSession,
        scenario: dict,
        role: dict,
        query: str,
        previous_opponent_messages: list[str],
        allowed_moves: list[dict],
    ) -> None:
        mode = scenario.get("training_mode", "ordinary")
        context["training_mode"] = mode
        if mode == "pua_response":
            context["expression_references"] = []
            context["pressure_anti_examples"] = []
            context["controlled_pressure_examples"] = pua_retriever.retrieve_controlled(
                module_id=scenario.get("pua_module_id", scenario.get("scenario_id", "")),
                difficulty=session.difficulty,
                query=query,
                previous_opponent_messages=previous_opponent_messages,
            )
            return
        context["controlled_pressure_examples"] = []
        context["expression_references"] = expression_retriever.retrieve(
            query=query,
            role=role,
            previous_opponent_messages=previous_opponent_messages,
            allowed_move_ids={move["move_id"] for move in allowed_moves if move.get("move_id")},
        )
        context["pressure_anti_examples"] = pua_retriever.retrieve_anti_examples(
            query=query,
            role=role,
        )

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
                allowed_moves = context.get("allowed_moves", [])
                if allowed_moves:
                    allowed_ids = {move.get("move_id") for move in allowed_moves}
                    if output.move_id not in allowed_ids:
                        output.move_id = allowed_moves[0].get("move_id")
                    if self._contains_question(output.opponent_message) and not output.question_intent:
                        selected = next(
                            (move for move in allowed_moves if move.get("move_id") == output.move_id),
                            allowed_moves[0],
                        )
                        output.question_intent = str(selected.get("intent") or output.move_id)
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

        candidate_questions = LLMService._question_clauses(candidate)
        if not candidate_questions:
            return False
        for previous in previous_messages:
            for candidate_question in candidate_questions:
                candidate_normalized = normalize(candidate_question)
                candidate_signature = LLMService._intent_signature(candidate_question)
                for previous_question in LLMService._question_clauses(previous):
                    previous_normalized = normalize(previous_question)
                    if candidate_normalized == previous_normalized:
                        return True
                    if SequenceMatcher(None, candidate_normalized, previous_normalized).ratio() >= 0.72:
                        return True
                    previous_signature = LLMService._intent_signature(previous_question)
                    if candidate_signature and candidate_signature == previous_signature:
                        return True
        return False

    @staticmethod
    def _repeats_previous_intent(candidate: str, previous_intents: list[str]) -> bool:
        candidate_signature = LLMService._intent_signature(candidate)
        candidate_normalized = re.sub(r"[\W_]+", "", candidate, flags=re.UNICODE).lower()
        for previous in previous_intents:
            previous_signature = LLMService._intent_signature(previous)
            previous_normalized = re.sub(r"[\W_]+", "", previous, flags=re.UNICODE).lower()
            if candidate_signature and candidate_signature == previous_signature:
                return True
            if SequenceMatcher(None, candidate_normalized, previous_normalized).ratio() >= 0.72:
                return True
        return False

    @staticmethod
    def _repeats_previous_utterance(candidate: str, previous_messages: list[str]) -> bool:
        normalize = lambda text: re.sub(r"[\W_]+", "", text, flags=re.UNICODE).lower()
        candidate_normalized = normalize(candidate)
        if not candidate_normalized:
            return False
        return any(
            SequenceMatcher(None, candidate_normalized, normalize(previous)).ratio() >= 0.78
            for previous in previous_messages
        )

    @staticmethod
    def _question_clauses(text: str) -> list[str]:
        clauses = [part.strip() for part in re.split(r"[。！？!?；;\n]+", text) if part.strip()]
        explicit_questions = [
            part.strip(" ？?")
            for part in re.findall(r"[^。！!；;\n]*[？?]", text)
            if part.strip(" ？?")
        ]
        markers = (
            "吗", "呢", "为什么", "怎么", "多少", "什么", "谁", "哪", "何时",
            "什么时候", "几点", "能不能", "是否", "给我", "告诉我", "说清楚", "说清",
        )
        inferred = [clause for clause in clauses if any(marker in clause for marker in markers)]
        return list(dict.fromkeys([*explicit_questions, *inferred]))

    @staticmethod
    def _contains_question(text: str) -> bool:
        return bool(LLMService._question_clauses(text))

    @staticmethod
    def _intent_signature(text: str) -> tuple[str, ...]:
        groups = {
            "status": ("进度", "完成度", "做到哪", "完成什么", "还剩", "未完成"),
            "delivery_time": ("什么时候", "何时", "几点", "时间点", "多久", "交付时间", "完成时间"),
            "late_report": ("为什么没说", "为什么不说", "没有上报", "及时预警", "才说", "什么时候发现"),
            "ownership": ("责任", "你这边", "应该提前", "可控", "推给", "负责"),
            "plan": ("怎么处理", "怎么解决", "下一步", "方案", "接下来", "采取什么"),
            "owner": ("谁做", "谁负责", "负责人"),
            "impact": ("影响", "风险", "后果"),
            "choice": ("两个方案", "哪个方案", "选择", "优先级", "需要我决定"),
        }
        return tuple(sorted(
            name for name, phrases in groups.items() if any(phrase in text for phrase in phrases)
        ))

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
