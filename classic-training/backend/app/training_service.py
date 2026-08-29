from __future__ import annotations

from uuid import uuid4

from fastapi import HTTPException

from .dialogue_policy import apply_output_to_state
from .llm_service import llm_service
from .models import (
    CreateSessionRequest,
    CreateSessionResponse,
    HintResponse,
    Message,
    ReviewResponse,
    ScenarioSummary,
    SessionState,
    TrainingSession,
    TurnRequest,
    TurnResponse,
)
from .repository import (
    GeneratedScenarioRepository,
    content_repository,
    generated_scenario_repository,
    hint_repository,
    review_repository,
    session_repository,
)


class TrainingService:
    def __init__(
        self,
        llm=llm_service,
        content=content_repository,
        sessions=session_repository,
        reviews=review_repository,
        hints=hint_repository,
        generated: GeneratedScenarioRepository = generated_scenario_repository,
    ) -> None:
        self.llm = llm
        self.content = content
        self.sessions = sessions
        self.reviews = reviews
        self.hints = hints
        self.generated = generated

    def list_scenarios(self) -> list[ScenarioSummary]:
        return [ScenarioSummary.model_validate(scenario) for scenario in self.content.list_scenarios()]

    def create_session(self, request: CreateSessionRequest) -> CreateSessionResponse:
        scenario = self.content.get_scenario(request.scenario_id)
        role = self.content.get_role(scenario["role_id"])
        return self.create_session_from_content(scenario, role, request.difficulty)

    def create_session_from_content(
        self,
        scenario: dict,
        role: dict,
        difficulty: int | None = None,
    ) -> CreateSessionResponse:
        if scenario["scenario_id"] not in role["applies_to_scenarios"]:
            raise HTTPException(status_code=500, detail="Scenario and role are not compatible")
        if set(scenario["learning_goal_ids"]) != set(role["learning_goal_alignment"]):
            raise HTTPException(status_code=500, detail="Scenario and role learning goals are not aligned")

        difficulty = difficulty or scenario["default_difficulty"]
        if difficulty not in scenario["difficulty_options"]:
            raise HTTPException(status_code=400, detail="Difficulty is not supported by this scenario")

        state_data = dict(scenario["initial_state"])
        state_data["pressure_level"] = difficulty
        session = TrainingSession(
            session_id=f"session-{uuid4().hex[:12]}",
            scenario_id=scenario["scenario_id"],
            role_id=scenario["role_id"],
            difficulty=difficulty,
            status="active",
            current_turn=0,
            max_turns=scenario["max_turns"],
            learning_goal_ids=scenario["learning_goal_ids"],
            response_framework=scenario["response_framework"],
            state=SessionState.model_validate(state_data),
            messages=[],
        )
        opening_output = self.llm.generate_opening(session, scenario, role)
        opening = opening_output.opponent_message
        ledger_output = opening_output.model_copy(update={
            "resolved_goal_ids": [],
            "unresolved_goal_ids": session.learning_goal_ids,
        })
        session.state = apply_output_to_state(
            session.state,
            ledger_output,
            session.learning_goal_ids,
            end_reason=None,
        )
        session.messages.append(Message(turn=0, speaker="opponent", content=opening))
        self.sessions.save(session)
        return CreateSessionResponse(
            session_id=session.session_id,
            scenario_id=session.scenario_id,
            role_id=session.role_id,
            status=session.status,
            opponent_message=opening,
            current_turn=session.current_turn,
            max_turns=session.max_turns,
            learning_goal_ids=session.learning_goal_ids,
            response_framework=session.response_framework,
        )

    def get_session(self, session_id: str) -> TrainingSession:
        return self.sessions.get(session_id)

    def add_turn(self, session_id: str, request: TurnRequest) -> TurnResponse:
        session = self.sessions.get(session_id)
        if session.status != "active":
            raise HTTPException(status_code=409, detail="Training session has already ended")

        user_message = request.message.strip()
        if not user_message:
            raise HTTPException(status_code=422, detail="Message cannot be blank")
        user_turn = session.current_turn + 1
        session.messages.append(Message(turn=user_turn, speaker="user", content=user_message))

        scenario, role = self._get_scenario_and_role(session.scenario_id, session.role_id)
        output = self.llm.generate_turn(session, scenario, role)

        reached_limit = user_turn >= session.max_turns
        end_session = output.end_session or reached_limit
        end_reason = output.end_reason or ("max_turns_reached" if reached_limit else None)
        session.current_turn = user_turn
        session.state = apply_output_to_state(
            session.state,
            output,
            session.learning_goal_ids,
            end_reason=end_reason,
        )
        session.messages.append(Message(turn=user_turn, speaker="opponent", content=output.opponent_message))
        if end_session:
            session.status = "completed"
        self.sessions.save(session)

        return TurnResponse(
            session_id=session.session_id,
            status=session.status,
            opponent_message=output.opponent_message,
            current_turn=session.current_turn,
            max_turns=session.max_turns,
            state=session.state,
            end_session=end_session,
        )

    def finish_and_review(self, session_id: str) -> ReviewResponse:
        session = self.sessions.get(session_id)
        cached = self.reviews.get_optional(session_id)
        if cached is not None:
            return cached
        if session.status == "active":
            session.status = "user_ended"
            session.state.end_reason = "user_ended"
            self.sessions.save(session)
        scenario, _ = self._get_scenario_and_role(session.scenario_id, session.role_id)
        output = self.llm.generate_review(session, scenario)
        review = ReviewResponse(
            session_id=session.session_id,
            end_reason=session.state.end_reason or "completed",
            **output.model_dump(),
        )
        return self.reviews.save(review)

    def get_hint(self, session_id: str) -> HintResponse:
        session = self.sessions.get(session_id)
        if session.status != "active":
            raise HTTPException(status_code=409, detail="训练已经结束，无法再生成当前轮提示")
        cached = self.hints.get_optional(session_id, session.current_turn)
        if cached is not None:
            return cached
        scenario, _ = self._get_scenario_and_role(session.scenario_id, session.role_id)
        output = self.llm.generate_hint(session, scenario)
        hint = HintResponse(
            session_id=session.session_id,
            turn=session.current_turn,
            **output.model_dump(),
        )
        return self.hints.save(hint)

    def _get_scenario_and_role(self, scenario_id: str, role_id: str) -> tuple[dict, dict]:
        generated_scenario = self.generated.get_scenario_optional(scenario_id)
        generated_role = self.generated.get_role_optional(role_id)
        if generated_scenario is not None and generated_role is not None:
            return generated_scenario, generated_role
        return self.content.get_scenario(scenario_id), self.content.get_role(role_id)


training_service = TrainingService()
