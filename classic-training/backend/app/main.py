from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.concurrency import run_in_threadpool

from .config import settings
from .models import (
    AdvisorFeedback,
    CreateSessionRequest,
    CreateSessionResponse,
    CreateIncidentRequest,
    DialogueAdvisorRequest,
    CustomTrainingStartResponse,
    HintResponse,
    IncidentAnswerRequest,
    IncidentRecord,
    ReviewResponse,
    ScenarioSummary,
    TrainingSession,
    TranscriptionPurpose,
    TranscriptionResponse,
    TurnRequest,
    TurnResponse,
)
from .incident_service import incident_service
from .custom_training_service import custom_training_service
from .training_service import training_service
from .transcription_service import MAX_UPLOAD_BYTES, transcription_service

logger = logging.getLogger(__name__)


app = FastAPI(
    title="错不起我对了 · 经典训练 API",
    version="0.1.0",
    description="经典冲突场景的角色模拟与训练会话接口。",
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_id = uuid4().hex[:8]
    logger.exception(
        "未处理的后端错误 %s：%s %s",
        error_id,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"服务器内部错误（编号 {error_id}）。请把终端中相同编号的错误发给开发者。"
        },
    )


@app.get("/", include_in_schema=False)
def index() -> RedirectResponse:
    """The backend is API-only; the merged product UI lives in the team app."""
    return RedirectResponse(url=settings.team_ui_origin, status_code=307)


@app.get("/api/health", tags=["system"])
def health() -> dict:
    return {
        "status": "ok",
        "service": "classic-training",
        "version": "0.1.0",
        "llm_configured": settings.llm_enabled,
        "transcription_configured": settings.transcription_enabled,
        "storage": "sqlite",
    }


@app.post(
    "/api/transcriptions",
    response_model=TranscriptionResponse,
    tags=["speech"],
)
async def create_transcription(
    purpose: TranscriptionPurpose = Form(...),
    audio: UploadFile = File(...),
) -> TranscriptionResponse:
    if audio.content_type not in {"audio/wav", "audio/wave", "audio/x-wav"}:
        raise HTTPException(status_code=415, detail="只接受网页生成的 WAV 录音。")
    content = await audio.read(MAX_UPLOAD_BYTES + 1)
    await audio.close()
    return await run_in_threadpool(transcription_service.transcribe, content, purpose)


@app.get("/api/scenarios", response_model=list[ScenarioSummary], tags=["classic training"])
def list_scenarios() -> list[ScenarioSummary]:
    return [scenario for scenario in training_service.list_scenarios() if scenario.training_mode == "pua_response"]


@app.post(
    "/api/incidents",
    response_model=IncidentRecord,
    status_code=201,
    tags=["custom scenario"],
)
def create_incident(request: CreateIncidentRequest) -> IncidentRecord:
    return incident_service.create(request)


@app.get(
    "/api/incidents/{incident_id}",
    response_model=IncidentRecord,
    tags=["custom scenario"],
)
def get_incident(incident_id: str) -> IncidentRecord:
    return incident_service.get(incident_id)


@app.post(
    "/api/incidents/{incident_id}/answers",
    response_model=IncidentRecord,
    tags=["custom scenario"],
)
def answer_incident(incident_id: str, request: IncidentAnswerRequest) -> IncidentRecord:
    return incident_service.answer(incident_id, request)


@app.post(
    "/api/incidents/{incident_id}/confirm",
    response_model=IncidentRecord,
    tags=["custom scenario"],
)
def confirm_incident(incident_id: str) -> IncidentRecord:
    return incident_service.confirm(incident_id)


@app.post(
    "/api/incidents/{incident_id}/advisor",
    response_model=AdvisorFeedback,
    tags=["dialogue advisor"],
)
def analyze_incident_dialogue(incident_id: str, request: DialogueAdvisorRequest) -> AdvisorFeedback:
    return incident_service.analyze_dialogue(incident_id, request)


@app.post(
    "/api/incidents/{incident_id}/training",
    response_model=CustomTrainingStartResponse,
    status_code=201,
    tags=["custom scenario"],
)
def start_incident_training(
    incident_id: str,
    difficulty: int | None = None,
) -> CustomTrainingStartResponse:
    return custom_training_service.start(incident_id, difficulty)


@app.post(
    "/api/training/sessions",
    response_model=CreateSessionResponse,
    status_code=201,
    tags=["classic training"],
)
def create_session(request: CreateSessionRequest) -> CreateSessionResponse:
    return training_service.create_session(request)


@app.get(
    "/api/training/sessions/{session_id}",
    response_model=TrainingSession,
    tags=["classic training"],
)
def get_session(session_id: str) -> TrainingSession:
    return training_service.get_session(session_id)


@app.post(
    "/api/training/sessions/{session_id}/turns",
    response_model=TurnResponse,
    tags=["classic training"],
)
def add_turn(session_id: str, request: TurnRequest) -> TurnResponse:
    return training_service.add_turn(session_id, request)


@app.post(
    "/api/training/sessions/{session_id}/hint",
    response_model=HintResponse,
    tags=["classic training"],
)
def get_hint(session_id: str) -> HintResponse:
    return training_service.get_hint(session_id)


@app.post(
    "/api/training/sessions/{session_id}/finish",
    response_model=ReviewResponse,
    tags=["classic training"],
)
def finish_session(session_id: str) -> ReviewResponse:
    return training_service.finish_and_review(session_id)
