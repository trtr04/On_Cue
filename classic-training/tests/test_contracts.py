from __future__ import annotations

import json
import io
import tempfile
import unittest
import urllib.error
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from backend.app.llm_service import LLMService
from backend.app.dialogue_policy import apply_output_to_state, build_allowed_moves
from backend.app.expression_retriever import ExpressionRetriever
from backend.app.pua_corpus import load_pua_corpus
from backend.app.pua_modules import MODULES
from backend.app.pua_rag import PUARetriever
from backend.app.database import Database
from backend.app.incident_service import IncidentService
from backend.app.custom_training_service import CustomTrainingService
from backend.app.models import (
    AdvisorFeedback,
    CreateSessionRequest,
    CreateIncidentRequest,
    HintOutput,
    HintResponse,
    IncidentAnalysisOutput,
    IncidentAnswerRequest,
    IncidentMessage,
    IncidentRecord,
    Message,
    ReviewDimension,
    ReviewOutput,
    ReviewResponse,
    SceneDraft,
    SessionState,
    SimulatorOutput,
    TrainingSession,
    TrainingBlueprintOutput,
    TrainingGoalBlueprint,
    TurnRequest,
)
from backend.app.repository import (
    HintRepository,
    GeneratedScenarioRepository,
    IncidentRepository,
    ReviewRepository,
    SessionRepository,
    content_repository,
)
from backend.app.training_service import TrainingService
from backend.app.transcription_service import TranscriptionService


class TranscriptionContractTests(unittest.TestCase):
    @staticmethod
    def make_wav(duration_seconds: float, sample_rate: int = 16000) -> bytes:
        output = io.BytesIO()
        with wave.open(output, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b"\x00\x00" * round(duration_seconds * sample_rate))
        return output.getvalue()

    def test_browser_wav_contract_uses_16khz_mono_and_reports_duration(self) -> None:
        audio = self.make_wav(1.25)
        self.assertEqual(TranscriptionService.wav_duration_ms(audio), 1250)

    def test_browser_wav_contract_rejects_wrong_sample_rate(self) -> None:
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as raised:
            TranscriptionService.wav_duration_ms(self.make_wav(1, sample_rate=8000))
        self.assertEqual(raised.exception.status_code, 422)

    def test_tencent_uin_is_rejected_before_network_request(self) -> None:
        from fastapi import HTTPException

        audio = self.make_wav(1)
        fake_settings = SimpleNamespace(
            transcription_enabled=True,
            tencent_app_id="100000000000",
        )
        with patch("backend.app.transcription_service.settings", fake_settings):
            with self.assertRaises(HTTPException) as raised:
                TranscriptionService().transcribe(audio, "classic_turn")
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("账号 ID/UIN", raised.exception.detail)

    def test_long_wav_is_split_for_standard_api_limit(self) -> None:
        chunks = TranscriptionService._split_wav(self.make_wav(180))
        self.assertEqual(len(chunks), 2)
        self.assertEqual(TranscriptionService.wav_duration_ms(chunks[0]), 120000)
        self.assertEqual(TranscriptionService.wav_duration_ms(chunks[1]), 60000)
        self.assertTrue(all(len(chunk) < 5 * 1024 * 1024 for chunk in chunks))

    def test_flash_404_falls_back_to_standard_recording_api(self) -> None:
        error = urllib.error.HTTPError("https://example.test", 404, "not found", {}, None)
        with (
            patch("backend.app.transcription_service.urllib.request.urlopen", side_effect=error),
            patch.object(
                TranscriptionService,
                "_transcribe_standard",
                return_value=("这是识别结果", "request-1"),
            ) as standard,
        ):
            text, request_id, provider = TranscriptionService()._transcribe_flash(
                self.make_wav(1)
            )
        standard.assert_called_once()
        self.assertEqual(text, "这是识别结果")
        self.assertEqual(request_id, "request-1")
        self.assertEqual(provider, "tencent_recording")


