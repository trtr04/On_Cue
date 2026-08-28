from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from fastapi import HTTPException

from .config import PROJECT_DIR
from .database import Database, database
from .models import HintResponse, IncidentRecord, ReviewResponse, TrainingSession


class ContentRepository:
    def __init__(self, project_dir: Path = PROJECT_DIR) -> None:
        self.project_dir = project_dir
        self.scenario_dir = project_dir / "scenarios"
        self.role_dir = project_dir / "roles"

    @staticmethod
    def _read_json(path: Path) -> dict:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=f"Content not found: {path.stem}") from exc

    def list_scenarios(self) -> list[dict]:
        return [self._read_json(path) for path in sorted(self.scenario_dir.glob("*.json"))]

    def get_scenario(self, scenario_id: str) -> dict:
        for scenario in self.list_scenarios():
            if scenario.get("scenario_id") == scenario_id:
                return deepcopy(scenario)
        raise HTTPException(status_code=404, detail="Scenario not found")

    def get_role(self, role_id: str) -> dict:
        path = self.role_dir / f"{role_id}.json"
        role = self._read_json(path)
        if role.get("role_id") != role_id:
            raise HTTPException(status_code=500, detail="Role content is inconsistent")
        return deepcopy(role)


class SessionRepository:
    """Persists sessions and their ordered messages in SQLite."""

    def __init__(self, db: Database = database) -> None:
        self.db = db

    def save(self, session: TrainingSession) -> TrainingSession:
        session_json = session.model_dump_json(exclude={"messages"})
        with self.db.connect() as connection:
            connection.execute(
                """
                INSERT INTO training_sessions (session_id, scenario_id, status, session_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    scenario_id = excluded.scenario_id,
                    status = excluded.status,
                    session_json = excluded.session_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (session.session_id, session.scenario_id, session.status, session_json),
            )
            connection.execute("DELETE FROM messages WHERE session_id = ?", (session.session_id,))
            connection.executemany(
                """
                INSERT INTO messages (session_id, sequence_number, turn, speaker, content)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (session.session_id, index, message.turn, message.speaker, message.content)
                    for index, message in enumerate(session.messages)
                ],
            )
        return session

    def get(self, session_id: str) -> TrainingSession:
        with self.db.connect() as connection:
            row = connection.execute(
                "SELECT session_json FROM training_sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Training session not found")
            message_rows = connection.execute(
                """
                SELECT turn, speaker, content
                FROM messages
                WHERE session_id = ?
                ORDER BY sequence_number
                """,
                (session_id,),
            ).fetchall()
        session_data = json.loads(row["session_json"])
        session_data["messages"] = [dict(message_row) for message_row in message_rows]
        try:
            return TrainingSession.model_validate(session_data)
        except ValueError as exc:
            raise HTTPException(status_code=500, detail="Stored training session is invalid") from exc


