from __future__ import annotations

from uuid import uuid4

from fastapi import HTTPException

from .llm_service import llm_service
from .models import (
    CreateIncidentRequest,
    IncidentAnswerRequest,
    IncidentMessage,
    IncidentRecord,
    SceneDraft,
)
from .repository import IncidentRepository, incident_repository


REQUIRED_FIELDS = (
    "counterpart_identity",
    "relationship",
    "situation_summary",
    "counterpart_words_or_actions",
    "user_words_or_actions",
    "stuck_point",
    "desired_outcome",
)


class IncidentService:
    def __init__(self, llm=llm_service, incidents: IncidentRepository = incident_repository) -> None:
        self.llm = llm
        self.incidents = incidents

    def create(self, request: CreateIncidentRequest) -> IncidentRecord:
        description = request.description.strip()
        incident = IncidentRecord(
            incident_id=f"incident-{uuid4().hex[:12]}",
            status="clarifying",
            draft=SceneDraft(),
            messages=[IncidentMessage(speaker="user", kind="description", content=description)],
        )
        return self._analyze_and_save(incident)

    def get(self, incident_id: str) -> IncidentRecord:
        return self.incidents.get(incident_id)

    def answer(self, incident_id: str, request: IncidentAnswerRequest) -> IncidentRecord:
        incident = self.incidents.get(incident_id)
        if incident.status != "clarifying":
            raise HTTPException(status_code=409, detail="当前经历已经不需要继续补充信息")
        incident.messages.append(
            IncidentMessage(speaker="user", kind="answer", content=request.answer.strip())
        )
        return self._analyze_and_save(incident)

    def confirm(self, incident_id: str) -> IncidentRecord:
        incident = self.incidents.get(incident_id)
        if incident.status != "ready":
            raise HTTPException(status_code=409, detail="场景信息还没有整理完整，暂时不能确认")
        incident.status = "confirmed"
        incident.next_question = None
        return self.incidents.save(incident)

    def _analyze_and_save(self, incident: IncidentRecord) -> IncidentRecord:
        output = self.llm.analyze_incident(incident)
        incident.acknowledgement = output.acknowledgement
        incident.draft = self._merge_drafts(incident.draft, output.draft)
        incident.safety_message = output.safety_message

        if output.safety_concern:
            incident.status = "safety_redirect"
            incident.missing_fields = []
            incident.next_question = None
            if output.safety_message:
                incident.messages.append(
                    IncidentMessage(speaker="assistant", kind="safety", content=output.safety_message)
                )
            return self.incidents.save(incident)

        actual_missing = self._required_missing_fields(incident.draft)
        incident.missing_fields = actual_missing
        if not actual_missing:
            incident.status = "ready"
            incident.next_question = None
            return self.incidents.save(incident)

        if not output.next_question:
            raise HTTPException(status_code=502, detail="AI 发现信息不完整，但没有给出下一条补问")
        incident.status = "clarifying"
        incident.next_question = output.next_question
        incident.messages.append(
            IncidentMessage(speaker="assistant", kind="question", content=output.next_question)
        )
        return self.incidents.save(incident)

    @staticmethod
    def _required_missing_fields(draft: SceneDraft) -> list[str]:
        missing: list[str] = []
        for field_name in REQUIRED_FIELDS:
            value = getattr(draft, field_name)
            if value is None or value == "" or value == []:
                missing.append(field_name)
        return missing

    @staticmethod
    def _merge_drafts(previous: SceneDraft, updated: SceneDraft) -> SceneDraft:
        previous_data = previous.model_dump()
        updated_data = updated.model_dump()
        for field_name, value in updated_data.items():
            if value is None or value == "" or value == []:
                old_value = previous_data.get(field_name)
                if old_value is not None and old_value != "" and old_value != []:
                    updated_data[field_name] = old_value
        return SceneDraft.model_validate(updated_data)


incident_service = IncidentService()
