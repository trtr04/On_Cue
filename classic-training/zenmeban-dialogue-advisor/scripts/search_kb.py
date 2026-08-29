#!/usr/bin/env python3
"""Dependency-free lexical search over the packaged dialogue knowledge base."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / "references" / "knowledge"


def tokens(text: str) -> set[str]:
    compact = re.sub(r"\s+", "", text.lower())
    chinese = re.findall(r"[\u4e00-\u9fff]+", compact)
    words = set(re.findall(r"[a-z0-9_-]{2,}", compact))
    for chunk in chinese:
        words.add(chunk)
        words.update(chunk[i:i + 2] for i in range(max(0, len(chunk) - 1)))
    return words


def scene_text(scene: dict) -> str:
    parts = [scene.get("title", ""), scene.get("scene_category", ""), scene.get("history_summary", ""), scene.get("turning_point", "")]
    parts.extend(scene.get("tags", []))
    parts.extend(scene.get("search_aliases", []))
    parts.extend(scene.get("possible_interpretations", []))
    parts.extend(turn.get("text", "") for turn in scene.get("dialogue", []))
    return " ".join(parts)


def search(query: str, top: int = 5) -> list[dict]:
    scenes = json.loads((KNOWLEDGE / "scenes.json").read_text(encoding="utf-8"))
    query_tokens = tokens(query)
    compact_query = re.sub(r"\s+", "", query.lower())
    ranked: list[tuple[float, str, dict]] = []
    for scene in scenes:
        text = scene_text(scene)
        text_tokens = tokens(text)
        overlap = len(query_tokens & text_tokens)
        score = overlap / max(1, len(query_tokens))
        if compact_query and compact_query in re.sub(r"\s+", "", text.lower()):
            score += 1.0
        if any(alias and alias in query for alias in scene.get("search_aliases", [])):
            score += 0.5
        if score <= 0:
            continue
        result = {
        "result_type": "knowledge_scene", "id": scene["id"], "title": scene["title"], "category": scene["category_id"],
        "risk_level": scene["risk_level"], "score": round(score, 4),
        "scene_read": scene.get("scene_read", {}),
        "pattern_refs": scene.get("pattern_refs", []), "strategy_refs": scene.get("strategy_refs", []),
        }
        ranked.append((score, scene["id"], result))

    ambiguity_path = ROOT / "references" / "evaluation" / "ambiguity-evaluation.json"
    if ambiguity_path.is_file():
        for case in json.loads(ambiguity_path.read_text(encoding="utf-8")):
            expected = case.get("expected_analysis", {})
            dialogue_text = " ".join(turn.get("text", "") for turn in case.get("transcript", []))
            text = " ".join([
                case.get("context", ""), case.get("ambiguity_type", ""),
                dialogue_text,
                expected.get("primary_interpretation", {}).get("statement", ""),
                expected.get("verification_move", ""),
            ])
            overlap = len(query_tokens & tokens(text))
            dialogue_overlap = len(query_tokens & tokens(dialogue_text))
            score = overlap / max(1, len(query_tokens)) + min(0.6, dialogue_overlap * 0.2)
            if score <= 0:
                continue
            result = {
                "result_type": "ambiguity_case", "id": case["id"], "title": case["context"],
                "ambiguity_type": case["ambiguity_type"], "score": round(score, 4),
                "expected_analysis": expected,
            }
            ranked.append((score, case["id"], result))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [result for _, _, result in ranked[:top]]


def main() -> None:
    parser = argparse.ArgumentParser(description="Search packaged Chinese dialogue scenes")
    parser.add_argument("query")
    parser.add_argument("--top", type=int, default=5)
    args = parser.parse_args()
    print(json.dumps(search(args.query, max(1, min(args.top, 20))), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
