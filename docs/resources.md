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

### Added Day 18 — May 27, 2026 (from the GridPrune + FASP design work)

- **GridPrune: Grid-Aware Visual Token Pruning for Efficient
  Vision-Language Models** — Wang et al., 2025/ICCV.
  General-VLM method for spatial-coverage-aware pruning. Divides
  visual tokens into a grid of zones, allocates a per-zone budget
  proportional to a fused (text-relevance + saliency) score, does
  local top-K within each zone. **Tonight's E3 sweep tests this as
  a standalone baseline.** Coverage-by-construction is the key
  contribution; the fused score is a small but reasonable signal
  enhancement over either component alone. Their reported gains
  on LLaVA-1.5 hold up across 5 general benchmarks at 50-90% pruning.
- **FASP: Foreground-Aware Soft Pruning for Medical
  Vision-Language Models** — Liu et al., 2024.
  Medical-imaging-specific token-scoring primitive. Score every
  token by the L2-norm of its post-projector embedding; lowest
  ~30% are reliably background (black borders, uniform tissue).
  Cheap (single tensor op) and medical-tested. **Used as the
  foreground filter in tonight's FASP+GridPrune composed method.**
  Original work used it as a soft-weighting; we use it as a hard
  pre-filter before the GridPrune zoning stage.
- **MedPruner re-read** (already cited above; arXiv 2603.11625).
  Spent an hour today on a careful re-read after the Day 4
  analysis. **Verified orthogonal to our project**: their
  inter-slice anchor-based filtering targets 3D-volume temporal
  redundancy along the slice axis, which our 2D-single-image
  HuatuoGPT-Vision setup doesn't have. Their dynamic-nucleus
  within-slice scoring is closer to general-VLM prior art
  (cumulative attention from early LLM layers, similar to FastV /
  SparseVLM). Clean complementary framing for the writeup: 3D
  medical = MedPruner's inter-slice stage; 2D medical =
  GridPrune-family / our FASP+GridPrune.

### Added Day 17 — May 26, 2026 (from the cosine-similarity literature survey)

- **ZSPAPrune: Zero-Shot Prompt-Aware Visual Token Pruning for VLMs**
  — Zhang et al., arXiv October 2025.
  Uses **the same mean-pooled question / cosine-similarity scoring
  as our QSim** as its "relevance" phase, then adds a diversity
  selection phase that picks tokens maximizing dissimilarity to the
  current selection. **Our QSim is the simpler "relevance only" half
  of ZSPAPrune.** Tier-1 candidate (add diversity term to QSim) is
  motivated directly by this paper.
- **ResPrune: Relevance-and-Smoothness Token Pruning**
  — Li et al., 2026.
  Evaluates exactly our scoring formula as their *Setting-3*
  ablation and reports it as the **weakest of three** formulations
  (Setting-1: max-similarity-per-visual-token across text tokens →
  98.4%; Setting-2: averaged-similarity → 98.1%; Setting-3:
  pooled-text cosine → 95.4%). The Tier-1 max-similarity follow-up
  is motivated by this paper directly.
- **FasterVLM: CLS-Attention-Based Visual Token Pruning for VLMs**
  — He et al., 2025.
  Text-agnostic; uses CLIP CLS attention as the scoring signal,
  prunes between vision encoder and LLM. Critiques in-LLM text-visual
  attention as inaccurate; relevant negative comparison for our
  text-aware angle.
- **VisionZip: Token Selection for Vision-Language Models**
  — Yang et al., 2025.
  Post-projector, pre-LLM pruning using CLS-attention. **v2 of our
  patcher operates at the same insertion point as VisionZip.**
- **ReDiPrune: Text-Relevance and Diversity Pruning**
  — 2025/2026 preprint.
  Closest architectural neighbor to v2: text-relevance + diversity,
  post-projector, pre-LLM. Combines what ZSPAPrune does (relevance
  + diversity) with the v2 insertion point.
- **HoloV: Holistic Visual Token Pruning**
  — October 2025.
  Identifies that attention-based pruning concentrates kept tokens
  in a few salient regions and **loses global context**. Direct
  critique of formulations like ours; motivates Tier-2 E
  (spatial-coherence-aware QSim) and Tier-1 A/C (diversity terms).
- **"When Token Pruning is Worse than Random"**
  — December 2025.
  Strong null result: in deep LLM layers, existing token pruning
  methods perform similarly or worse than random pruning. Doesn't
  say all pruning is useless — says the chosen *metric* often
  isn't doing useful work; speedup comes from "any 50% of tokens"
  rather than "the right 50%". **Our random comparison floor at
  every keep_ratio is the experimental control that catches this
  regime.**
- **PDrop: Progressive Visual Token Drop in MLLMs** — 2025.
  In-LLM pruning at multiple progressive layer depths.
- **PuMer: Prune-and-Merge Token Reduction for Efficient VL Models**
  — Cao et al., ACL 2023.
  Text-informed pruning of irrelevant tokens + similarity-based
  merging of redundant ones, combined into a single end-to-end
  framework. The canonical "hybrid prune+merge" reference for our
  Tier-1 C experiment.
- **AIM: Adaptive Inference Merging for Multimodal LLMs**
  — 2024-2025.
  Per-sample decides how much to prune vs merge based on image
  information density. Homogeneous radiograph → aggressive
  pruning; busy histology slide → more merging.

### Added Day 17 (from the medical-VQA-properties survey)

- **ViTAS: Visual Token Adaptive Selection for Medical VLMs**
  — Ahmed et al., 2026.
  MIMIC-CXR summarization: *"selectively focusing on pathology-
  relevant visual patches rather than full images yields
  substantially better performance — less but more relevant
  visual input is not only sufficient but superior."* Direct
  evidence for the high-background-to-signal property of medical
  imaging.
- **HEAL-MedVQA: Diagnosing Shortcut Learning in Medical VQA**
  — 2025.
  Diagnostic study showing current medical VLMs rely heavily on
  text-shortcut features, with visual grounding much weaker than
  accuracy numbers suggest. Motivates the Tier-3 G ablation
  (visual aphasia test).
- **A Comprehensive Survey on Medical Visual Question Answering**
  — Lin et al., 2023.
  Establishes the question-type taxonomy (modality / plane /
  anatomy / abnormality) and the localization property:
  *"the task needs to focus on a fine-grained scale because a
  lesion is microscopic."* The conceptual backbone of the Methods
  Roadmap's medical-VQA-property arguments.

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