class ContentContractTests(unittest.TestCase):
    def test_incident_output_normalizes_user_actions_returned_as_a_list(self) -> None:
        parsed = LLMService._parse_incident_output(
            {
                "acknowledgement": "我先帮你还原经过。",
                "draft": {
                    "title": "年夜饭被催婚",
                    "user_words_or_actions": [
                        "这是我的个人安排。",
                        "希望您不要替我做决定。",
                    ],
                },
                "missing_fields": [],
                "next_question": None,
                "ready_for_confirmation": True,
            }
        )

        self.assertEqual(
            parsed.draft.user_words_or_actions,
            "这是我的个人安排。\n希望您不要替我做决定。",
        )

    def test_advisor_contract_requires_and_preserves_three_distinct_voices(self) -> None:
        feedback = AdvisorFeedback.model_validate(
            {
                "scene_read": {
                    "opening": "姑妈把关心变成了对个人选择的评价。",
                    "key_detail": "用户已经表达这是个人安排。",
                    "where_it_is_stuck": "对方继续用不懂事施压。",
                    "need_to_confirm": "是否希望当场结束话题。",
                },
                "ambiguity_analysis": {
                    "ambiguity_level": "low",
                    "observable_facts": ["对方连续追问婚育"],
                    "primary_interpretation": {
                        "statement": "边界被忽视",
                        "confidence": "high",
                        "evidence": ["我都是为你好"],
                    },
                    "alternative_interpretations": [],
                    "missing_information": [],
                    "verification_move": "请确认您是否愿意停止这个话题？",
                    "update_rule": "若停止追问，则降低风险判断。",
                },
                "primary_voice": "B",
                "voice_order": ["B", "A", "C"],
                "voice_versions": {
                    voice: {
                        "voice_id": voice,
                        "display_name": f"反馈 {voice}",
                        "headline": f"角度 {voice}",
                        "analysis": "只根据已确认的逐句稿判断。",
                        "direct_reply": "这个话题到这里，请不要继续追问。",
                        "next_steps": ["重复边界"],
                        "style_intensity": "strong",
                    }
                    for voice in ("A", "B", "C")
                },
            }
        )

        self.assertEqual(set(feedback.voice_versions), {"A", "B", "C"})
        self.assertEqual(feedback.primary_voice, "B")

    def test_scenario_role_and_learning_goals_are_compatible(self) -> None:
        scenario = content_repository.get_scenario("workplace-progress")
        role = content_repository.get_role(scenario["role_id"])

        self.assertIn(scenario["scenario_id"], role["applies_to_scenarios"])
        self.assertEqual(
            set(scenario["learning_goal_ids"]),
            set(role["learning_goal_alignment"]),
        )
        self.assertEqual(len(scenario["learning_goal_ids"]), 5)
        self.assertEqual(scenario["max_turns"], 5)


class TrainingFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        class FakeLLMForTests:
            """A test double only; production code never uses it."""

            @staticmethod
            def generate_opening(session, scenario, role) -> SimulatorOutput:
                return SimulatorOutput(
                    opponent_message="测试开场：目前到底完成了多少？",
                    phase=session.state.phase,
                    pressure_level=session.difficulty,
                    resolved_goal_ids=[],
                    unresolved_goal_ids=session.learning_goal_ids,
                    end_session=False,
                    end_reason=None,
                )

            @staticmethod
            def generate_turn(session, scenario, role) -> SimulatorOutput:
                unresolved = [
                    goal_id
                    for goal_id in session.state.unresolved_goal_ids
                    if goal_id != "status_first"
                ]
                return SimulatorOutput(
                    opponent_message="测试追问：这个风险具体影响多少？",
                    phase="evidence_and_impact",
                    pressure_level=session.difficulty,
                    resolved_goal_ids=["status_first"],
                    unresolved_goal_ids=unresolved,
                    end_session=False,
                    end_reason=None,
                )

            @staticmethod
            def generate_review(session, scenario) -> ReviewOutput:
                return ReviewOutput(
                    summary="测试复盘",
                    strengths=["先说明了完成度"],
                    priority_improvements=["补充明确时间"],
                    dimensions=[
                        ReviewDimension(
                            goal_id=goal_id,
                            name=goal_id,
                            score=3 if goal_id == "status_first" else None,
                            evidence="测试证据" if goal_id == "status_first" else "本轮未出现足够证据",
                            feedback="测试建议",
                        )
                        for goal_id in session.learning_goal_ids
                    ],
                    better_response="测试优化表达",
                    next_practice="测试练习",
                )

            @staticmethod
            def generate_hint(session, scenario) -> HintOutput:
                return HintOutput(
                    question_focus="领导想确认真实完成度",
                    communication_move="先给数字，再说剩余项",
                    facts_to_use=["5 项完成 3 项", "支付后发券尚未跑通"],
                    sentence_starter="目前 5 项工作已经完成___项，剩下的是___。",
                    watch_out="不要先从外部原因讲起",
                )

        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        test_db = Database(Path(self.temp_dir.name) / "flow.db")
        self.service = TrainingService(
            llm=FakeLLMForTests(),
            sessions=SessionRepository(test_db),
            reviews=ReviewRepository(test_db),
            hints=HintRepository(test_db),
        )

    def test_create_and_send_turn_with_test_double(self) -> None:
        created = self.service.create_session(
            CreateSessionRequest(scenario_id="workplace-progress", difficulty=2)
        )
        self.assertEqual(created.scenario_id, "workplace-progress")
        self.assertEqual(created.role_id, "direct-manager")
        self.assertEqual(created.current_turn, 0)
        self.assertEqual(created.max_turns, 5)

        hint = self.service.get_hint(created.session_id)
        self.assertEqual(hint.turn, 0)
        self.assertEqual(hint.question_focus, "领导想确认真实完成度")
        self.assertEqual(self.service.get_hint(created.session_id), hint)

        response = self.service.add_turn(
            created.session_id,
            TurnRequest(message="目前完成80%，还剩支付回调测试。"),
        )
        self.assertEqual(response.current_turn, 1)
        self.assertIn("status_first", response.state.resolved_goal_ids)
        self.assertNotIn("status_first", response.state.unresolved_goal_ids)

        review = self.service.finish_and_review(created.session_id)
        self.assertEqual(review.session_id, created.session_id)
        self.assertEqual(review.end_reason, "user_ended")
        self.assertEqual(len(review.dimensions), 5)

        cached_review = self.service.finish_and_review(created.session_id)
        self.assertEqual(cached_review, review)

    def test_session_ends_after_five_user_answers_and_can_be_reviewed(self) -> None:
        created = self.service.create_session(
            CreateSessionRequest(scenario_id="workplace-progress", difficulty=2)
        )
        response = None
        for answer_number in range(1, 6):
            response = self.service.add_turn(
                created.session_id,
                TurnRequest(message=f"这是第 {answer_number} 次回答。"),
            )
        self.assertIsNotNone(response)
        self.assertEqual(response.current_turn, 5)
        self.assertTrue(response.end_session)
        self.assertEqual(response.status, "completed")

        review = self.service.finish_and_review(created.session_id)
        self.assertEqual(review.end_reason, "max_turns_reached")


