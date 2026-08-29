#!/usr/bin/env python3
"""Write a deterministic package manifest and SHA-256 list."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDE = {"PACKAGE-MANIFEST.json", "SHA256SUMS.txt"}


def main() -> None:
    rows = []
    for path in sorted(p for p in ROOT.rglob("*") if p.is_file() and p.name not in EXCLUDE and "__pycache__" not in p.parts):
        content = path.read_bytes()
        rows.append({"path": str(path.relative_to(ROOT)), "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    manifest = {
        "package": "zenmeban-dialogue-advisor", "version": "0.2.7", "platform": "macOS Codex",
        "build_date": "2026-08-27", "files": len(rows), "contents": rows,
        "validation": {"full_kb_scripts": 17, "scenes": 120, "ambiguity_cases": 20, "voices": 3},
        "privacy": "No real recordings, private transcripts, API keys, attachment paths, or builder user paths.",
    }
    (ROOT / "PACKAGE-MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sums = "\n".join(f"{row['sha256']}  {row['path']}" for row in rows) + "\n"
    (ROOT / "SHA256SUMS.txt").write_text(sums, encoding="utf-8")


if __name__ == "__main__":
    main()
