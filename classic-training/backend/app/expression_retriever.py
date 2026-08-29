from __future__ import annotations

import json
import re
from pathlib import Path

from .config import PROJECT_DIR


KNOWLEDGE_SCENES = (
    PROJECT_DIR / "zenmeban-dialogue-advisor" / "references" / "knowledge" / "scenes.json"
)


class ExpressionRetriever:
    """Small, dependency-free retrieval layer for phrasing references.

    Role-card examples receive priority. The larger scene pack supplies only
    short utterances and never supplies facts or instructions to the model.
    """

    def __init__(self, scenes_path: Path = KNOWLEDGE_SCENES) -> None:
        self.scenes_path = scenes_path
        self._scenes: list[dict] | None = None

    def retrieve(
        self,
        query: str,
        role: dict,
        previous_opponent_messages: list[str],
        allowed_move_ids: set[str] | None = None,
        top: int = 3,
    ) -> list[dict[str, str]]:
        candidates = self._role_candidates(role, allowed_move_ids) + self._scene_candidates(role)
        query_tokens = _tokens(query)
        ranked: list[tuple[float, str, str]] = []
        for source, text, boost in candidates:
            if not text or any(_near_duplicate(text, old) for old in previous_opponent_messages):
                continue
            candidate_tokens = _tokens(text)
            overlap = len(query_tokens & candidate_tokens) / max(1, len(query_tokens))
            ranked.append((boost + overlap, source, text))
        ranked.sort(key=lambda item: (-item[0], item[2]))
        return [
            {"source": source, "utterance": text}
            for _, source, text in ranked[: max(0, top)]
        ]

    @staticmethod
    def _role_candidates(
        role: dict,
        allowed_move_ids: set[str] | None,
    ) -> list[tuple[str, str, float]]:
        voice = role.get("voice", {})
        items = [("role_representative", line, 2.0) for line in voice.get("representative_lines", [])]
        for move in role.get("behavior_policy", {}).get("pressure_moves", []):
            if move.get("example") and (
                allowed_move_ids is None or move.get("move_id") in allowed_move_ids
            ):
                items.append((f"role_move:{move.get('move_id')}", move["example"], 2.5))
        return items

    def _scene_candidates(self, role: dict) -> list[tuple[str, str, float]]:
        scenes = self._load_scenes()
        relationship = json.dumps(role.get("relationship", {}), ensure_ascii=False)
        preferred_category = "workplace" if any(word in relationship for word in ("workplace", "职场", "上下级")) else None
        items: list[tuple[str, str, float]] = []
        for scene in scenes:
            if preferred_category and scene.get("category_id") != preferred_category:
                continue
            dialogue = scene.get("dialogue", [])
            for turn in dialogue:
                text = turn.get("text", "").strip()
                if 5 <= len(text) <= 80:
                    items.append((f"scene:{scene.get('id')}", text, 0.2))
        return items

    def _load_scenes(self) -> list[dict]:
        if self._scenes is None:
            try:
                self._scenes = json.loads(self.scenes_path.read_text(encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError):
                self._scenes = []
        return self._scenes

def _tokens(text: str) -> set[str]:
    compact = re.sub(r"\s+", "", text.lower())
    tokens = set(re.findall(r"[a-z0-9_-]{2,}", compact))
    for chunk in re.findall(r"[\u4e00-\u9fff]+", compact):
        tokens.update(chunk[index:index + 2] for index in range(max(0, len(chunk) - 1)))
    return tokens


def _near_duplicate(left: str, right: str) -> bool:
    left_tokens, right_tokens = _tokens(left), _tokens(right)
    if not left_tokens or not right_tokens:
        return False
    return len(left_tokens & right_tokens) / min(len(left_tokens), len(right_tokens)) >= 0.8


expression_retriever = ExpressionRetriever()