class ZhipuRequestContractTests(unittest.TestCase):
    def test_zhipu_chat_completions_payload_and_response(self) -> None:
        captured = {}
        model_output = {
            "opponent_message": "目前到底完成了多少？",
            "phase": "ask_actual_status",
            "pressure_level": 2,
            "resolved_goal_ids": [],
            "unresolved_goal_ids": ["status_first"],
            "end_session": False,
            "end_reason": None,
        }
        provider_response = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(model_output, ensure_ascii=False),
                    }
                }
            ]
        }

        class FakeHTTPResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            @staticmethod
            def read() -> bytes:
                return json.dumps(provider_response, ensure_ascii=False).encode("utf-8")

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["authorization"] = request.headers["Authorization"]
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            captured["timeout"] = timeout
            return FakeHTTPResponse()

        fake_settings = SimpleNamespace(
            llm_enabled=True,
            zhipu_api_url="https://open.bigmodel.cn/api/paas/v4/chat/completions",
            zhipu_api_key="test-key",
            zhipu_model="glm-4.7-flash",
            zhipu_models=["glm-4.7-flash"],
            zhipu_timeout_seconds=30,
        )
        context = {
            "session_id": "session-test123",
            "request_type": "opening",
            "scenario": {},
            "role": {},
            "difficulty": 2,
            "session_state": {},
            "conversation_history": [],
        }

        with patch("backend.app.llm_service.settings", fake_settings), patch(
            "backend.app.llm_service.urllib.request.urlopen", fake_urlopen
        ):
            result = LLMService()._remote_turn(context, ["status_first"])

        self.assertEqual(
            captured["url"],
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        )
        self.assertEqual(captured["authorization"], "Bearer test-key")
        self.assertEqual(captured["payload"]["model"], "glm-4.7-flash")
        self.assertEqual(captured["payload"]["response_format"], {"type": "json_object"})
        self.assertFalse(captured["payload"]["stream"])
        self.assertRegex(
            captured["payload"]["request_id"],
            r"^session-test123-[0-9a-f]{12}-m0$",
        )
        self.assertEqual(captured["payload"]["max_tokens"], 400)
        self.assertEqual(result.opponent_message, "目前到底完成了多少？")

    def test_repeated_question_detection(self) -> None:
        previous = ["所以现在具体完成到哪一步了？已经完成哪些部分，还剩什么没做？"]
        self.assertTrue(
            LLMService._repeats_previous_question(
                "所以现在具体完成到哪一步了？已经完成哪些部分，还剩什么没做？",
                previous,
            )
        )
        self.assertFalse(
            LLMService._repeats_previous_question(
                "支付公司的变更我知道了，你昨晚为什么没有及时预警？",
                previous,
            )
        )
        self.assertTrue(
            LLMService._repeats_previous_question(
                "先别解释背景，给我一个明确的完成时间。",
                ["这个完整版本什么时候能交？"],
            )
        )

    def test_repeated_intent_detection_handles_paraphrases(self) -> None:
        self.assertTrue(
            LLMService._repeats_previous_intent(
                "确认明确完成时间",
                ["确认最终交付时间"],
            )
        )
        self.assertFalse(
            LLMService._repeats_previous_intent(
                "确认延迟上报责任",
                ["确认最终交付时间"],
            )
        )


