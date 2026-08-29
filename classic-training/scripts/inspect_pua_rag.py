#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_DIR))

from backend.app.pua_corpus import load_pua_corpus  # noqa: E402
from backend.app.pua_modules import MODULES  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect annotated PUA corpus and module coverage")
    parser.add_argument("--entries", action="store_true", help="Include every annotated utterance")
    args = parser.parse_args()
    entries = load_pua_corpus()
    payload = {
        "summary": {
            "entry_count": len(entries),
            "source_counts": Counter(entry.source_file for entry in entries),
            "difficulty_counts": Counter(entry.difficulty_label for entry in entries),
            "scenario_type_counts": Counter(
                scenario_type for entry in entries for scenario_type in entry.scenario_types
            ),
            "tactic_counts": Counter(tag for entry in entries for tag in entry.tactic_tags),
        },
        "modules": [
            {
                **module,
                "matching_entry_count": sum(
                    bool(set(module["scenario_types"]) & set(entry.scenario_types))
                    for entry in entries
                ),
            }
            for module in MODULES
        ],
    }
    if args.entries:
        payload["entries"] = [entry.model_dump() for entry in entries]
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
