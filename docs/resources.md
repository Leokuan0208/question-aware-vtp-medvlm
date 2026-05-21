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
  ICLR 2023 (notable top-5%). [OpenReview](https://openreview.net/forum?id=JroZRaRw7Eu) —
  classic ViT-side token reduction; question-agnostic. _On reading list._
- **An Image is Worth 1/2 Tokens After Layer 2 (FastV)** — Chen et al.,
  ECCV 2024 (Oral, top-2%).
  [ECVA PDF](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/10478.pdf) ·
  [arXiv:2403.06764](https://arxiv.org/abs/2403.06764) —
  closest prior art; drops tokens inside the LM after early layers.
  **Read May 19, 2026.** Key takeaway: pruning at layer 2-3 outperforms
  layer 0 because the question representation needs the first few
  layers to form; the `generate()` integration solves the same
  decode-step `attention_mask` coordination problem we hit on Day 1.
- **LLaVA-PruMerge: Adaptive Token Reduction for Efficient Large
  Multimodal Models** — Shang et al., ICCV 2025.
  [CVF Open Access](https://openaccess.thecvf.com/content/ICCV2025/html/Shang_LLaVA-PruMerge_Adaptive_Token_Reduction_for_Efficient_Large_Multimodal_Models_ICCV_2025_paper.html) —
  adaptive token reduction conditioned on visual-encoder sparsity.
- **SparseVLM: Visual Token Sparsification for Efficient VLM Inference** —
  Y. Zhang et al., ICML 2025 (poster).
  [OpenReview](https://openreview.net/forum?id=80faIPZ67S) —
  text-aware visual token pruning in general VLMs; closest in spirit
  to our "question-aware" angle.
- **Grounding-Aware Token Pruning (GAP)** — Chien et al., arXiv 2025 (preprint).
  [arXiv:2506.21873](https://arxiv.org/abs/2506.21873) —
  position-ID re-alignment fix after token drop; critical correction
  for RoPE-based VLMs.
- **MedPruner: Training-Free Hierarchical Token Pruning for Efficient
  3D Medical Image Understanding in VLMs** — Liu et al., arXiv 2026
  (preprint). [arXiv:2603.11625](https://arxiv.org/abs/2603.11625) —
  closest medical-domain prior art; 3D-focused but uses
  attention-based selection in a Medical VLM. **Read May 20, 2026.**
- **SwiftVLM: Efficient Vision-Language Model Inference via Cross-Layer
  Token Bypass** — Qian et al., arXiv 2026 (preprint, Feb 2026).
  [arXiv:2602.03134](https://arxiv.org/abs/2602.03134) —
  training-free pruning with a "bypass" paradigm: unselected tokens are
  forwarded to subsequent pruning stages for re-evaluation rather than
  committed-pruned at shallow layers. Directly addresses our open
  question of *where* in the LLaMA stack to prune. **Read May 20, 2026.**
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
