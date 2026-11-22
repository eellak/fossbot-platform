import json
from pathlib import Path

import pytest

from utils.ai.evaluation import EvaluationError, score_results, validate_corpus


ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "evaluation" / "ai" / "corpus-v1.json"
MOCK_RESULTS = ROOT / "evaluation" / "ai" / "results" / "mock-baseline-2026-07-31.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_versioned_corpus_is_synthetic_complete_and_bilingual():
    corpus = load(CORPUS)
    validate_corpus(corpus)
    assert len(corpus["cases"]) == 15
    assert {case["language"] for case in corpus["cases"]} == {"en", "el"}


def test_mock_baseline_covers_every_corpus_case():
    corpus = load(CORPUS)
    baseline = load(MOCK_RESULTS)
    assert {sample["case_id"] for sample in baseline["samples"]} == {case["id"] for case in corpus["cases"]}


def test_deterministic_baseline_passes_every_automatic_contract():
    report = score_results(load(CORPUS), load(MOCK_RESULTS))
    assert report["automatic"] == {"passed": 15, "failed": 0, "missing": []}


def test_python_edits_are_validated_against_the_case_source():
    corpus = load(CORPUS)
    baseline = load(MOCK_RESULTS)
    async_case = next(case for case in corpus["cases"] if case["id"] == "python-async-runtime-en-01")
    sample = next(item for item in baseline["samples"] if item["case_id"] == async_case["id"])
    payload = json.loads(sample["output"])
    payload["edits"] = [{"startLine": 40, "endLine": 40, "replacement": "search_step()"}]
    sample["output"] = json.dumps(payload)
    report = score_results(corpus, baseline)
    assert report["automatic"] == {"passed": 14, "failed": 1, "missing": []}
    assert report["samples"][1]["case_id"] == "python-async-runtime-en-01"


def test_python_edits_must_leave_a_parseable_program():
    corpus = load(CORPUS)
    baseline = load(MOCK_RESULTS)
    sample = next(item for item in baseline["samples"] if item["case_id"] == "python-async-runtime-en-01")
    payload = json.loads(sample["output"])
    payload["edits"] = [{"startLine": 7, "endLine": 7, "replacement": "if search_step(:"}]
    sample["output"] = json.dumps(payload)
    report = score_results(corpus, baseline)
    assert report["automatic"]["failed"] == 1


def test_an_unsupported_output_type_fails_instead_of_passing_silently():
    corpus = load(CORPUS)
    baseline = load(MOCK_RESULTS)
    async_case = next(case for case in corpus["cases"] if case["id"] == "python-async-runtime-en-01")
    async_case["expected"]["output_type"] = "python_edits_v2"
    sample = next(item for item in baseline["samples"] if item["case_id"] == async_case["id"])
    sample["output"] = "anything at all"
    report = score_results(corpus, baseline)
    assert report["automatic"]["failed"] == 1


def test_corpus_rejects_student_answers_and_credentials():
    corpus = load(CORPUS)
    corpus["cases"][0]["context"]["password"] = "not-allowed"
    with pytest.raises(EvaluationError, match="not allowed"):
        validate_corpus(corpus)
