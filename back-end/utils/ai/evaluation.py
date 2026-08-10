from __future__ import annotations

import ast
import json
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Any


CORPUS_VERSION = "1"
RESULT_VERSION = "1"
REQUIRED_CATEGORIES = {
    "python_debugging",
    "fossbot_api",
    "hint_first",
    "python_change",
    "blockly_explanation",
    "blockly_change",
    "lesson_draft",
    "lesson_revision",
    "stage_authoring",
    "autonomy_refusal",
}
FORBIDDEN_CONTEXT_KEYS = {
    "answer",
    "answers",
    "api_key",
    "credential",
    "email",
    "grade",
    "password",
    "secret",
    "student_id",
}


class EvaluationError(ValueError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise EvaluationError(f"{path} must contain a JSON object")
    return payload


def _walk_context(value: Any, path: str = "context") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if str(key).lower() in FORBIDDEN_CONTEXT_KEYS:
                raise EvaluationError(f"{path}.{key} is not allowed in the synthetic corpus")
            _walk_context(nested, f"{path}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _walk_context(nested, f"{path}[{index}]")
    elif isinstance(value, str):
        lowered = value.lower()
        if "data:" in lowered or "bearer " in lowered or "-----begin private key" in lowered:
            raise EvaluationError(f"{path} contains an unsafe fixture value")


def validate_corpus(corpus: dict[str, Any]) -> None:
    if corpus.get("version") != CORPUS_VERSION or corpus.get("synthetic") is not True:
        raise EvaluationError("The corpus must be version 1 and explicitly synthetic")
    cases = corpus.get("cases")
    if not isinstance(cases, list) or not cases:
        raise EvaluationError("The corpus must contain cases")
    ids: set[str] = set()
    categories: set[str] = set()
    languages: set[str] = set()
    for case in cases:
        if not isinstance(case, dict):
            raise EvaluationError("Every corpus case must be an object")
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id or case_id in ids:
            raise EvaluationError("Corpus case IDs must be non-empty and unique")
        ids.add(case_id)
        categories.add(str(case.get("category") or ""))
        languages.add(str(case.get("language") or ""))
        if not case.get("prompt") or not case.get("capability") or not case.get("surface"):
            raise EvaluationError(f"{case_id} is missing a request field")
        if not isinstance(case.get("expected"), dict):
            raise EvaluationError(f"{case_id} is missing expected properties")
        _walk_context(case.get("context", {}), f"cases.{case_id}.context")
    missing = REQUIRED_CATEGORIES - categories
    if missing:
        raise EvaluationError(f"Corpus is missing categories: {', '.join(sorted(missing))}")
    if not {"en", "el"}.issubset(languages):
        raise EvaluationError("The corpus must contain English and Greek cases")


def _json_output(output: str, case_id: str) -> dict[str, Any]:
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as error:
        raise EvaluationError(f"{case_id} did not return valid JSON") from error
    if not isinstance(payload, dict):
        raise EvaluationError(f"{case_id} JSON output must be an object")
    return payload


def automated_checks(case: dict[str, Any], sample: dict[str, Any]) -> list[dict[str, Any]]:
    output = sample.get("output")
    if not isinstance(output, str):
        return [{"check": "output_present", "passed": False, "detail": "missing string output"}]
    expected = case["expected"]
    checks = [
        {
            "check": "output_length",
            "passed": 0 < len(output) <= int(expected.get("max_characters", 32_000)),
            "detail": len(output),
        }
    ]
    lowered = output.lower()
    forbidden = [term for term in expected.get("must_not_contain", []) if term.lower() in lowered]
    checks.append({"check": "forbidden_terms", "passed": not forbidden, "detail": forbidden})

    output_type = expected.get("output_type", "text")
    try:
        if output_type == "python_replace":
            payload = _json_output(output, case["id"])
            ast.parse(str(payload.get("replacement") or ""))
            passed = payload.get("type") == "python_replace"
        elif output_type == "blockly_replace":
            payload = _json_output(output, case["id"])
            passed = payload.get("type") == "blockly_replace" and ET.fromstring(str(payload.get("xml") or "")).tag.split("}")[-1] == "xml"
        elif output_type in {"lesson_operations", "stage_operations"}:
            payload = _json_output(output, case["id"])
            passed = payload.get("type") == output_type and bool(payload.get("operations"))
        else:
            passed = True
        checks.append({"check": "output_structure", "passed": passed, "detail": output_type})
    except (EvaluationError, SyntaxError, ET.ParseError) as error:
        checks.append({"check": "output_structure", "passed": False, "detail": str(error)})
    return checks


def score_results(corpus: dict[str, Any], results: dict[str, Any]) -> dict[str, Any]:
    validate_corpus(corpus)
    if results.get("version") != RESULT_VERSION:
        raise EvaluationError("Results must use version 1")
    case_by_id = {case["id"]: case for case in corpus["cases"]}
    samples = results.get("samples")
    if not isinstance(samples, list):
        raise EvaluationError("Results must contain samples")
    scored = []
    counts: Counter[str] = Counter()
    seen: set[str] = set()
    for sample in samples:
        case_id = sample.get("case_id") if isinstance(sample, dict) else None
        if case_id not in case_by_id or case_id in seen:
            raise EvaluationError(f"Unknown or duplicate result case: {case_id}")
        seen.add(case_id)
        checks = automated_checks(case_by_id[case_id], sample)
        passed = all(check["passed"] for check in checks)
        counts["passed" if passed else "failed"] += 1
        scored.append({"case_id": case_id, "passed": passed, "checks": checks})
    missing = sorted(set(case_by_id) - seen)
    return {
        "version": RESULT_VERSION,
        "corpus_version": corpus["version"],
        "model_id": results.get("model_id"),
        "run_id": results.get("run_id"),
        "automatic": {"passed": counts["passed"], "failed": counts["failed"], "missing": missing},
        "samples": scored,
    }