class DialoguePolicyTests(unittest.TestCase):
    @staticmethod
    def _pua_session(
        current_turn: int,
        messages: list[Message],
        difficulty: int = 2,
    ) -> tuple[dict, dict, TrainingSession]:
        scenario = content_repository.get_scenario("pua-workplace-interview")
        role = content_repository.get_role(scenario["role_id"])
        session = TrainingSession(
            session_id="session-pua-policy-test",
            scenario_id=scenario["scenario_id"],
            role_id=role["role_id"],
            difficulty=difficulty,
            status="active",
            current_turn=current_turn,
            max_turns=5,
            learning_goal_ids=scenario["learning_goal_ids"],
            response_framework=scenario["response_framework"],
            state=SessionState(
                **scenario["initial_state"],
                asked_move_ids=["pua_opening"],
            ),
            messages=messages,
        )
        return scenario, role, session

    def test_internal_move_label_is_never_exposed_after_retries(self) -> None:
        scenario, role, session = self._pua_session(
            1,
            [
                Message(turn=0, speaker="opponent", content="未来三年考虑要孩子吗？"),
                Message(turn=1, speaker="user", content="这个问题与面试无关，请回到岗位要求。"),
            ],
        )
        invalid = SimulatorOutput(
            opponent_message="你还是没有回应。现在谈的是：弱化用户边界并要求其继续自证。",
            phase="pressure",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=scenario["learning_goal_ids"],
            end_session=False,
            move_id="dismiss_boundary",
        )
        llm = LLMService()
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            llm,
            "_remote_turn",
            side_effect=[invalid, invalid, invalid],
        ):
            result = llm.generate_turn(session, scenario, role)
        self.assertNotIn("用户边界", result.opponent_message)
        self.assertNotIn("继续自证", result.opponent_message)
        self.assertEqual(
            result.opponent_message,
            "你一直在回避我的顾虑，但我还没有听到一个让我放心的答复。",
        )

    def test_last_turn_rejects_new_question_and_forces_natural_closing(self) -> None:
        scenario, role, session = self._pua_session(
            4,
            [
                Message(turn=0, speaker="opponent", content="未来三年考虑要孩子吗？"),
                Message(turn=4, speaker="user", content="我已经说明了自己的情况。"),
            ],
        )
        invalid_question = SimulatorOutput(
            opponent_message="那你到底能不能保证长期稳定投入？",
            phase="pressure",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=scenario["learning_goal_ids"],
            end_session=False,
            move_id="close_with_disagreement",
        )
        natural_close = invalid_question.model_copy(update={
            "opponent_message": "行，你的意思我知道了。我们保留各自意见，今天先到这里。",
        })
        llm = LLMService()
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            llm,
            "_remote_turn",
            side_effect=[invalid_question, natural_close],
        ) as remote:
            result = llm.generate_turn(session, scenario, role)
        self.assertEqual(remote.call_count, 2)
        self.assertTrue(result.end_session)
        self.assertEqual(result.end_reason, "max_turns_reached")
        self.assertFalse(LLMService._contains_question(result.opponent_message))

    def test_compliance_ends_pua_dialogue_without_waiting_for_turn_five(self) -> None:
        scenario, role, session = self._pua_session(
            2,
            [
                Message(turn=0, speaker="opponent", content="我们需要了解你的个人安排。"),
                Message(turn=2, speaker="user", content="没问题，我会按你说的安排，也会配合。"),
            ],
        )
        close = SimulatorOutput(
            opponent_message="好，那就按刚才确认的安排执行，今天先谈到这里。",
            phase="closed",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=scenario["learning_goal_ids"],
            end_session=True,
            move_id="close_after_compliance",
        )
        llm = LLMService()
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            llm,
            "_remote_turn",
            return_value=close,
        ) as remote:
            result = llm.generate_turn(session, scenario, role)
        sent_context = remote.call_args.args[0]
        self.assertEqual(sent_context["request_type"], "closing")
        self.assertEqual(sent_context["server_user_response_hint"], "compliance")
        self.assertEqual(result.end_reason, "user_complied")
        self.assertTrue(result.end_session)

    def test_second_clear_boundary_ends_pua_dialogue(self) -> None:
        scenario, role, session = self._pua_session(
            2,
            [
                Message(turn=0, speaker="opponent", content="未来三年考虑要孩子吗？"),
                Message(turn=1, speaker="user", content="这个问题与面试无关，请回到岗位要求。"),
                Message(turn=1, speaker="opponent", content="我们只是想了解稳定性。"),
                Message(turn=2, speaker="user", content="我不接受婚育询问，只讨论岗位能力。"),
            ],
        )
        close = SimulatorOutput(
            opponent_message="好，你的立场我听到了。这个问题今天先到这里。",
            phase="closed",
            pressure_level=2,
            resolved_goal_ids=["set_boundary"],
            unresolved_goal_ids=[goal for goal in scenario["learning_goal_ids"] if goal != "set_boundary"],
            end_session=True,
            move_id="close_after_boundary",
        )
        llm = LLMService()
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            llm,
            "_remote_turn",
            return_value=close,
        ):
            result = llm.generate_turn(session, scenario, role)
        self.assertEqual(result.end_reason, "boundary_held")
        self.assertEqual(result.closure_type, "boundary_held")

    def test_easy_pua_closes_on_first_clear_boundary(self) -> None:
        scenario, role, session = self._pua_session(
            current_turn=1,
            messages=[
                Message(turn=0, speaker="opponent", content="你以后是不是会因为家庭影响工作？"),
                Message(turn=1, speaker="user", content="这是我的隐私，请只讨论岗位能力。"),
            ],
            difficulty=1,
        )
        service = LLMService()
        natural_close = SimulatorOutput(
            opponent_message="好，那我们回到岗位本身，今天先到这里。",
            phase="closed",
            pressure_level=1,
            resolved_goal_ids=[],
            unresolved_goal_ids=session.learning_goal_ids,
            move_id="close_after_boundary",
            end_session=True,
        )
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            service,
            "_remote_turn",
            return_value=natural_close,
        ):
            result = service.generate_turn(session, scenario, role)

        self.assertTrue(result.end_session)
        self.assertEqual(result.end_reason, "boundary_held")

    def test_soft_redirect_after_boundary_also_closes_dialogue(self) -> None:
        scenario, role, session = self._pua_session(
            current_turn=2,
            messages=[
                Message(turn=0, speaker="opponent", content="未来三年考虑要孩子吗？"),
                Message(turn=1, speaker="user", content="这个问题和面试没有关系吧，我们可以聊项目。"),
                Message(turn=1, speaker="opponent", content="我们需要了解你能不能长期稳定投入。"),
                Message(turn=2, speaker="user", content="我会安排好工作。您这边还有什么其他感兴趣的吗？"),
            ],
        )
        service = LLMService()
        natural_close = SimulatorOutput(
            opponent_message="好，你的立场我知道了，我们回到岗位本身。今天先到这里。",
            phase="closed",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=session.learning_goal_ids,
            move_id="close_after_boundary",
            end_session=True,
        )
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            service,
            "_remote_turn",
            return_value=natural_close,
        ):
            result = service.generate_turn(session, scenario, role)

        self.assertTrue(result.end_session)
        self.assertEqual(result.user_response_type, "boundary")
        self.assertEqual(result.end_reason, "boundary_held")

    def test_generate_turn_retries_semantic_duplicate_and_changes_direction(self) -> None:
        scenario = content_repository.get_scenario("workplace-progress")
        role = content_repository.get_role("direct-manager")
        session = TrainingSession(
            session_id="session-retry-test",
            scenario_id=scenario["scenario_id"],
            role_id=role["role_id"],
            difficulty=2,
            status="active",
            current_turn=1,
            max_turns=5,
            learning_goal_ids=scenario["learning_goal_ids"],
            response_framework=scenario["response_framework"],
            state=SessionState(
                **scenario["initial_state"],
                asked_move_ids=["ask_actual_status"],
            ),
            messages=[
                Message(turn=0, speaker="opponent", content="完整版本什么时候能交？"),
                Message(turn=1, speaker="user", content="支付回调还在适配。"),
            ],
        )
        repeated = SimulatorOutput(
            opponent_message="给我一个明确的完成时间。",
            phase="plan",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=scenario["learning_goal_ids"],
            end_session=False,
            move_id="request_specific_status",
            question_intent="确认完成时间",
        )
        fresh = SimulatorOutput(
            opponent_message="支付公司的变更我知道了，你昨晚为什么没有及时预警？",
            phase="ownership",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=scenario["learning_goal_ids"],
            end_session=False,
            move_id="challenge_late_reporting",
            question_intent="确认延迟上报原因",
        )
        llm = LLMService()
        with patch("backend.app.llm_service.settings", SimpleNamespace(llm_enabled=True)), patch.object(
            llm,
            "_remote_turn",
            side_effect=[repeated, fresh],
        ) as remote:
            result = llm.generate_turn(session, scenario, role)
        self.assertEqual(remote.call_count, 2)
        self.assertEqual(result.move_id, "challenge_late_reporting")
        self.assertIn("及时预警", result.opponent_message)

    def test_used_move_is_removed_from_allowed_moves(self) -> None:
        scenario = content_repository.get_scenario("workplace-progress")
        role = content_repository.get_role("direct-manager")
        session = TrainingSession(
            session_id="session-policy-test",
            scenario_id=scenario["scenario_id"],
            role_id=role["role_id"],
            difficulty=2,
            status="active",
            current_turn=1,
            max_turns=5,
            learning_goal_ids=scenario["learning_goal_ids"],
            response_framework=scenario["response_framework"],
            state=SessionState(
                **scenario["initial_state"],
                asked_move_ids=["ask_actual_status", "request_specific_status"],
            ),
            messages=[],
        )
        allowed_ids = [move["move_id"] for move in build_allowed_moves(session, role)]
        self.assertNotIn("ask_actual_status", allowed_ids)
        self.assertNotIn("request_specific_status", allowed_ids)
        self.assertIn("challenge_late_reporting", allowed_ids)

    def test_state_ledger_is_monotonic(self) -> None:
        previous = SessionState(
            phase="status",
            pressure_level=2,
            resolved_goal_ids=["status_first"],
            unresolved_goal_ids=["actionable_plan"],
            asked_move_ids=["request_specific_status"],
            asked_question_intents=["确认当前进度"],
            covered_fact_slots=["完成度"],
        )
        output = SimulatorOutput(
            opponent_message="下一步谁负责？",
            phase="plan",
            pressure_level=2,
            resolved_goal_ids=[],
            unresolved_goal_ids=["status_first", "actionable_plan"],
            end_session=False,
            move_id="request_actionable_plan",
            question_intent="确认下一步负责人",
            acknowledged_fact_slots=["延期原因"],
        )
        merged = apply_output_to_state(
            previous,
            output,
            ["status_first", "actionable_plan"],
            None,
        )
        self.assertEqual(merged.resolved_goal_ids, ["status_first"])
        self.assertEqual(merged.asked_move_ids[-1], "request_actionable_plan")
        self.assertEqual(merged.covered_fact_slots, ["完成度", "延期原因"])

    def test_expression_retrieval_excludes_previous_utterance(self) -> None:
        role = content_repository.get_role("direct-manager")
        previous = ["为什么这个风险昨天没说？"]
        results = ExpressionRetriever().retrieve(
            "项目延期 风险上报",
            role,
            previous_opponent_messages=previous,
            top=3,
        )
        self.assertTrue(results)
        self.assertNotIn(previous[0], [item["utterance"] for item in results])

    def test_pressure_corpus_is_retrieved_only_as_anti_examples(self) -> None:
        role = content_repository.get_role("direct-manager")
        results = PUARetriever().retrieve_anti_examples(
            "领导说公司不养闲人，不想干就走",
            role,
            top=2,
        )
        self.assertTrue(results)
        self.assertTrue(all(item["domain"] == "workplace" for item in results))
        self.assertTrue(all(item["usage"].startswith("反例") for item in results))

    def test_every_pua_utterance_has_scene_tactics_and_difficulty(self) -> None:
        entries = load_pua_corpus()
        self.assertTrue(entries)
        self.assertTrue(all(entry.scenario_types for entry in entries))
        self.assertTrue(all(entry.tactic_tags for entry in entries))
        self.assertTrue(all(entry.severity in {1, 2, 3} for entry in entries))
        self.assertTrue(all(entry.difficulty_label in {"容易", "中等", "困难"} for entry in entries))

    def test_pua_modules_are_independent_compatible_scenarios(self) -> None:
        self.assertEqual(len(MODULES), 10)
        for module in MODULES:
            scenario = content_repository.get_scenario(module["module_id"])
            role = content_repository.get_role(scenario["role_id"])
            self.assertEqual(scenario["training_mode"], "pua_response")
            self.assertEqual(role["applies_to_scenarios"], [scenario["scenario_id"]])
            self.assertEqual(set(scenario["learning_goal_ids"]), set(role["learning_goal_alignment"]))
            forbidden_ids = {
                item["rule_id"] for item in role["behavior_policy"]["forbidden_behaviors"]
            }
            self.assertNotIn("no_personal_humiliation", forbidden_ids)
            self.assertNotIn("no_gender_discrimination", forbidden_ids)

    def test_controlled_retrieval_is_module_and_difficulty_scoped(self) -> None:
        results = PUARetriever().retrieve_controlled(
            module_id="pua-family-marriage",
            difficulty=1,
            query="过年家里催婚",
            previous_opponent_messages=[],
            top=5,
        )
        self.assertTrue(results)
        self.assertTrue(all(item["domain"] == "family" for item in results))
        self.assertTrue(all("family_marriage_pressure" in item["scenario_types"] for item in results))
        self.assertTrue(all(item["severity"] <= 1 for item in results))

    def test_llm_context_uses_only_one_rag_channel(self) -> None:
        llm = LLMService()
        ordinary = content_repository.get_scenario("workplace-progress")
        ordinary_role = content_repository.get_role(ordinary["role_id"])
        ordinary_session = TrainingSession(
            session_id="ordinary-rag",
            scenario_id=ordinary["scenario_id"],
            role_id=ordinary_role["role_id"],
            difficulty=2,
            status="active",
            current_turn=0,
            max_turns=5,
            learning_goal_ids=ordinary["learning_goal_ids"],
            response_framework=ordinary["response_framework"],
            state=SessionState.model_validate(ordinary["initial_state"]),
            messages=[],
        )
        ordinary_context = {}
        llm._attach_retrieval(
            ordinary_context,
            ordinary_session,
            ordinary,
            ordinary_role,
            "项目进度",
            [],
            build_allowed_moves(ordinary_session, ordinary_role),
        )
        self.assertEqual(ordinary_context["controlled_pressure_examples"], [])

        pua = content_repository.get_scenario("pua-workplace-overtime")
        pua_role = content_repository.get_role(pua["role_id"])
        pua_session = TrainingSession(
            session_id="pua-rag",
            scenario_id=pua["scenario_id"],
            role_id=pua_role["role_id"],
            difficulty=2,
            status="active",
            current_turn=0,
            max_turns=5,
            learning_goal_ids=pua["learning_goal_ids"],
            response_framework=pua["response_framework"],
            state=SessionState.model_validate(pua["initial_state"]),
            messages=[],
        )
        pua_context = {}
        llm._attach_retrieval(
            pua_context,
            pua_session,
            pua,
            pua_role,
            "周末加班",
            [],
            build_allowed_moves(pua_session, pua_role),
        )
        self.assertTrue(pua_context["controlled_pressure_examples"])
        self.assertEqual(pua_context["expression_references"], [])
        self.assertEqual(pua_context["pressure_anti_examples"], [])


