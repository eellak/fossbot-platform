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
    assert len(corpus["cases"]) == 14
    assert {case["language"] for case in corpus["cases"]} == {"en", "el"}


def test_deterministic_baseline_passes_every_automatic_contract():
    report = score_results(load(CORPUS), load(MOCK_RESULTS))
    assert report["automatic"] == {"passed": 14, "failed": 0, "missing": []}


def test_corpus_rejects_student_answers_and_credentials():
    corpus = load(CORPUS)
    corpus["cases"][0]["context"]["password"] = "not-allowed"
    with pytest.raises(EvaluationError, match="not allowed"):
        validate_corpus(corpus)
