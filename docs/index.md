# Question-Aware Visual Token Pruning for Medical VLMs

A research notebook tracking the design, implementation, and evaluation
of a **question-aware visual token pruning** mechanism for medical
vision–language models (VLMs).

**The core idea.** Medical VLMs like LLaVA-Med encode an input image
into hundreds of visual tokens, most of which are irrelevant to any
given question. Can we prune those tokens *conditionally on the question*
before they enter the language model — reducing compute and possibly
improving answer quality?

!!! note "About this site"
    Everything here is a work in progress. Pages get updated as the
    project evolves; "last updated" timestamps appear at the bottom of
    each page.

---

## Project at a glance

|                  |                                                              |
| ---------------- | ------------------------------------------------------------ |
| **Duration**     | 12 weeks                                                     |
| **Start date**   | May 11, 2026                                                 |
| **Baseline**     | [LLaVA-Med v1.5 (Mistral-7B)](https://github.com/microsoft/LLaVA-Med) |
| **Stack**        | Python, PyTorch, Hugging Face Transformers, CUDA             |
| **Research Q**   | _Can question-conditioned visual token pruning preserve (or improve) medical VQA accuracy while reducing inference cost?_ |
| **Researcher**   | Li-Wen Kuan (關力文) — Leo Kuan                              |
| **Advisor**      | Yuan-Kai Wang (王元凱)                                       |
| **Institution**  | Fu Jen Catholic University (輔仁天主教大學)                  |

See [Project Overview](project.md) for the full motivation, hypothesis,
and 12-week plan.

## Where I am right now

<span class="pill pill--wip">In progress</span> &nbsp;
**Phase 1, Week 3 — HuatuoGPT-Vision baseline reproduced + first
successfully-pruned sweep complete.** Week 1 closed out May 16
([overview](weekly/week-01/index.md#end-of-week-status)). Week 2
closed out May 23 with the first pivot — LLaVA-Med v1.0 → Qwen2.5-VL
([overview](weekly/week-02/index.md#reflections-end-of-week)). The
Qwen2.5-VL pivot was **validated May 24** with 20/20 strict MCQ-letter
compliance
([details](weekly/week-03/day-01.md#phase-3-mcq-letter-compliance-smoke-test-step-3));
a second pivot followed on **May 25** to
[HuatuoGPT-Vision-7B (LLaVA-v1.5 architecture)](baseline/huatuo-vision.md)
for reproducibility, and the
[paper Table 4 reproduced same-day](baseline/huatuo-vision.md#baseline-metrics)
with 5/6 benchmarks within 0.55 pts of published numbers
([details](weekly/week-03/day-02.md)). The pruning framework's
first incarnation
([`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe))
turned out to be a no-op — diagnosed Day 17 from a smell-test
showing **bit-identical scores across all 8 overnight runs**.
[Day 17](weekly/week-03/day-03.md) was a four-act day: morning
diagnosis, **v1 fix cascade** (three real bugs:
`prepare_inputs_labels_for_multimodal_new` method rename,
attention-mask frame reconciliation, position_ids RoPE OOB),
**v1 → v2 architectural rewrite** (prune *before* the LLM trunk
instead of after layer 0; 130 lines vs 280, ~30% speedup at
kr=0.5), and the **first successfully-pruned 8-run sweep**
(`{qsim, random} × {0.75, 0.5, 0.25, 0.1}` across 6 benchmarks).
Three commits pushed today:
[`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28)
(archive v1),
[`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249)
(install v2),
[`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568)
(sweep results). Numerical analysis deferred to Day 18. Three repos
now:
[`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
(frozen, LLaVA-Med v1.0 phase),
[`Qwen-v25-vl-med-pruning`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)
(frozen, Qwen2.5-VL smoke-test artifact preserved), and
[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)
(active).

- [x] Built reproducible Docker image (NGC PyTorch 23.10, CUDA 12.2)
- [x] Stack sanity check (PyTorch, transformers, accelerate, flash-attn)
- [x] Cloned LLaVA-Med, installed editable
- [x] Downloaded `llava-med-v1.5-mistral-7b` weights (~15 GB)
- [x] First successful inference via `llava.serve.cli`
- [x] Found, root-caused, and patched a CLI bug in `llava/serve/cli.py`
      → see [Bugs & Issues #1](bugs.md#1-llavaservecli-stops-generation-immediately-for-the-mistral-variant)
- [x] Set up this documentation site (local + deployed to GitHub Pages)
- [x] First read-pass of `prepare_inputs_labels_for_multimodal` —
      visual-token splicing logic mapped, position-ID handling noted
      → [Week 1, Day 4](weekly/week-01/day-04.md#architecture-deep-dive-partial-paused-for-later)
- [x] Strategic decision: implement pruning directly on v1.5
      (inference-only method, no v1.0 reproduction needed)
      &nbsp; — _revised May 15: pivoted back to v1.0 once the complete
      v1.5 baseline row showed the gap to published fine-tuned
      figures_
- [x] Scaffolded evaluation harness `~/llava-med-pruning/` —
      4 of 11 files implemented, 7 documented stubs awaiting fill-in
- [x] Downloaded benchmark datasets: VQA-RAD, SLAKE, PathVQA
      (~990 MB total, all verified against authoritative sources)
- [x] Recovered from a `pip --force-reinstall` regression that broke
      the container → see [Bugs & Issues #2](bugs.md#2-pip-install-force-reinstall-cascaded-and-clobbered-the-ngc-pinned-stack)
- [x] Implemented the harness end-to-end for the VQA-RAD path —
      `metrics.py`, `model_loader.py`, `runner.py`, `run_eval.py`, and
      the VQA-RAD loader (SLAKE + PathVQA loaders still stubbed)
- [x] Investigated a ~29-point baseline-vs-literature gap; verified
      via the reference `model_vqa.py` that the harness is correct —
      the gap is evaluation methodology, not a code bug
- [x] Found and fixed an `answer_type` mislabeling bug in the VQA-RAD
      loader → see [Bugs & Issues #3](bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions)
- [x] Ran **E00** baseline on VQA-RAD test — closed 0.537, open recall
      0.340 → [Experiments](experiments.md#e00-baseline-no-pruning-v15)
- [x] Put `~/llava-med-pruning/` under git version control
- [x] **Batch 3 done** — implemented SLAKE + PathVQA loaders; ran E00
      on all three v1.5 benchmarks. Complete v1.5 baseline row:
      VQA-RAD closed 0.537 / open 0.340; SLAKE closed 0.587 / open
      0.395; PathVQA closed 0.587 / open 0.106
      → [Experiments](experiments.md#e00-baseline-no-pruning-v15)
- [x] **Strategic pivot to LLaVA-Med v1.0** — once the full v1.5 row
      was visible, the 24-32 point gap to published v1.0 fine-tuned
      figures made v1.0's per-dataset delta weights the better
      baseline. Forked the harness to `~/llava-med-pruning-v1`,
      successfully merged the VQA-RAD delta (~13 GB merged model),
      wrote v1.0's hand-rolled `model_loader.py`
      → [Week 1, Day 6](weekly/week-01/day-06.md#the-strategic-pivot-switching-to-llava-med-v10)
- [x] Rebuilt the v1.0 environment cleanly via Dockerfile and finished
      the v1.0 harness — pushed to
      [`Leokuan0208/llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
- [x] **v1.0 stage-2 zero-shot baseline reproduces the paper** —
      0.58 closed on VQA-RAD, within 8 pts of paper's stage-2 row
      (~0.50). First paper-comparable v1.0 result in this project.
- [x] Day 7 finding "all three v1.0 deltas broken" recorded; **revised
      May 17** after rebuilding the reproduction tables — see below.
- [x] **Week 1 complete.** Full ledger on the
      [Week 1 overview](weekly/week-01/index.md#end-of-week-status).
- [x] DeepSpeed activation-checkpointing fixed (Day 7 carry-over)
- [x] **5-epoch VQA-RAD full FT completed** — closed 0.570 vs stage-2
      zero-shot 0.580. **Memorization without generalization** (loss
      1.13 → 0.004). Stage-2 zero-shot adopted as the canonical
      v1.0 baseline.
- [x] **v1.0 baseline row extended to all three datasets** —
      cross-validated via Baron-GG: VQA-RAD 0.577, SLAKE 0.488,
      PathVQA 0.556 (closed).
- [x] **Reproduction tables consolidated** — open-recall reproduces
      paper to within ±1.5 pts across all configs/datasets;
      closed-accuracy reproduces on stage-2 (±4 pts) but has a
      31-63 pt gap on FT-merged models. The gap is almost certainly
      a closed-set scoring-recipe issue (likely `--answer-prompter`),
      not broken weights. Full tables on the
      [Experiments page](experiments.md#on-the-v10-reproduction-track)
      and [Week 2, Day 1](weekly/week-02/day-01.md#phase-85-paper-table-4-vs-our-reproduction-consolidated).
- [x] **SLAKE pipeline completed** — loader wired into runner
      registry; 216-entry candidate set built.
- [x] **First working visual-token pruning method** — in-LLM pruning
      with 32-layer hook architecture + decode-step mask
      coordination; smoke-tested with random and qsim methods at
      kr=0.5
      → [Week 2, Day 1](weekly/week-02/day-01.md#phase-12-the-decode-step-debugging-saga-5-iterations)
- [x] **First ablation result at kr=0.75 in** — on VQA-RAD,
      question-similarity pruning scored 60.29 closed vs random
      pruning's 56.99 (+3.30 pts) and vs the unpruned baseline's
      57.72 (+2.57 pts). First positive datapoint on the project's
      central thesis; needs the full Pareto curve to confirm.
      → [Week 2, Day 1, Phase 14](weekly/week-02/day-01.md#phase-14-kr075-ablation-result-question-aware-pruning-beats-baseline)
- [x] **Yesterday's 8-run sweep (`c216bbe`) diagnosed as a no-op.**
      Smell-test showed bit-identical scores across all 8
      configurations on May 26 morning. Root cause: wrong patch
      target — HuatuoGPT-Vision forks LLaVA's multimodal-prep
      method into a `_new`-suffixed variant we hadn't wrapped.
      → [Week 3, Day 3, Phase 1](weekly/week-03/day-03.md#phase-1-morning-the-smell-test-that-found-the-bug)
- [x] **v1 fix cascade** — three real bugs fixed in sequence:
      method rename, attention-mask frame reconciliation,
      position_ids RoPE OOB. v1 archived as a research artifact
      at [`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28).
- [x] **v1 → v2 architectural rewrite.** Pre-LLM pruning instead of
      post-layer-0; 130 lines vs 280, ~30% inference speedup at
      kr=0.5. Pushed at
      [`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249).
      → [Week 3, Day 3, Phase 5](weekly/week-03/day-03.md#phase-5-the-pre-llm-rewrite-v2)
- [x] **First successfully-pruned 8-run sweep complete.**
      {qsim, random} × {kr=0.75, 0.5, 0.25, 0.1} across 6
      benchmarks on HuatuoGPT-Vision-7B; ~4-5h wall time. Per-run
      `__scores.json` + `__latency_summary.json` files committed at
      [`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568).
- [x] **Two literature surveys written.** (1) Cosine-similarity
      scoring positioned: QSim ≈ ZSPAPrune's relevance phase ≈
      ResPrune's Setting-3 baseline; not novel as a formula.
      (2) Token merging vs pruning; medical-VQA properties →
      [Methods Roadmap (Tier 1/2/3)](project.md#methods-roadmap-tiers-1-3).
- [ ] **Numerical analysis of the v2 sweep** (Day 18 priority) —
      Pareto curves, headline number, E2 writeup on the
      Experiments page
- [ ] **Tier-1 follow-up: max-similarity scoring** (ResPrune
      Setting-1) once the v2 sweep is analyzed
- [ ] Push Day 8's accumulated changes to
      [`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
      (split into coherent commits)
- [ ] Update [Bug #5](bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)
      with the revised "VQA-RAD catastrophic, PathVQA degraded, SLAKE
      missing" narrative
- [ ] Finish reading visual-token-pruning literature (ToMe, FastV,
      SparseVLM, GAP) — slipped five days
- [ ] Begin Phase 2 of the project plan: codebase deep-dive with
      print-statement instrumentation on
      `prepare_inputs_labels_for_multimodal`

See the [Week 1 log](weekly/week-01/index.md),
[Week 2 log](weekly/week-02/index.md), and
[Week 3 log](weekly/week-03/index.md) for daily notes.

## How this site is organised

- **[Project Overview](project.md)** — research question, motivation,
  hypothesis, related work, the 12-week plan. *Read this first.*
- **[Baseline](baseline/index.md)** — how the LLaVA-Med baseline is
  installed and configured, with hardware, versions, commands, and
  gotchas.
- **[Experiments](experiments.md)** — running log of pruning strategies
  tried, with metrics and ablations.
- **[Weekly Log](weekly/index.md)** — one page per week, daily notes.
- **[Bugs & Issues](bugs.md)** — bugs encountered, with full
  troubleshooting trails.
- **[Resources](resources.md)** — papers, datasets, code, tools.

## Quick links

- :material-github: [Project repository](https://github.com/Leokuan0208/question-aware-vtp-medvlm)
- :material-file-document: [LLaVA-Med paper (NeurIPS 2023)](https://arxiv.org/abs/2306.00890)
- :material-file-document: [Token Merging — ToMe (Bolya et al., ICLR 2023)](https://arxiv.org/abs/2210.09461)
- :material-file-document: [FastV — visual token pruning for VLMs (Chen et al., ECCV 2024)](https://arxiv.org/abs/2403.06764)