class SQLitePersistenceTests(unittest.TestCase):
    def test_session_messages_hint_and_review_survive_repository_recreation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "training.db"
            db = Database(db_path)
            sessions = SessionRepository(db)
            hints = HintRepository(db)
            reviews = ReviewRepository(db)

            # Build records through the validated public models without an API call.
            session = TrainingSession(
                session_id="session-persistence-test",
                scenario_id="workplace-progress",
                role_id="direct-manager",
                difficulty=2,
                status="active",
                current_turn=1,
                max_turns=5,
                learning_goal_ids=["status_first"],
                response_framework=["status"],
                state=SessionState(
                    phase="ask_actual_status",
                    pressure_level=2,
                    resolved_goal_ids=[],
                    unresolved_goal_ids=["status_first"],
                ),
                messages=[
                    Message(turn=0, speaker="opponent", content="现在做到哪了？"),
                    Message(turn=1, speaker="user", content="目前完成了三项。"),
                ],
            )
            sessions.save(session)

            hint = HintOutput(
                question_focus="真实完成度",
                communication_move="先报数字",
                facts_to_use=["5 项完成 3 项"],
                sentence_starter="目前已经完成___。",
                watch_out="不要先解释原因",
            )
            hints.save(HintResponse(session_id=session.session_id, turn=1, **hint.model_dump()))
            review_output = ReviewOutput(
                summary="信息基本明确",
                strengths=["给出了数字"],
                priority_improvements=["补充时间"],
                dimensions=[
                    ReviewDimension(
                        goal_id="status_first",
                        name="先报现状",
                        score=3,
                        evidence="目前完成了三项",
                        feedback="继续补充剩余项",
                    )
                ],
                better_response="目前五项完成三项。",
                next_practice="先用一句话报数字",
            )
            reviews.save(
                ReviewResponse(
                    session_id=session.session_id,
                    end_reason="user_ended",
                    **review_output.model_dump(),
                )
            )

            self.assertEqual(SessionRepository(Database(db_path)).get(session.session_id), session)
            self.assertIsNotNone(HintRepository(Database(db_path)).get_optional(session.session_id, 1))
            self.assertIsNotNone(ReviewRepository(Database(db_path)).get_optional(session.session_id))


