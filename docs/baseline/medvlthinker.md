# MedVLThinker-7B / -32B-RL

<span class="pill pill--wip">Active — the cascade base models</span>

The current base models — the **cheap and strong legs** of the cascade.
MedVLThinker is a family of **RL-tuned reasoning VLMs** built on Qwen2.5-VL,
with explicit `<think>` / `<answer>` modes. The project uses the
`MedVLThinker-7B-RL_m23k` (cheap leg) and `MedVLThinker-32B-RL_m23k` (strong
leg) checkpoints. The same-family pairing is deliberate: a clean cheap/strong
cascade needs two models that share a tokenizer, prompt format, and answer
protocol so the only variable is capacity (and, for [ACC](../weekly/week-06/day-01.md),
reasoning *mode*).

!!! note "Why this model family"
    - **Reasoning VLM with a mode switch.** `<think>` (long chain-of-thought)
      vs no-think (direct answer) is a first-class control — which is exactly
      the lever [ACC](../weekly/week-06/index.md) exploits (no-think
      *over-thinks* perception VQA).
    - **Open, reproducible stack.** Open weights, a defined eval protocol, and
      published per-benchmark numbers that we reproduce within ~1 point.
    - **Same-family 7B + 32B.** Lets the cascade isolate capacity and mode from
      confounds in tokenization or formatting.
    - **Contamination-clean gate training.** The `m23k` RL training data is
      **text-only** (MedQA / MedMCQA / HeadQA), so PMC-VQA *train* is an
      uncontaminated split for fitting the frozen margin gate.

## Roles in the cascade

| Leg | Checkpoint | Mode(s) used | Role |
| --- | ---------- | ------------ | ---- |
| Cheap | `MedVLThinker-7B-RL_m23k` | no-think @ cap320 | Answers every question (Tier 0); its **confidence margin** is the escalation signal |
| Strong (fast) | `MedVLThinker-32B-RL_m23k` | no-think @ cap320 | The ACC intermediate workhorse (Tier 1); exposes logprobs for the agreement gate |
| Strong (slow) | `MedVLThinker-32B-RL_m23k` | think @ full-res | Slow reasoning, fired only on the residual (Tier 2) |

## Evaluation suite — `MedVLThinker-Eval`

**8,220 questions across six medical-VQA benchmarks.** Four are *competent*
(both models score well above chance and the cascade operates); two are
*excluded* from the headline because the models are weak there.

| Benchmark | n | 7B acc | 32B acc | In cascade scope? |
| --------- | --: | --: | --: | :--: |
| PMC-VQA | 2,000 | 0.539 | 0.556 | ✅ competent |
| SLAKE | 416 | 0.733 | 0.764 | ✅ competent |
| VQA-RAD | 272 | 0.761 | 0.776 | ✅ competent |
| PathVQA | 3,362 | 0.644 | 0.673 | ✅ competent |
| MMMU (medical) | 170 | 0.547 | — | ⚠️ excluded* |
| MedXpert-Reasoning | 1,446 | 0.225 | 0.326 | ❌ excluded (near chance) |
| MedXpert-Understanding | 554 | 0.256 | 0.384 | ❌ excluded (near chance) |

\* The MMMU exclusion is a known manuscript hole: the 7B scores **0.547** on it
(well above chance), which contradicts the "excluded because near-chance"
rationale — flagged in the [Week 5 audit](../weekly/week-05/day-05.md) for a
revised justification. MedXpert's exclusion (genuinely near-chance) is
defensible.

PMC-VQA *eval* derives from a curated `test_clean.csv` (2,000-question subset);
the raw `train.csv` is harder by ~7 pts, so the held-out gate-training protocol
splits/fits on the clean side. The gate is trained on **PMC-VQA train** with
all 2,000 eval samples held out.

## Infrastructure

| Component | Spec |
| --------- | ---- |
| GPUs | **dual NVIDIA A100 80GB** (7B on GPU 0, 32B on GPU 1 for the live cascade) |
| Inference engine | **vLLM 25.09** (NGC container) — ~35× faster than HuggingFace for batched eval |
| Measurement engine | **HuggingFace Transformers** — allocates VRAM on demand, so resident memory is the *true* footprint (vLLM pre-allocates its KV pool and hides it) |
| Power / energy | dual-GPU **NVML** sampling (25 ms), trapezoid-integrated per leg; latency/energy calibrated at **R² = 0.99** |
| Precision | bf16 |
| Repo | [`medvlthinker-imgdiff-compute`](https://github.com/Leokuan0208/medvlthinker-imgdiff-compute) |

!!! note "Two engines, on purpose"
    **vLLM** is used for fast batched labelling (it pre-allocates a KV-cache
    pool, so `nvidia-smi` shows the pool size, not the model footprint).
    **HuggingFace** is used wherever a true VRAM number matters, because it
    allocates on demand. Mixing the two engines in a single comparison table is
    a confound and is always labelled explicitly.

## Provenance

The harness reproduces the **published** MedVLThinker per-benchmark numbers to
within ~1 point (our 32B reproduction sits within ~1 pt of published across the
competent four), which is what licenses comparing cascade outputs against the
published baselines. The full think-vs-no-think harness validation (e.g. SLAKE
collapsing from a no-think +7.45 perception advantage back to Δ+0.08 vs paper
in think mode) is on [Week 5, Day 3](../weekly/week-05/day-03.md).

## What's built on these models

- The **7B→32B confidence-margin cascade** and the frozen gate
  `router_margin.pkl` ([Week 5](../weekly/week-05/index.md)).
- **[ACC](../weekly/week-06/day-01.md)** — the 3-tier (7B-nt → 32B-no-think →
  32B-think) cascade and the ACC-v2 agreement gate ([Week 6](../weekly/week-06/index.md)).
- The real-time, NVML-instrumented cascade harness (`rt_cascade.py` /
  `rt_analyze.py`) and the calibrated resolution×τ grid.