class ReviewRepository:
    def __init__(self, db: Database = database) -> None:
        self.db = db

    def save(self, review: ReviewResponse) -> ReviewResponse:
        with self.db.connect() as connection:
            connection.execute(
                """
                INSERT INTO reviews (session_id, review_json)
                VALUES (?, ?)
                ON CONFLICT(session_id) DO UPDATE SET review_json = excluded.review_json
                """,
                (review.session_id, review.model_dump_json()),
            )
        return review

    def get_optional(self, session_id: str) -> ReviewResponse | None:
        with self.db.connect() as connection:
            row = connection.execute(
                "SELECT review_json FROM reviews WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return ReviewResponse.model_validate_json(row["review_json"]) if row else None


class HintRepository:
    def __init__(self, db: Database = database) -> None:
        self.db = db

    def save(self, hint: HintResponse) -> HintResponse:
        with self.db.connect() as connection:
            connection.execute(
                """
                INSERT INTO hints (session_id, turn, hint_json)
                VALUES (?, ?, ?)
                ON CONFLICT(session_id, turn) DO UPDATE SET hint_json = excluded.hint_json
                """,
                (hint.session_id, hint.turn, hint.model_dump_json()),
            )
        return hint

    def get_optional(self, session_id: str, turn: int) -> HintResponse | None:
        with self.db.connect() as connection:
            row = connection.execute(
                "SELECT hint_json FROM hints WHERE session_id = ? AND turn = ?",
                (session_id, turn),
            ).fetchone()
        return HintResponse.model_validate_json(row["hint_json"]) if row else None


class IncidentRepository:
    def __init__(self, db: Database = database) -> None:
        self.db = db

    def save(self, incident: IncidentRecord) -> IncidentRecord:
        incident_json = incident.model_dump_json(exclude={"messages"})
        with self.db.connect() as connection:
            connection.execute(
                """
                INSERT INTO incidents (incident_id, status, incident_json)
                VALUES (?, ?, ?)
                ON CONFLICT(incident_id) DO UPDATE SET
                    status = excluded.status,
                    incident_json = excluded.incident_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (incident.incident_id, incident.status, incident_json),
            )
            connection.execute(
                "DELETE FROM incident_messages WHERE incident_id = ?",
                (incident.incident_id,),
            )
            connection.executemany(
                """
                INSERT INTO incident_messages
                    (incident_id, sequence_number, speaker, kind, content)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (incident.incident_id, index, message.speaker, message.kind, message.content)
                    for index, message in enumerate(incident.messages)
                ],
            )
        return incident

    def get(self, incident_id: str) -> IncidentRecord:
        with self.db.connect() as connection:
            row = connection.execute(
                "SELECT incident_json FROM incidents WHERE incident_id = ?",
                (incident_id,),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="真实经历记录不存在")
            message_rows = connection.execute(
                """
                SELECT speaker, kind, content
                FROM incident_messages
                WHERE incident_id = ?
                ORDER BY sequence_number
                """,
                (incident_id,),
            ).fetchall()
        incident_data = json.loads(row["incident_json"])
        incident_data["messages"] = [dict(message_row) for message_row in message_rows]
        return IncidentRecord.model_validate(incident_data)


class GeneratedScenarioRepository:
    def __init__(self, db: Database = database) -> None:
        self.db = db

    def save(self, incident_id: str, scenario: dict, role: dict) -> tuple[dict, dict]:
        with self.db.connect() as connection:
            connection.execute(
                """
                INSERT INTO generated_scenarios
                    (scenario_id, incident_id, role_id, scenario_json, role_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(incident_id) DO UPDATE SET
                    scenario_id = excluded.scenario_id,
                    role_id = excluded.role_id,
                    scenario_json = excluded.scenario_json,
                    role_json = excluded.role_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    scenario["scenario_id"],
                    incident_id,
                    role["role_id"],
                    json.dumps(scenario, ensure_ascii=False),
                    json.dumps(role, ensure_ascii=False),
                ),
            )
        return scenario, role

    def get_by_incident(self, incident_id: str) -> tuple[dict, dict] | None:
        return self._get_pair("incident_id", incident_id)

    def get_scenario_optional(self, scenario_id: str) -> dict | None:
        pair = self._get_pair("scenario_id", scenario_id)
        return pair[0] if pair else None

    def get_role_optional(self, role_id: str) -> dict | None:
        pair = self._get_pair("role_id", role_id)
        return pair[1] if pair else None

    def _get_pair(self, column: str, value: str) -> tuple[dict, dict] | None:
        if column not in {"incident_id", "scenario_id", "role_id"}:
            raise ValueError("Unsupported generated scenario lookup")
        with self.db.connect() as connection:
            row = connection.execute(
                f"SELECT scenario_json, role_json FROM generated_scenarios WHERE {column} = ?",
                (value,),
            ).fetchone()
        if row is None:
            return None
        return json.loads(row["scenario_json"]), json.loads(row["role_json"])


content_repository = ContentRepository()
session_repository = SessionRepository()
review_repository = ReviewRepository()
hint_repository = HintRepository()
incident_repository = IncidentRepository()
generated_scenario_repository = GeneratedScenarioRepository()
