from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from utils.ai.evaluation import EvaluationError, load_json, score_results, validate_corpus  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate or score the FOSSBot Buddy evaluation corpus")
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--results", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        corpus = load_json(args.corpus)
        validate_corpus(corpus)
        report = {"version": corpus["version"], "cases": len(corpus["cases"]), "status": "valid"}
        if args.results:
            report = score_results(corpus, load_json(args.results))
    except (EvaluationError, OSError, json.JSONDecodeError) as error:
        print(f"evaluation error: {error}", file=sys.stderr)
        return 1
    rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
