# Baselines & Models

The project has run on several base models across its lifetime. The **current**
base models are the **MedVLThinker** 7B/32B pair that the cascade is built on;
the three earlier models belong to the **visual-token-pruning era** and are
preserved here as research history. Each page documents the exact environment,
versions, and verification steps used to reproduce that baseline.

---

## Current — the cascade models

### [MedVLThinker-7B / -32B-RL](medvlthinker.md)

<span class="pill pill--wip">Active — the cascade base models</span>

The cheap and strong legs of the cascade. MedVLThinker is a family of
**RL-tuned reasoning VLMs** built on Qwen2.5-VL, with explicit
`<think>` / `<answer>` modes, evaluated on a 6-benchmark, 8,220-question
medical-VQA suite. The 7B is the cheap leg; the 32B (in both no-think and think
modes) is the strong leg. Published baselines reproduce within ~1 point.

**Stack:** dual A100 80GB · **vLLM 25.09** (NGC container, ~35× over HF for
inference) · Hugging Face Transformers (for VRAM-accurate measurement) · bf16.

→ [Full model details, eval suite, and infrastructure](medvlthinker.md)

---

## Legacy — the visual-token-pruning era

These three models were the baselines while the project targeted question-aware
visual token pruning (Weeks 1–3). They are **superseded** but kept for the
record; the pivot writeups are on
[Week 2, Day 5](../weekly/week-02/day-05.md) (LLaVA-Med → Qwen2.5-VL),
[Week 3, Day 1](../weekly/week-03/day-01.md) (Qwen2.5-VL validated), and
[Week 3, Day 2](../weekly/week-03/day-02.md) (Qwen2.5-VL → HuatuoGPT).

### [HuatuoGPT-Vision-7B](huatuo-vision.md)

<span class="pill pill--done">Legacy — final pruning-era baseline (May 25, 2026)</span>

The reproducibility-first pruning baseline. A medical-instruction-tuned VLM on
the LLaVA-v1.5 architecture with a Qwen2-7B backbone (Chen et al. 2024,
[arXiv:2406.19280](https://arxiv.org/abs/2406.19280)). **Paper Table 4
reproduced end-to-end on May 25**, 5/6 benchmarks within 0.55 pts (VQA-RAD
61.35, SLAKE 76.44, PathVQA 57.67, PMC-VQA 54.20, OmniMedVQA 73.46, MMMU H&M
50.34). It was on this model that the pruning sweeps were run — and that random
selection Pareto-dominated every structured method, closing pruning as a
method.

**Stack:** NGC PyTorch 23.10 · transformers 4.41.2 · flash-attn 2.5.8 · 7B · bf16.

→ [Full setup, Dockerfile, and verification](huatuo-vision.md)

### [Qwen2.5-VL-7B-Instruct](qwen25-vl.md)

<span class="pill pill--done">Legacy — frozen May 25, 2026</span>

The active baseline for a single day (May 24–25). Passed a 20/20 strict
MCQ-letter compliance smoke test, validating the LLaVA-Med → Qwen2.5-VL pivot —
but an eval-harness coverage gap (VLMEvalKit / lmms-eval don't cover the three
target datasets) made the reproducibility story weaker than HuatuoGPT's, so the
project moved on. The smoke-test artifact is preserved on the frozen
[Qwen-v25-vl-med-pruning](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)
repo.

**Stack:** NGC PyTorch 25.06 · transformers 4.49 · flash-attn 2.7.4 · 8.29B · bf16.

→ [Full setup, Dockerfile, and verification](qwen25-vl.md)

### [LLaVA-Med v1.5 / v1.0](llava-med.md)

<span class="pill pill--done">Legacy — frozen May 24, 2026</span>

The **original** baseline (May 10–21). Microsoft's biomedical-instruction-tuned
VLM on Mistral-7B (v1.5) / LLaMA-7B (v1.0). Frozen after two unreproducibility
issues: a substring-match bug in the v1.0 closed-set scorer that inflated
accuracy by 9–12 points, and 0/11 MCQ-letter compliance that blocked use of
standardized eval harnesses. The LLaVA-Med-era environment is documented on the
[Environment setup (legacy)](../setup.md) page.

**Stack:** NGC PyTorch 23.10 · transformers 4.36.2 · flash-attn 2.3.6 (source) · 7B · bf16.

→ [Full setup, Dockerfile, and verification](llava-med.md)