class IncidentIntakeFlowTests(unittest.TestCase):
    def test_description_is_clarified_persisted_and_confirmed(self) -> None:
        class FakeIncidentLLM:
            @staticmethod
            def analyze_incident(incident) -> IncidentAnalysisOutput:
                if len([message for message in incident.messages if message.kind == "answer"]) == 0:
                    return IncidentAnalysisOutput(
                        acknowledgement="我理解你在会议上被领导追问进度，当时没有说清楚。",
                        draft=SceneDraft(
                            title="会议上被领导追问进度",
                            event_timing="happened",
                            counterpart_identity="直属领导",
                            relationship="上下级",
                            setting="项目会议",
                            situation_summary="领导突然追问延期原因和交付时间。",
                            counterpart_words_or_actions=["为什么还没完成？"],
                            pressure_level=2,
                            known_facts=["项目发生延期"],
                        ),
                        missing_fields=["user_words_or_actions", "stuck_point", "desired_outcome"],
                        next_question="你当时具体怎么回答的？",
                        ready_for_confirmation=False,
                    )
                return IncidentAnalysisOutput(
                    acknowledgement="你当时一直解释技术原因，真正卡住的是没有先说结果。",
                    draft=SceneDraft(
                        title="会议上被领导追问进度",
                        event_timing="happened",
                        counterpart_identity="直属领导",
                        relationship="上下级",
                        setting="项目会议",
                        situation_summary="领导突然追问延期原因和交付时间。",
                        counterpart_words_or_actions=["为什么还没完成？"],
                        user_words_or_actions="一直解释技术问题，没有说明交付时间。",
                        stuck_point="紧张时先解释原因，无法快速给出结论。",
                        desired_outcome="先说明完成度，再给出明确交付方案。",
                        pressure_level=2,
                        known_facts=["项目发生延期"],
                        learning_focus=["先说结论", "给出明确时间"],
                        role_behavior=["短句追问结果", "对模糊时间继续追问"],
                    ),
                    missing_fields=[],
                    next_question=None,
                    ready_for_confirmation=True,
                )

        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "incidents.db"
            repository = IncidentRepository(Database(db_path))
            service = IncidentService(llm=FakeIncidentLLM(), incidents=repository)

            created = service.create(
                CreateIncidentRequest(
                    description="今天开会时领导突然问项目为什么还没完成，我一下子没说清楚。"
                )
            )
            self.assertEqual(created.status, "clarifying")
            self.assertEqual(created.next_question, "你当时具体怎么回答的？")

            ready = service.answer(
                created.incident_id,
                IncidentAnswerRequest(answer="我一直解释技术问题，但没说完成度和交付时间。"),
            )
            self.assertEqual(ready.status, "ready")
            self.assertEqual(ready.missing_fields, [])
            self.assertEqual(len(ready.draft.learning_focus), 2)

            persisted = IncidentRepository(Database(db_path)).get(created.incident_id)
            self.assertEqual(persisted, ready)

            confirmed = service.confirm(created.incident_id)
            self.assertEqual(confirmed.status, "confirmed")


