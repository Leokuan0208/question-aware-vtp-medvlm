# Baseline

The project has used three base models during its lifetime. Each gets
its own page documenting the exact environment, Dockerfile, and
verification steps used to reproduce that baseline.

## [HuatuoGPT-Vision-7B](huatuo-vision.md)

<span class="pill pill--done">Active baseline — reproduction validated May 25, 2026</span>

The current baseline. Medical-instruction-tuned VLM built on the
LLaVA-v1.5 architecture with Qwen2-7B as the LLM backbone (Chen et
al. 2024, [arXiv:2406.19280](https://arxiv.org/abs/2406.19280)).
Chosen for reproducibility-first reasons: the authors publish merged
weights, bundled evaluation data, a one-command eval pipeline, and a
Table of headline numbers across six benchmarks. **Paper Table 4
reproduced end-to-end on May 25 with 5 of 6 benchmarks within
0.55 pts of paper** (VQA-RAD 61.35, SLAKE 76.44, PathVQA 57.67,
PMC-VQA 54.20, OmniMedVQA 73.46, MMMU H&M 50.34). The pipeline is
verified end-to-end; every accuracy number produced with pruning
hooks attached is directly comparable to these six.

**Stack:** NGC PyTorch 23.10 (Python 3.10, CUDA 12.2, PyTorch 2.1)
· transformers 4.41.2 · flash-attn 2.5.8 · 7 B parameters · bf16.

→ [Full setup, Dockerfile, and verification](huatuo-vision.md)

## [Qwen2.5-VL-7B-Instruct](qwen25-vl.md)

<span class="pill pill--done">Frozen — May 25, 2026</span>

The active baseline for one day (May 24–25). Passed 20/20 strict
MCQ-letter compliance smoke test, validating the LLaVA-Med v1.0 →
Qwen2.5-VL pivot — but a literature survey on May 25 revealed that
VLMEvalKit / lmms-eval don't cover the three target datasets, so
the reproducibility story was weaker than expected. The project
pivoted to HuatuoGPT-Vision-7B (above) for a paper-reproducible
target. The Qwen2.5-VL smoke-test result is preserved as the
canonical artifact on the frozen
[Qwen-v25-vl-med-pruning](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)
repository.

**Stack:** NGC PyTorch 25.06 (Python 3.12, CUDA 12.9, PyTorch 2.8)
· transformers 4.49 · flash-attn 2.7.4 · 8.29 B parameters · bf16.

→ [Full setup, Dockerfile, and verification](qwen25-vl.md)

## [LLaVA-Med v1.5 / v1.0](llava-med.md)

<span class="pill pill--done">Frozen — May 24, 2026</span>

The original baseline (May 10–May 21, 2026). Microsoft's
biomedical-instruction-tuned VLM, built on Mistral-7B (v1.5) or
LLaMA-7B (v1.0). Frozen after two unreproducibility issues
surfaced: a substring-match bug in the v1.0 closed-set scorer that
inflated reported accuracy by 9-12 points, and 0/11 MCQ-letter
compliance on an instruction-following smoke test that blocked use
of standardized evaluation harnesses.

**Stack:** NGC PyTorch 23.10 (Python 3.10, CUDA 12.2, PyTorch 2.1)
· transformers 4.36.2 · flash-attn 2.3.6 (built from source) · 7 B
parameters · bf16.

→ [Full setup, Dockerfile, and verification](llava-med.md)

---

The pivot writeups are on
[Week 2, Day 5](../weekly/week-02/day-05.md) (LLaVA-Med → Qwen2.5-VL),
[Week 3, Day 1](../weekly/week-03/day-01.md) (Qwen2.5-VL pivot
validated), and
[Week 3, Day 2](../weekly/week-03/day-02.md) (Qwen2.5-VL → HuatuoGPT).
