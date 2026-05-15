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
**Phase 1, Week 1 — Baseline setup.**

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
- [ ] Bring up a new container from the v1.0 Dockerfile (today's env
      battle convinced us that in-place pip patching is too risky)
- [ ] Finish v1.0 harness adaptations — `metrics.py` (candidate-set
      argmax), `runner.py` (v1.0 prompt + stop criteria), the
      candidate-set builder
- [ ] Run E00 against the merged VQA-RAD-fine-tuned model — the real
      v1.0 baseline, directly comparable to the ~0.84 published figure
- [ ] Investigate the missing SLAKE delta on HuggingFace (the
      `katielink/llava-med-7b-slake-delta` repo was empty)
- [ ] Finish reading visual-token-pruning literature (ToMe, FastV,
      SparseVLM, GAP)
- [ ] Draft Week 2 plan

See the [Week 1 log](weekly/week-01/index.md) for daily notes.

## How this site is organised

- **[Project Overview](project.md)** — research question, motivation,
  hypothesis, related work, the 12-week plan. *Read this first.*
- **[Baseline (LLaVA-Med)](setup.md)** — how the LLaVA-Med baseline is
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
