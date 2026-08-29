#!/usr/bin/env python3
"""Validate the portable Codex skill without third-party dependencies."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "SKILL.md", "INSTALL-macOS.md", "references/core/system-prompt.md",
    "references/core/voice-profiles.json", "references/core/voice-router.json",
    "references/core/AMBIGUITY-ANALYSIS-SPEC.md",
    "references/knowledge/scenes.json", "references/knowledge/patterns.json",
    "references/knowledge/strategies.json", "references/knowledge/retrieval-aliases.json",
    "references/schemas/analysis-input.schema.json", "references/schemas/analysis-output.schema.json",
    "references/evaluation/ambiguity-evaluation.json",
    "references/evaluation/AMBIGUOUS-CONVERSATION-20-CASE-REPORT.md",
]
AMBIGUITY_FIELDS = {
    "ambiguity_level", "observable_facts", "primary_interpretation",
    "alternative_interpretations", "missing_information", "verification_move", "update_rule",
}


def load(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def main() -> int:
    failures = [f"missing {name}" for name in REQUIRED if not (ROOT / name).is_file()]
    if failures:
        print(json.dumps({"passed": False, "failures": failures}, ensure_ascii=False, indent=2))
        return 1

    scenes = load("references/knowledge/scenes.json")
    profiles = load("references/core/voice-profiles.json")
    ambiguity_cases = load("references/evaluation/ambiguity-evaluation.json")
    schema = load("references/schemas/analysis-output.schema.json")
    if len(scenes) != 120:
        failures.append(f"scene count is {len(scenes)}, expected 120")
    if {row.get("voice_id") for row in profiles} != {"A", "B", "C"}:
        failures.append("voice profiles are not exactly A/B/C")
    if len(ambiguity_cases) != 20:
        failures.append(f"ambiguity cases are {len(ambiguity_cases)}, expected 20")
    if sum(set(row.get("voices", {})) == {"A", "B", "C"} for row in ambiguity_cases) != 20:
        failures.append("ambiguity public cases do not all contain A/B/C")
    ambiguity_schema = schema.get("properties", {}).get("ambiguity_analysis", {})
    if "ambiguity_analysis" not in schema.get("required", []):
        failures.append("analysis output does not require ambiguity_analysis")
    if set(ambiguity_schema.get("required", [])) != AMBIGUITY_FIELDS:
        failures.append("ambiguity schema is incomplete")
    public_report = (ROOT / "references/evaluation/AMBIGUOUS-CONVERSATION-20-CASE-REPORT.md").read_text(encoding="utf-8")
    for marker in ["### 六步分析", "首选解释（", "**备选解释**", "**更新规则**", "medium"]:
        if marker in public_report:
            failures.append(f"internal analysis marker leaked into public report: {marker}")
    for voice_id in "ABC":
        if public_report.count(f"### {voice_id}\n") != 20:
            failures.append(f"public report does not contain 20 {voice_id} responses")

    sensitive_patterns = [r"/Users/", r"tudousi", r"\.codex/attachments", r"sk-[A-Za-z0-9_-]{16,}"]
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() in {".zip", ".pyc"}:
            continue
        if path == Path(__file__).resolve():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for pattern in sensitive_patterns:
            if re.search(pattern, text):
                failures.append(f"sensitive local value in {path.relative_to(ROOT)}: {pattern}")

    search = subprocess.run(
        [sys.executable, str(ROOT / "scripts/search_kb.py"), "领导不明确说谁负责还让我先做", "--top", "3"],
        text=True, capture_output=True,
    )
    if search.returncode != 0:
        failures.append("search helper failed")
    else:
        try:
            if not json.loads(search.stdout):
                failures.append("search helper returned no results")
        except json.JSONDecodeError:
            failures.append("search helper returned invalid JSON")

    result = {
        "passed": not failures,
        "scenes": len(scenes), "voices": len(profiles), "ambiguity_cases": len(ambiguity_cases),
        "ambiguity_fields": len(AMBIGUITY_FIELDS), "public_voice_cases": 20, "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"package-validation: {'PASS' if not failures else 'FAIL'}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
