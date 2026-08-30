from __future__ import annotations

import json
import re

from .pua_corpus import PUAUtterance, load_pua_corpus
from .pua_modules import get_pua_module


class PUARetriever:
    """Metadata-first retrieval for controlled PUA simulation.

    The module filter is mandatory and runs before lexical ranking. This keeps
    interview, overtime, accountability and family language in separate lanes.
    """

    def __init__(self) -> None:
        self._entries: list[PUAUtterance] | None = None

    def retrieve_controlled(
        self,
        module_id: str,
        difficulty: int,
        query: str,
        previous_opponent_messages: list[str],
        top: int = 3,
    ) -> list[dict]:
        module = get_pua_module(module_id)
        if not module:
            return []
        allowed_types = set(module["scenario_types"])
        target_group = module.get("target_group")
        candidates = [
            entry for entry in self._load()
            if allowed_types.intersection(entry.scenario_types)
            and (not target_group or entry.target_group == target_group)
            and entry.severity <= difficulty
        ]
        # A sparse module may not contain an easy example. Keep it runnable by
        # selecting the module's mildest source line, while the role card still
        # constrains delivery to the requested difficulty.
        if not candidates:
            module_entries = [
                entry for entry in self._load()
                if allowed_types.intersection(entry.scenario_types)
                and (not target_group or entry.target_group == target_group)
            ]
            if module_entries:
                minimum = min(entry.severity for entry in module_entries)
                candidates = [entry for entry in module_entries if entry.severity == minimum]

        query_tokens = _tokens(query)
        ranked: list[tuple[float, PUAUtterance]] = []
        for entry in candidates:
            if any(_near_duplicate(entry.text, old) for old in previous_opponent_messages):
                continue
            entry_tokens = _tokens(" ".join([
                entry.source_heading,
                entry.text,
                " ".join(entry.tactic_tags),
            ]))
            overlap = len(query_tokens & entry_tokens) / max(1, len(query_tokens))
            difficulty_fit = 0.35 if entry.severity == difficulty else 0.1
            ranked.append((overlap + difficulty_fit, entry))
        ranked.sort(key=lambda item: (-item[0], item[1].entry_id))
        return [self._controlled_result(entry, difficulty) for _, entry in ranked[: max(0, top)]]

    def retrieve_anti_examples(
        self,
        query: str,
        role: dict,
        top: int = 2,
    ) -> list[dict]:
        query_tokens = _tokens(query)
        if not query_tokens:
            return []
        relationship = json.dumps(role.get("relationship", {}), ensure_ascii=False)
        domain = _relationship_domain(relationship)
        ranked: list[tuple[float, PUAUtterance]] = []
        for entry in self._load():
            overlap = len(query_tokens & _tokens(entry.text))
            if overlap == 0:
                continue
            score = overlap / max(1, len(query_tokens))
            if domain == entry.domain:
                score += 0.2
            ranked.append((score, entry))
        ranked.sort(key=lambda item: (-item[0], item[1].entry_id))
        return [
            {
                **entry.model_dump(),
                "usage": "反例：普通沟通训练不得照抄、改写或升级这种压力手法。",
            }
            for _, entry in ranked[: max(0, top)]
        ]

    def all_entries(self) -> list[PUAUtterance]:
        return list(self._load())

    def _load(self) -> list[PUAUtterance]:
        if self._entries is None:
            self._entries = load_pua_corpus()
        return self._entries

    @staticmethod
    def _controlled_result(entry: PUAUtterance, difficulty: int) -> dict:
        delivery = {
            1: "容易：保留压力意图，但使用表面克制的试探说法；不得出现直接辱骂、解雇威胁或强烈歧视结论。",
            2: "中等：可以直接表达该压力观点，并在用户首次设边界后挑战一次。",
            3: "困难：可达到原始材料允许的最强措辞，包含本模块内的明确贬低、歧视或隐性威胁，但不得自行升级。",
        }[difficulty]
        return {
            **entry.model_dump(),
            "usage": "受控角色材料：可保持压力手法并自然改写，不得超出当前模块和难度。",
            "delivery_instruction": delivery,
        }


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


def _relationship_domain(relationship: str) -> str | None:
    if any(word in relationship for word in ("workplace", "职场", "上下级", "领导", "同事")):
        return "workplace"
    if any(word in relationship for word in ("family", "家庭", "父", "母", "亲戚")):
        return "family"
    return None


pua_retriever = PUARetriever()
