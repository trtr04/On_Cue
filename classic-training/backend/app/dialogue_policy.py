from __future__ import annotations

from typing import Any

from .models import SessionState, SimulatorOutput, TrainingSession


def build_allowed_moves(
    session: TrainingSession,
    role: dict,
    opening: bool = False,
    closing: bool = False,
) -> list[dict[str, Any]]:
    """Return unused role moves in goal priority order.

    This is deliberately deterministic: the model may phrase a move, but it may
    not silently return to a move that the session ledger has already consumed.
    """
    behavior = role.get("behavior_policy", {})
    if opening:
        opening_move = behavior.get("opening_move", {})
        return [_normalize_move(opening_move, goal_id=None)] if opening_move else []
    if closing:
        closing_moves = behavior.get("closing_moves") or [
            {
                "move_id": "close_with_decision",
                "message_intent": "确认当前决定并结束谈话",
                "fallback_line": "好，目前能确认的就到这里。后续按刚才说定的安排推进。",
            },
            {
                "move_id": "close_with_disagreement",
                "message_intent": "保留分歧并结束谈话",
                "fallback_line": "好，你的立场我听到了。我们先保留分歧，今天谈到这里。",
            },
        ]
        return [_normalize_move(move, goal_id=None) for move in closing_moves]

    pressure_moves = {
        item.get("move_id"): item
        for item in behavior.get("pressure_moves", [])
        if item.get("move_id")
    }
    used = set(session.state.asked_move_ids)
    candidates: list[dict[str, Any]] = []
    alignment = role.get("learning_goal_alignment", {})

    for goal_id in session.state.unresolved_goal_ids:
        for move_id in alignment.get(goal_id, []):
            if move_id in pressure_moves and move_id not in used:
                candidates.append(_normalize_move(pressure_moves[move_id], goal_id))

    # Custom roles intentionally have no fixed goal-to-move mapping. Their
    # generated pressure moves still form a useful one-pass policy sequence.
    if not candidates:
        for move_id, move in pressure_moves.items():
            if move_id not in used:
                candidates.append(_normalize_move(move, goal_id=None))

    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in candidates:
        if item["move_id"] not in seen:
            unique.append(item)
            seen.add(item["move_id"])
    return unique[:4]


def apply_output_to_state(
    previous: SessionState,
    output: SimulatorOutput,
    learning_goal_ids: list[str],
    end_reason: str | None,
) -> SessionState:
    """Merge model output into the monotonic server-owned dialogue ledger."""
    resolved = list(dict.fromkeys([*previous.resolved_goal_ids, *output.resolved_goal_ids]))
    resolved = [goal_id for goal_id in learning_goal_ids if goal_id in resolved]
    unresolved = [goal_id for goal_id in learning_goal_ids if goal_id not in resolved]

    asked_moves = list(previous.asked_move_ids)
    if output.move_id and output.move_id not in asked_moves:
        asked_moves.append(output.move_id)

    asked_intents = list(previous.asked_question_intents)
    if output.question_intent and output.question_intent not in asked_intents:
        asked_intents.append(output.question_intent)

    covered_slots = list(dict.fromkeys([
        *previous.covered_fact_slots,
        *output.acknowledged_fact_slots,
    ]))
    return SessionState(
        phase=output.phase,
        pressure_level=output.pressure_level,
        resolved_goal_ids=resolved,
        unresolved_goal_ids=unresolved,
        end_reason=end_reason,
        asked_move_ids=asked_moves,
        asked_question_intents=asked_intents,
        covered_fact_slots=covered_slots,
        last_move_id=output.move_id or previous.last_move_id,
        last_user_response_type=output.user_response_type or previous.last_user_response_type,
        closure_type=output.closure_type or previous.closure_type,
    )


def _normalize_move(move: dict, goal_id: str | None) -> dict[str, Any]:
    intent = (
        move.get("goal")
        or move.get("message_intent")
        or move.get("trigger_and_reaction")
        or move.get("trigger")
        or move.get("move_id", "")
    )
    return {
        "move_id": move.get("move_id"),
        "goal_id": goal_id,
        "intent": intent,
        "trigger": move.get("trigger") or move.get("trigger_and_reaction"),
        "example": move.get("example"),
        "fallback_line": move.get("fallback_line"),
    }
