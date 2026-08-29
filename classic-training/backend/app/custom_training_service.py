from __future__ import annotations

from fastapi import HTTPException

from .llm_service import llm_service
from .models import CustomTrainingStartResponse, ScenarioSummary, TrainingBlueprintOutput
from .repository import (
    GeneratedScenarioRepository,
    IncidentRepository,
    generated_scenario_repository,
    incident_repository,
)
from .training_service import TrainingService, training_service


class CustomTrainingService:
    def __init__(
        self,
        llm=llm_service,
        incidents: IncidentRepository = incident_repository,
        generated: GeneratedScenarioRepository = generated_scenario_repository,
        trainer: TrainingService = training_service,
    ) -> None:
        self.llm = llm
        self.incidents = incidents
        self.generated = generated
        self.trainer = trainer

    def start(self, incident_id: str, difficulty: int | None = None) -> CustomTrainingStartResponse:
        incident = self.incidents.get(incident_id)
        if incident.status != "confirmed":
            raise HTTPException(status_code=409, detail="请先确认并保存场景卡")

        cached = self.generated.get_by_incident(incident_id)
        if cached is None:
            blueprint = self.llm.generate_training_blueprint(incident)
            scenario, role = self._build_content(incident, blueprint)
            self.generated.save(incident_id, scenario, role)
        else:
            scenario, role = cached

        session = self.trainer.create_session_from_content(scenario, role, difficulty)
        return CustomTrainingStartResponse(
            session=session,
            scenario=ScenarioSummary.model_validate(scenario),
            role_display_name=role["display_name"],
        )

    @staticmethod
    def _build_content(incident, blueprint: TrainingBlueprintOutput) -> tuple[dict, dict]:
        draft = incident.draft
        suffix = incident.incident_id.removeprefix("incident-")
        scenario_id = f"custom-scene-{suffix}"
        role_id = f"custom-role-{suffix}"
        goal_ids = [f"custom_goal_{index}" for index in range(1, len(blueprint.learning_goals) + 1)]
        learning_goal_details = [
            {
                "goal_id": goal_id,
                "name": goal.name,
                "description": goal.description,
                "success_evidence": goal.success_evidence,
            }
            for goal_id, goal in zip(goal_ids, blueprint.learning_goals)
        ]
        counterpart_actions = "；".join(draft.counterpart_words_or_actions)
        known_facts = list(dict.fromkeys([
            *draft.known_facts,
            draft.situation_summary or "",
            f"对方当时的表达或行为：{counterpart_actions}",
            f"用户当时的回应：{draft.user_words_or_actions}",
            f"用户希望下一次做到：{draft.desired_outcome}",
        ]))
        known_facts = [fact for fact in known_facts if fact and not fact.endswith("：None")]

        scenario = {
            "schema_version": "0.1",
            "scenario_id": scenario_id,
            "version": "0.1",
            "title": draft.title or "我的真实经历训练",
            "short_description": blueprint.training_objective,
            "module": "classic_training",
            "role_id": role_id,
            "user_role": "真实经历中的自己",
            "briefing": {
                "setting": draft.setting or ("已经发生的真实场景" if draft.event_timing == "happened" else "即将发生的真实场景"),
                "user_identity": "你是这段经历中的自己",
                "counterpart": f"{draft.counterpart_identity}（{draft.relationship}）",
                "situation_summary": draft.situation_summary,
                "facts": [
                    {"label": "对方当时", "value": counterpart_actions},
                    {"label": "你当时", "value": draft.user_words_or_actions},
                    {"label": "你的卡点", "value": draft.stuck_point},
                    {"label": "这次想做到", "value": draft.desired_outcome},
                ],
                "user_mission": blueprint.training_objective,
                "preparation_tip": blueprint.preparation_tip,
            },
            "learning_goal_ids": goal_ids,
            "learning_goal_details": learning_goal_details,
            "response_framework": goal_ids,
            "situation": {
                "occasion": draft.setting or "用户确认的真实场景",
                "known_facts": known_facts,
                "user_goal": draft.desired_outcome,
                "role_goal": blueprint.role_public_goal,
            },
            "opening_guidance": {
                "intent": blueprint.opening_intent,
                "must_reference": "自然引用确认卡中的具体冲突事实。",
                "must_ask": "从角色在真实情境中最可能推进的一件事开始。",
                "must_not_do": "不要介绍训练规则，不要替用户回答。",
            },
            "difficulty_options": [1, 2, 3],
            "default_difficulty": draft.pressure_level or 2,
            "max_turns": 5,
            "initial_state": {
                "phase": "custom_opening",
                "pressure_level": draft.pressure_level or 2,
                "resolved_goal_ids": [],
                "unresolved_goal_ids": goal_ids,
                "end_reason": None,
            },
            "completion_policy": {
                "complete_when_all_goals_resolved": True,
                "complete_at_max_turns": True,
                "allow_user_exit": True,
            },
        }

        role = {
            "schema_version": "0.1",
            "role_id": role_id,
            "display_name": blueprint.role_display_name,
            "applies_to_scenarios": [scenario_id],
            "relationship": {"type": draft.relationship, "power_relation": "from_confirmed_scene"},
            "objectives": {
                "public_goal": blueprint.role_public_goal,
                "hidden_concerns": blueprint.hidden_concerns,
            },
            "voice": {
                "register": "符合真实关系的现代普通话",
                "speech_rules": blueprint.voice_rules,
            },
            "behavior_policy": {
                "opening_move": {"move_id": "custom_opening", "message_intent": blueprint.opening_intent},
                "pressure_moves": [
                    {"move_id": f"custom_pressure_{index}", "trigger_and_reaction": move}
                    for index, move in enumerate(blueprint.pressure_moves, start=1)
                ],
                "concession_rules": [
                    {"condition_id": f"custom_concession_{index}", "condition_and_reaction": condition}
                    for index, condition in enumerate(blueprint.concession_conditions, start=1)
                ],
                "forbidden_behaviors": [
                    {"rule_id": "no_personal_humiliation", "description": "不得人身羞辱或歧视。"},
                    {"rule_id": "no_unmotivated_abuse", "description": "不得无缘无故辱骂或威胁。"},
                    {"rule_id": "no_endless_pressure", "description": "用户说清后不得无限追问同一问题。"},
                    {"rule_id": "no_coaching_in_character", "description": "不得跳出角色教学或评价。"},
                    {"rule_id": "no_fact_denial", "description": "不得否认确认卡中的事实。"},
                ],
            },
            "learning_goal_alignment": {goal_id: [] for goal_id in goal_ids},
        }
        return scenario, role


custom_training_service = CustomTrainingService()
