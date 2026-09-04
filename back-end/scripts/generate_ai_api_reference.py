import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from utils.ai.fossbot_api import assert_reference_matches_worker, render_reference


WORKER = BACKEND.parent / "front-end" / "src" / "workers" / "pyodideWorker.ts"
OUTPUT = BACKEND / "utils" / "ai" / "fossbot_api_reference.json"


if __name__ == "__main__":
    assert_reference_matches_worker(WORKER)
    OUTPUT.write_text(render_reference(), encoding="utf-8")
    print(OUTPUT)
