# Baseline

The project has used two base models during its lifetime. Each gets
its own page documenting the exact environment, Dockerfile, and
verification steps used to reproduce that baseline.

## [Qwen2.5-VL-7B-Instruct](qwen25-vl.md)

<span class="pill pill--wip">Active baseline — May 24, 2026 onward</span>

The current baseline. A standard HuggingFace transformers model
(no custom fork, no delta-weight merge), instruction-tuned with
MCQ-format data, compatible with VLMEvalKit / lmms-eval — the
field's standardized evaluation backbone. Adopted on May 21 after
the LLaVA-Med v1.0 → Qwen2.5-VL pivot; smoke test validated on
May 24 with 20/20 strict MCQ-letter compliance.

**Stack:** NGC PyTorch 25.06 (Python 3.12, CUDA 12.9, PyTorch 2.8)
· transformers 4.49 · flash-attn 2.7.4 · 8.29 B parameters · bf16.

→ [Full setup, Dockerfile, and verification](qwen25-vl.md)

## [LLaVA-Med v1.5 / v1.0](llava-med.md)

<span class="pill pill--done">Frozen — May 24, 2026</span>

The original baseline (May 10–May 21, 2026). Microsoft's
biomedical-instruction-tuned VLM, built on Mistral-7B (v1.5) or
LLaMA-7B (v1.0). Frozen as the active baseline after two
unreproducibility issues surfaced: a substring-match bug in the
v1.0 closed-set scorer that inflated reported accuracy by 9-12
points, and 0/11 MCQ-letter compliance on an instruction-following
smoke test that blocked use of standardized evaluation harnesses.

**Stack:** NGC PyTorch 23.10 (Python 3.10, CUDA 12.2, PyTorch 2.1)
· transformers 4.36.2 · flash-attn 2.3.6 (built from source) · 7 B
parameters · bf16.

→ [Full setup, Dockerfile, and verification](llava-med.md)

---

The pivot writeup is on
[Week 2, Day 5](../weekly/week-02/day-05.md); the validation
writeup is on
[Week 3, Day 1](../weekly/week-03/day-01.md).
