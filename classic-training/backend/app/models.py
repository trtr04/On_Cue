from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SessionStatus = Literal["active", "completed", "user_ended"]
IncidentStatus = Literal["clarifying", "ready", "confirmed", "safety_redirect"]


class BriefingFact(BaseModel):
    label: str
    value: str


class ScenarioBriefing(BaseModel):
    setting: str
    user_identity: str
    counterpart: str
    situation_summary: str
    facts: list[BriefingFact]
    user_mission: str
    preparation_tip: str


class ScenarioSummary(BaseModel):
    scenario_id: str
    title: str
    short_description: str
    role_id: str
    briefing: ScenarioBriefing
    learning_goal_ids: list[str]
    difficulty_options: list[int]
    default_difficulty: int
    max_turns: int


class Message(BaseModel):
    turn: int
    speaker: Literal["opponent", "user"]
    content: str


class SessionState(BaseModel):
    phase: str
    pressure_level: int = Field(ge=1, le=3)
    resolved_goal_ids: list[str]
    unresolved_goal_ids: list[str]
    end_reason: str | None = None


class TrainingSession(BaseModel):
    session_id: str
    module: Literal["classic_training"] = "classic_training"
    scenario_id: str
    role_id: str
    difficulty: int = Field(ge=1, le=3)
    status: SessionStatus
    current_turn: int
    max_turns: int
    learning_goal_ids: list[str]
    response_framework: list[str]
    state: SessionState
    messages: list[Message]


class CreateSessionRequest(BaseModel):
    scenario_id: str
    difficulty: int | None = Field(default=None, ge=1, le=3)


class CreateSessionResponse(BaseModel):
    session_id: str
    scenario_id: str
    role_id: str
    status: SessionStatus
    opponent_message: str
    current_turn: int
    max_turns: int
    learning_goal_ids: list[str]
    response_framework: list[str]


class TurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1200)


class SimulatorOutput(BaseModel):
    opponent_message: str = Field(min_length=1, max_length=1200)
    phase: str
    pressure_level: int = Field(ge=1, le=3)
    resolved_goal_ids: list[str]
    unresolved_goal_ids: list[str]
    end_session: bool
    end_reason: str | None = None


class TurnResponse(BaseModel):
    session_id: str
    status: SessionStatus
    opponent_message: str
    current_turn: int
    max_turns: int
    state: SessionState
    end_session: bool


class HintOutput(BaseModel):
    question_focus: str
    communication_move: str
    facts_to_use: list[str]
    sentence_starter: str
    watch_out: str


class HintResponse(HintOutput):
    session_id: str
    turn: int


class ReviewDimension(BaseModel):
    goal_id: str
    name: str
    score: int | None = Field(default=None, ge=1, le=5)
    evidence: str
    feedback: str


class ReviewOutput(BaseModel):
    summary: str
    strengths: list[str]
    priority_improvements: list[str]
    dimensions: list[ReviewDimension]
    better_response: str
    next_practice: str


class ReviewResponse(ReviewOutput):
    session_id: str
    end_reason: str


class SceneDraft(BaseModel):
    title: str | None = None
    event_timing: Literal["happened", "upcoming"] | None = None
    counterpart_identity: str | None = None
    relationship: str | None = None
    setting: str | None = None
    situation_summary: str | None = None
    counterpart_words_or_actions: list[str] = Field(default_factory=list)
    user_words_or_actions: str | None = None
    stuck_point: str | None = None
    desired_outcome: str | None = None
    pressure_level: int | None = Field(default=None, ge=1, le=3)
    known_facts: list[str] = Field(default_factory=list)
    learning_focus: list[str] = Field(default_factory=list)
    role_behavior: list[str] = Field(default_factory=list)


class IncidentMessage(BaseModel):
    speaker: Literal["user", "assistant"]
    kind: Literal["description", "question", "answer", "safety"]
    content: str


class IncidentAnalysisOutput(BaseModel):
    acknowledgement: str
    draft: SceneDraft
    missing_fields: list[str]
    next_question: str | None = None
    ready_for_confirmation: bool
    safety_concern: bool = False
    safety_message: str | None = None


class IncidentRecord(BaseModel):
    incident_id: str
    status: IncidentStatus
    source_type: Literal["text"] = "text"
    draft: SceneDraft = Field(default_factory=SceneDraft)
    messages: list[IncidentMessage] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    acknowledgement: str = ""
    next_question: str | None = None
    safety_message: str | None = None


class CreateIncidentRequest(BaseModel):
    description: str = Field(min_length=10, max_length=5000)


class IncidentAnswerRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=2500)


class TrainingGoalBlueprint(BaseModel):
    name: str
    description: str
    success_evidence: str


class TrainingBlueprintOutput(BaseModel):
    training_objective: str
    preparation_tip: str
    role_display_name: str
    role_public_goal: str
    hidden_concerns: list[str]
    voice_rules: list[str]
    pressure_moves: list[str]
    concession_conditions: list[str]
    opening_intent: str
    learning_goals: list[TrainingGoalBlueprint] = Field(min_length=2, max_length=5)


class CustomTrainingStartResponse(BaseModel):
    session: CreateSessionResponse
    scenario: ScenarioSummary
    role_display_name: str