class CustomTrainingFlowTests(unittest.TestCase):
    def test_confirmed_incident_starts_and_continues_dynamic_training(self) -> None:
        class FakeCustomTrainingLLM:
            @staticmethod
            def generate_training_blueprint(incident) -> TrainingBlueprintOutput:
                return TrainingBlueprintOutput(
                    training_objective="练习在被突然追问时先说结果，再提出明确下一步。",
                    preparation_tip="先用一句话说结果，再回应原因。",
                    role_display_name="直属领导",
                    role_public_goal="确认真实进度和交付时间。",
                    hidden_concerns=["担心客户追责"],
                    voice_rules=["短句追问", "用户说清后转向下一问题"],
                    pressure_moves=["用户只解释原因时，追问现在能交什么"],
                    concession_conditions=["用户给出明确时间后降低压力"],
                    opening_intent="引用会议上的延期问题直接追问进度。",
                    learning_goals=[
                        TrainingGoalBlueprint(
                            name="先说结果",
                            description="先说明当前完成状态。",
                            success_evidence="回答开头出现明确结果。",
                        ),
                        TrainingGoalBlueprint(
                            name="明确下一步",
                            description="给出动作和时间。",
                            success_evidence="出现具体动作与时间点。",
                        ),
                    ],
                )

            @staticmethod
            def generate_opening(session, scenario, role) -> SimulatorOutput:
                return SimulatorOutput(
                    opponent_message="刚才会上你没说清楚，现在项目到底能什么时候交？",
                    phase="custom_opening",
                    pressure_level=2,
                    resolved_goal_ids=[],
                    unresolved_goal_ids=session.learning_goal_ids,
                    end_session=False,
                    end_reason=None,
                )

            @staticmethod
            def generate_turn(session, scenario, role) -> SimulatorOutput:
                return SimulatorOutput(
                    opponent_message="好，具体由谁负责下一步？",
                    phase="custom_follow_up",
                    pressure_level=2,
                    resolved_goal_ids=[session.learning_goal_ids[0]],
                    unresolved_goal_ids=[session.learning_goal_ids[1]],
                    end_session=False,
                    end_reason=None,
                )

            @staticmethod
            def generate_hint(session, scenario) -> HintOutput:
                return HintOutput(
                    question_focus="对方想确认明确交付时间",
                    communication_move="先给时间，再补条件",
                    facts_to_use=scenario["situation"]["known_facts"][:1],
                    sentence_starter="我先说结论：___。",
                    watch_out="不要只解释原因",
                )

            @staticmethod
            def generate_review(session, scenario) -> ReviewOutput:
                return ReviewOutput(
                    summary="已经开始先说结果。",
                    strengths=["给出了明确时间"],
                    priority_improvements=["补充负责人"],
                    dimensions=[
                        ReviewDimension(
                            goal_id=detail["goal_id"],
                            name=detail["name"],
                            score=3,
                            evidence="测试表达证据",
                            feedback="继续说得更具体",
                        )
                        for detail in scenario["learning_goal_details"]
                    ],
                    better_response="目前延期一天，明天十一点交付。",
                    next_practice="用一句话说结果和时间",
                )

        with tempfile.TemporaryDirectory() as temp_dir:
            db = Database(Path(temp_dir) / "custom-training.db")
            incidents = IncidentRepository(db)
            generated = GeneratedScenarioRepository(db)
            sessions = SessionRepository(db)
            trainer = TrainingService(
                llm=FakeCustomTrainingLLM(),
                sessions=sessions,
                reviews=ReviewRepository(db),
                hints=HintRepository(db),
                generated=generated,
            )
            service = CustomTrainingService(
                llm=FakeCustomTrainingLLM(),
                incidents=incidents,
                generated=generated,
                trainer=trainer,
            )
            incident = IncidentRecord(
                incident_id="incident-custom-test",
                status="confirmed",
                draft=SceneDraft(
                    title="会上被追问延期",
                    event_timing="happened",
                    counterpart_identity="直属领导",
                    relationship="上下级",
                    setting="项目会议",
                    situation_summary="领导突然追问项目延期。",
                    counterpart_words_or_actions=["为什么还没完成？"],
                    user_words_or_actions="一直解释技术原因。",
                    stuck_point="没有先说结果。",
                    desired_outcome="明确说明进度和交付时间。",
                    pressure_level=2,
                    known_facts=["项目已经延期"],
                ),
                messages=[
                    IncidentMessage(
                        speaker="user",
                        kind="description",
                        content="会上领导突然追问延期，我没说清楚。",
                    )
                ],
            )
            incidents.save(incident)

            started = service.start(incident.incident_id)
            self.assertEqual(started.session.max_turns, 5)
            self.assertEqual(started.role_display_name, "直属领导")
            self.assertTrue(started.session.scenario_id.startswith("custom-scene-"))
            self.assertIsNotNone(generated.get_by_incident(incident.incident_id))

            hint = trainer.get_hint(started.session.session_id)
            self.assertEqual(hint.question_focus, "对方想确认明确交付时间")

            continued = trainer.add_turn(
                started.session.session_id,
                TurnRequest(message="目前延期一天，明天上午十一点可以交。"),
            )
            self.assertEqual(continued.current_turn, 1)
            self.assertEqual(continued.opponent_message, "好，具体由谁负责下一步？")

            review = trainer.finish_and_review(started.session.session_id)
            self.assertEqual(
                [dimension.goal_id for dimension in review.dimensions],
                started.session.learning_goal_ids,
            )


if __name__ == "__main__":
    unittest.main()
