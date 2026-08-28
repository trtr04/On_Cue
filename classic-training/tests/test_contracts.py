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
from backend.app.database import Database
from backend.app.incident_service import IncidentService
from backend.app.custom_training_service import CustomTrainingService
from backend.app.models import (
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
