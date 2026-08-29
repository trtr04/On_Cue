from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
from uuid import uuid4

from fastapi import HTTPException

from .config import settings
from .models import TranscriptionPurpose, TranscriptionResponse


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Tencent's standard recording-file API accepts at most 5 MB of raw audio data.
# Keep chunks comfortably below that boundary (120 s of 16 kHz mono PCM is 3.84 MB).
STANDARD_CHUNK_SECONDS = 120
PURPOSE_LIMIT_SECONDS: dict[TranscriptionPurpose, int] = {
    "classic_turn": 90,
    "incident_narration": 180,
}


class TranscriptionService:
    """Transcribes browser WAV audio with Flash ASR and a Cloud API fallback."""

    @staticmethod
    def wav_duration_ms(audio: bytes) -> int:
        try:
            with wave.open(io.BytesIO(audio), "rb") as wav_file:
                if wav_file.getnchannels() != 1:
                    raise ValueError("audio must be mono")
                if wav_file.getsampwidth() != 2:
                    raise ValueError("audio must use 16-bit samples")
                if wav_file.getframerate() != 16000:
                    raise ValueError("audio must use a 16 kHz sample rate")
                frames = wav_file.getnframes()
                return round(frames / wav_file.getframerate() * 1000)
        except (wave.Error, EOFError, ValueError) as exc:
            raise HTTPException(
                status_code=422,
                detail="录音格式无效，请使用网页录音按钮重新录制。",
            ) from exc

    @staticmethod
    def _signed_request(audio: bytes, timestamp: int) -> urllib.request.Request:
        host = "asr.cloud.tencent.com"
        path = f"/asr/flash/v1/{settings.tencent_app_id}"
        params = {
            "convert_num_mode": 1,
            "engine_type": settings.tencent_asr_engine,
            "filter_dirty": 0,
            "filter_modal": 0,
            "filter_punc": 0,
            "first_channel_only": 1,
            "secretid": settings.tencent_secret_id,
            "speaker_diarization": 0,
            "timestamp": timestamp,
            "voice_format": "wav",
            "word_info": 0,
        }
        query = urllib.parse.urlencode(sorted(params.items()))
        signature_source = f"POST{host}{path}?{query}".encode("utf-8")
        digest = hmac.new(
            settings.tencent_secret_key.encode("utf-8"),
            signature_source,
            hashlib.sha1,
        ).digest()
        signature = base64.b64encode(digest).decode("ascii")
        return urllib.request.Request(
            f"https://{host}{path}?{query}",
            data=audio,
            headers={
                "Authorization": signature,
                "Content-Type": "application/octet-stream",
            },
            method="POST",
        )

    @staticmethod
    def _cloud_api_request(action: str, request_payload: dict) -> dict:
        """Call Tencent Cloud API 3.0 with TC3-HMAC-SHA256 signing."""
        host = "asr.tencentcloudapi.com"
        service = "asr"
        version = "2019-06-14"
        timestamp = int(time.time())
        date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
        body = json.dumps(request_payload, ensure_ascii=False, separators=(",", ":"))
        content_type = "application/json; charset=utf-8"

        canonical_headers = f"content-type:{content_type}\nhost:{host}\n"
        signed_headers = "content-type;host"
        canonical_request = "\n".join(
            (
                "POST",
                "/",
                "",
                canonical_headers,
                signed_headers,
                hashlib.sha256(body.encode("utf-8")).hexdigest(),
            )
        )
        credential_scope = f"{date}/{service}/tc3_request"
        string_to_sign = "\n".join(
            (
                "TC3-HMAC-SHA256",
                str(timestamp),
                credential_scope,
                hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
            )
        )

        def sign(key: bytes, message: str) -> bytes:
            return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

        secret_date = sign(("TC3" + settings.tencent_secret_key).encode("utf-8"), date)
        secret_service = sign(secret_date, service)
        secret_signing = sign(secret_service, "tc3_request")
        signature = hmac.new(
            secret_signing,
            string_to_sign.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        authorization = (
            "TC3-HMAC-SHA256 "
            f"Credential={settings.tencent_secret_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        request = urllib.request.Request(
            f"https://{host}/",
            data=body.encode("utf-8"),
            headers={
                "Authorization": authorization,
                "Content-Type": content_type,
                "Host": host,
                "X-TC-Action": action,
                "X-TC-Region": "ap-shanghai",
                "X-TC-Timestamp": str(timestamp),
                "X-TC-Version": version,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(
                request,
                timeout=settings.tencent_asr_timeout_seconds,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:180]
            raise HTTPException(
                status_code=502,
                detail=f"腾讯云录音识别接口返回 HTTP {exc.code}。{detail}",
            ) from exc
        except (urllib.error.URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="腾讯云录音识别请求失败，请稍后重试。") from exc

        response_payload = payload.get("Response", {})
        error = response_payload.get("Error")
        if error:
            message = error.get("Message") or error.get("Code") or "未知错误"
            raise HTTPException(status_code=502, detail=f"腾讯云录音识别失败：{message}")
        return response_payload

    @staticmethod
    def _split_wav(audio: bytes) -> list[bytes]:
        with wave.open(io.BytesIO(audio), "rb") as source:
            parameters = source.getparams()
            frames_per_chunk = parameters.framerate * STANDARD_CHUNK_SECONDS
            chunks: list[bytes] = []
            while True:
                frames = source.readframes(frames_per_chunk)
                if not frames:
                    break
                output = io.BytesIO()
                with wave.open(output, "wb") as target:
                    target.setparams(parameters)
                    target.writeframes(frames)
                chunks.append(output.getvalue())
            return chunks

    def _transcribe_standard(self, audio: bytes) -> tuple[str, str | None]:
        task_ids: list[int] = []
        for chunk in self._split_wav(audio):
            response = self._cloud_api_request(
                "CreateRecTask",
                {
                    "EngineModelType": settings.tencent_asr_engine,
                    "ChannelNum": 1,
                    "ResTextFormat": 0,
                    "SourceType": 1,
                    "Data": base64.b64encode(chunk).decode("ascii"),
                    "DataLen": len(chunk),
                    "ConvertNumMode": 1,
                },
            )
            task_id = response.get("Data", {}).get("TaskId")
            if task_id is None:
                raise HTTPException(status_code=502, detail="腾讯云未返回录音识别任务 ID。")
            task_ids.append(int(task_id))

        deadline = time.monotonic() + settings.tencent_asr_poll_timeout_seconds
        pending = set(task_ids)
        results: dict[int, str] = {}
        request_id: str | None = None
        while pending and time.monotonic() < deadline:
            for task_id in list(pending):
                response = self._cloud_api_request("DescribeTaskStatus", {"TaskId": task_id})
                request_id = request_id or response.get("RequestId")
                data = response.get("Data", {})
                status = data.get("Status")
                if status == 2:
                    results[task_id] = str(data.get("Result", "")).strip()
                    pending.remove(task_id)
                elif status == 3:
                    message = data.get("ErrorMsg") or "识别任务失败"
                    raise HTTPException(status_code=502, detail=f"腾讯云录音识别失败：{message}")
            if pending:
                time.sleep(0.6)

        if pending:
            raise HTTPException(status_code=504, detail="录音识别仍在处理，请稍后重试。")
        text = "\n".join(results[task_id] for task_id in task_ids if results[task_id]).strip()
        return text, request_id

    def _transcribe_flash(self, audio: bytes) -> tuple[str, str | None, str]:
        request = self._signed_request(audio, int(time.time()))
        try:
            with urllib.request.urlopen(
                request,
                timeout=settings.tencent_asr_timeout_seconds,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                # Some newer Tencent APPIDs are not routed by the legacy Flash gateway.
                # The Cloud API 3.0 recording-file endpoint uses the same credentials.
                text, request_id = self._transcribe_standard(audio)
                return text, request_id, "tencent_recording"
            detail = exc.read().decode("utf-8", errors="replace")[:180]
            raise HTTPException(
                status_code=502,
                detail=f"腾讯云语音识别返回 HTTP {exc.code}。{detail}",
            ) from exc
        except (urllib.error.URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="语音识别请求失败，请稍后重试。") from exc

        if payload.get("code") != 0:
            message = payload.get("message") or "腾讯云未能识别这段录音。"
            raise HTTPException(status_code=502, detail=f"语音识别失败：{message}")
        result_texts = [
            str(result.get("text", "")).strip()
            for result in payload.get("flash_result", [])
            if isinstance(result, dict)
        ]
        return (
            "\n".join(value for value in result_texts if value).strip(),
            payload.get("request_id"),
            "tencent_flash",
        )

    def transcribe(self, audio: bytes, purpose: TranscriptionPurpose) -> TranscriptionResponse:
        if not settings.transcription_enabled:
            raise HTTPException(
                status_code=503,
                detail="腾讯云语音识别尚未配置，请设置 TENCENT_APP_ID、TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY。",
            )
        if not (
            settings.tencent_app_id.isdigit()
            and len(settings.tencent_app_id) == 10
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "TENCENT_APP_ID 格式不正确。请填写腾讯云“账号信息”页面中的 10 位 APPID"
                    "（例如 1250000000），不要填写 12 位账号 ID/UIN。"
                ),
            )
        if not audio:
            raise HTTPException(status_code=422, detail="没有收到录音内容。")
        if len(audio) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="录音文件过大，请缩短后重新录制。")

        duration_ms = self.wav_duration_ms(audio)
        limit_seconds = PURPOSE_LIMIT_SECONDS[purpose]
        if duration_ms < 300:
            raise HTTPException(status_code=422, detail="录音太短，请说完后再停止录音。")
        if duration_ms > limit_seconds * 1000 + 250:
            raise HTTPException(
                status_code=422,
                detail=f"本次录音超过 {limit_seconds} 秒限制，请缩短后重新录制。",
            )

        text, provider_request_id, provider = self._transcribe_flash(audio)
        if not text:
            raise HTTPException(status_code=422, detail="没有识别到清晰语音，请靠近麦克风后重试。")

        return TranscriptionResponse(
            transcription_id=f"transcription-{uuid4().hex[:12]}",
            text=text,
            purpose=purpose,
            duration_ms=duration_ms,
            provider=provider,
            provider_request_id=provider_request_id,
        )


transcription_service = TranscriptionService()
