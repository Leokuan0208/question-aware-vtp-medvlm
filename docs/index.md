# Model Cascades for Medical VLMs

A research notebook tracking the design, implementation, and evaluation of a
**training-free model cascade** for compute-efficient medical
vision–language models (VLMs).

**The core idea.** Large reasoning VLMs answer medical visual questions
accurately but expensively; small VLMs are cheap but weaker. A **cascade**
runs the cheap model first and escalates only the questions it can't handle to
the large model — so most queries are answered cheaply and the expensive model
is reserved for the residual. The goal is to **match a 32B model's accuracy at
a fraction of its compute**, with honest, measured (prefill-inclusive)
accounting — and *without training* any new component.

!!! note "About this site"
    This project began (May 2026) as *"Question-Aware Visual Token Pruning for
    Medical VLMs"* and arrived at model cascading through a documented series
    of pivots — see [The research journey](#the-research-journey) below. The
    older directions are preserved as history; pages get updated as the work
    evolves, with "last updated" timestamps at the bottom of each page.

---

## Project at a glance

|                  |                                                              |
| ---------------- | ------------------------------------------------------------ |
| **Duration**     | 12 weeks                                                     |
| **Start date**   | May 10, 2026                                                 |
| **Direction**    | Training-free 7B→32B compute cascade for medical VQA         |
| **Base models**  | [MedVLThinker-7B / -32B-RL](baseline/medvlthinker.md) (Qwen2.5-VL, RL-tuned reasoning) |
| **Stack**        | Python, PyTorch, Hugging Face, **vLLM 25.09**, dual A100 80GB |
| **Research Q**   | _Can a training-free cascade match a 32B medical VLM's accuracy at a fraction of its inference cost, with honest energy/latency accounting?_ |
| **Researcher**   | Li-Wen Kuan (關力文) — Leo Kuan                              |
| **Advisor**      | Yuan-Kai Wang (王元凱)                                       |
| **Institution**  | Fu Jen Catholic University (輔仁天主教大學)                  |

See [Project Overview](project.md) for the full motivation, method, related
work, and 12-week plan.

---

## Where the project stands now

<span class="pill pill--wip">In progress</span> &nbsp; **Week 6 — the gate
axis is closed; the win is structural (ACC).**

The committed result is a **7B→32B confidence-margin cascade** on
[MedVLThinker](baseline/medvlthinker.md): on the four competent medical-VQA
benchmarks it holds **32B-level accuracy at a measured 0.639× of always-32B
compute** (≈36% energy saved), with a deployable frozen margin gate. A
reviewer-grade audit ([Week 5](weekly/week-05/index.md)) then established that
the *gate* cannot be improved — no learned or conformal router beats a one-line
margin gate, because the rescue event is near-unpredictable from any cheap 7B
signal.

[Week 6](weekly/week-06/index.md) found the lever the gate work was missing:
the **strong leg's compute mode.** The 32B's chain-of-thought *over-thinks*
perception VQA (no-think beats think by **+7.7 on SLAKE / +11.7 on VQA-RAD** at
~2 decode tokens vs ~477), so turning the 32B's *fast* mode into an
intermediate cascade tier yields **ACC** (the Adaptive-Compute Cascade): a
3-tier cascade from two checkpoints (7B-nt → **32B-no-think** → 32B-think) that
matches always-32B-think accuracy at **−72% latency / −75% energy / ~½ FLOPs**,
guardrail-clean. **ACC-v2** adds a free 7B/32B-disagreement gate that strictly
Pareto-improves. The work is framed as an honest **efficiency-systems**
contribution, written up for **CVGIP 2026** (submitted) with a higher-tier
resubmission in progress.

See the weekly logs for daily notes:
[Week 1](weekly/week-01/index.md) ·
[Week 2](weekly/week-02/index.md) ·
[Week 3](weekly/week-03/index.md) ·
[Week 4](weekly/week-04/index.md) ·
[Week 5](weekly/week-05/index.md) ·
[Week 6](weekly/week-06/index.md).

---

## The research journey

The project converged on cascading by **eliminating** the alternatives — each
dead end closed with evidence, each pivot motivated by the last. The full
chronology lives in the [Weekly Log](weekly/index.md); the spine:

| Phase | When | Direction | Outcome |
| ----- | ---- | --------- | ------- |
| **Visual-token pruning** | Weeks 1–3 | Question-aware pruning on [LLaVA-Med](baseline/llava-med.md) → [Qwen2.5-VL](baseline/qwen25-vl.md) → [HuatuoGPT-Vision](baseline/huatuo-vision.md) | **Closed.** Random selection Pareto-dominates every structured pruning method at every keep-ratio — but the *reason* (the model barely needs fine-grained visual evidence) is a grounding finding, not a pruning one. |
| **Visual grounding / adaptive compute** | Week 4 | Evidence-sensitivity routing; image-difficulty-driven compute allocation | **Closed.** No readable internal signal orthogonal to confidence; the image-difficulty wedge came back weak and wrong-signed. |
| **Single-model routing** | Week 5 | 4-policy (think/nothink × RAG/noRAG) routing on [MedVLThinker-7B](baseline/medvlthinker.md) | **Closed.** The arms of one model are redundant decision-makers; the oracle falls far below the independence floor (z = −25 to −29σ). |
| **Cross-model cascade** | Week 5 | 7B→32B confidence-margin cascade | **Committed.** Real complementarity (+12.5pp oracle); the margin cascade matches 32B at **0.639× compute**. Accuracy headroom is real but unreachable from cheap signals. |
| **ACC** | Week 6 | Strong-leg compute mode → 3-tier cascade + agreement gate | **Current.** Matches always-32B-think at **−72% latency / −75% energy / ~½ FLOPs**. |

The through-line: a careful chain of **honest negative results** that
progressively narrowed the design space until a real, defensible efficiency
contribution remained.

---

## How this site is organised

- **[Project Overview](project.md)** — research question, motivation, the
  method (cascade + ACC), related work, and the 12-week plan. *Read this
  first.*
- **[Baselines & Models](baseline/index.md)** — the current
  [MedVLThinker](baseline/medvlthinker.md) base models and the legacy baselines
  from the pruning era, each with environment, versions, and verification.
- **[Experiments](experiments.md)** — the running experiment log across all
  phases, from pruning sweeps to the cascade.
- **[Weekly Log](weekly/index.md)** — one page per week, daily notes.
- **[Bugs & Issues](bugs.md)** — bugs encountered, with full troubleshooting
  trails.
- **[Resources](resources.md)** — papers, datasets, code, and tools (cascade
  reading list + the legacy pruning library).

## Quick links

- :material-github: [Project repository](https://github.com/Leokuan0208/question-aware-vtp-medvlm)
- :material-file-document: [FrugalGPT — LLM cascades (Chen et al., 2023)](https://arxiv.org/abs/2305.05176)
- :material-file-document: [AutoMix — self-verifying cascade routing (2023)](https://arxiv.org/abs/2310.12963)
- :material-file-document: [CP-Router — conformal routing (Su et al., 2025)](https://arxiv.org/abs/2505.19970)
- :material-file-document: [A 2026 survey of routing strategies](https://arxiv.org/abs/2603.04445)
