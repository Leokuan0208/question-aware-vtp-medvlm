# Resources

A curated list of everything I'm using as a reference for the project.
Updated as I go.

## Core papers

### The baseline

- **LLaVA-Med: Training a Large Language-and-Vision Assistant for
  Biomedicine in One Day** — Li et al., NeurIPS 2023.
  [arXiv:2306.00890](https://arxiv.org/abs/2306.00890)
- **LLaVA: Visual Instruction Tuning** — Liu et al., NeurIPS 2023.
  [arXiv:2304.08485](https://arxiv.org/abs/2304.08485)

### Visual token pruning (the actual core of this project)

- **Token Merging: Your ViT But Faster (ToMe)** — Bolya et al.,
  ICLR 2023. [arXiv:2210.09461](https://arxiv.org/abs/2210.09461) —
  classic ViT-side token reduction; question-agnostic.
- **An Image is Worth 1/2 Tokens After Layer 2 (FastV)** — Chen et al.,
  ECCV 2024. [arXiv:2403.06764](https://arxiv.org/abs/2403.06764) —
  closest prior art; drops tokens inside the LM after early layers.
- **LLaVA-PruMerge: Adaptive Token Reduction for Efficient Large
  Multimodal Models** — Shang et al., 2024.
  [arXiv:2403.15388](https://arxiv.org/abs/2403.15388) — adaptive pruning
  conditioned on token redundancy.
- _Add as you read them. A one-line note on why each paper is useful is
  more helpful than a long summary._

### Medical VQA benchmarks

- **VQA-RAD** — Lau et al., 2018. Radiology question-answering dataset.
- **SLAKE** — Liu et al., 2021. Bilingual medical VQA with semantic
  labels.
- **PathVQA** — He et al., 2020. Pathology visual question answering;
  adds a third imaging domain alongside radiology (VQA-RAD) and
  general medical (SLAKE).

## Code

- [Leokuan0208/llava-med-pruning](https://github.com/Leokuan0208/llava-med-pruning)
  — **this project's evaluation harness and pruning code.** Separate
  repo from the documentation site; the daily push of this repo is
  linked from each [weekly log](weekly/index.md) day page.
- [microsoft/LLaVA-Med](https://github.com/microsoft/LLaVA-Med) — the
  baseline.
- [haotian-liu/LLaVA](https://github.com/haotian-liu/LLaVA) — upstream
  LLaVA repo that LLaVA-Med is built on.
- [facebookresearch/ToMe](https://github.com/facebookresearch/ToMe) —
  reference implementation of token merging.
- [pkunlp-icler/FastV](https://github.com/pkunlp-icler/FastV) — FastV
  reference code; useful for seeing where in the LM to intervene.

## Datasets

| Dataset | Domain        | Purpose in this project        |
| ------- | ------------- | ------------------------------ |
| VQA-RAD | Radiology Q&A | Primary evaluation benchmark   |
| SLAKE   | Medical VQA   | Secondary evaluation benchmark |
| PathVQA | Pathology Q&A | Third evaluation benchmark — tests cross-domain generalisation |

## Tools

- :material-language-python: **Python 3.10** + **Conda** environments
- :material-microsoft-visual-studio-code: **VS Code** with the Python
  and Pylance extensions
- :material-github: **Git** for version control (LLaVA-Med fork +
  pruning project + this documentation repo)
- :material-laptop: **tmux** for keeping long-running training and
  inference sessions alive over SSH
- :material-chart-line: **Weights & Biases** _(optional, decide in
  Phase 3)_ for experiment tracking

## Reading-in-progress

Things I've started but not finished. Keeping the list visible makes it
more likely I actually go back.

- [ ] _Paper / blog post / chapter._
- [ ] _..._
