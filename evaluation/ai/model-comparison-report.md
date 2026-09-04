# FOSSBot Buddy model comparison — 2026-07-31

## Result status

The deterministic `fossbot-test` baseline passes all 14 automated transport/shape contracts. It is a development provider, not an educational model, so it has no human quality score and must never be used to claim model quality.

The three browser models and hosted cloud candidate are **not run** in this repository handoff. Their exact identifiers, required measurements, and execution checklist are preserved so a maintainer can run the comparison with explicit model-download consent and provider credentials. No latency, quality, cost, RAM/VRAM, or recommendation value has been fabricated.

| Candidate | Runtime | Run status | Result |
| --- | --- | --- | --- |
| `Llama-3.2-1B-Instruct-q4f16_1-MLC` | WebLLM/browser | Manual handoff | Not run |
| `Llama-3.2-3B-Instruct-q4f16_1-MLC` | WebLLM/browser | Manual handoff | Not run |
| `Qwen2.5-3B-Instruct-q4f16_1-MLC` | WebLLM/browser | Manual handoff | Not run |
| `gpt-5-mini-2025-08-07` | OpenAI/hosted | Manual handoff | Not run |
| `gemini-2.5-flash` | Gemini/hosted, optional cross-check | Manual handoff | Not run |
| `fossbot-test` | Hosted test-only | Automated | 14/14 structural contracts |

## Reproducibility

- Corpus: `evaluation/ai/corpus-v1.json`
- Dated model manifest: `evaluation/ai/models-2026-07-31.json`
- Human rubric: `evaluation/ai/rubric.md`
- Raw deterministic fixture: `evaluation/ai/results/mock-baseline-2026-07-31.json`
- Validator: `back-end/tools/ai_evaluation.py`
- Manual provider procedure: `docs/ai-assistant-manual-evaluation.md`

Validate and score the checked-in baseline:

```bash
python back-end/tools/ai_evaluation.py --corpus evaluation/ai/corpus-v1.json
python back-end/tools/ai_evaluation.py --corpus evaluation/ai/corpus-v1.json --results evaluation/ai/results/mock-baseline-2026-07-31.json
```

## Decision rule

There is no universal default before real measurements exist. A deployment recommendation must consider hard safety failures first, then correctness/pedagogy, hardware fit and responsiveness, privacy requirements, latency, and cost. Browser-only deployments should choose the smallest model that clears the quality floor on their minimum supported device. Hosted deployments should select an approved provider only after data-processing and cost review. User-local endpoints remain an advanced opt-in path, not an instance default.

## Limitations

The deterministic baseline verifies application contracts, not language-model intelligence. Browser model sizes come from the dated WebLLM configuration and still require empirical storage/RAM/VRAM measurement. Provider behavior, pricing, aliases, and availability can change; preserve dated identifiers and capture the provider response metadata with each run.
