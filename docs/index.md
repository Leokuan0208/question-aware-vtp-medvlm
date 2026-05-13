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
| **Start date**   | May 10, 2026 (Sunday)                                        |
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
      → see [Bugs & Issues](bugs.md)
- [x] Set up this documentation site (local + deployed to GitHub Pages)
- [ ] Finish reading visual-token-pruning literature (ToMe, FastV, PruMerge)
- [ ] Draft Week 2 plan: profile baseline, locate visual-token pipeline
      in the codebase

See the [Week 1 log](weekly/week-01.md) for daily notes.

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
