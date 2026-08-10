from pathlib import Path

import pytest

from utils.ai.fossbot_api import assert_reference_matches_worker, reference_payload, render_reference


def test_generated_reference_matches_worker_and_artifact():
    backend = Path(__file__).resolve().parents[1]
    worker = backend.parent / "front-end" / "src" / "workers" / "pyodideWorker.ts"
    artifact = backend / "utils" / "ai" / "fossbot_api_reference.json"
    assert artifact.read_text(encoding="utf-8") == render_reference()
    assert len(reference_payload()["commands"]) == 19
    if not worker.exists():
        pytest.skip("front-end sources are not included in the backend-only image")
    assert_reference_matches_worker(worker)


def test_reference_contains_signatures_constraints_and_examples():
    for command in reference_payload()["commands"]:
        assert command["name"] in command["signature"]
        assert isinstance(command["constraints"], list)
        assert command["description"]
        assert command["example"]
