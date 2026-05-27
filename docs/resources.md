# Resources

A curated list of everything I'm using as a reference for the project.
Updated as I go.

## Core papers

### The baseline

- **HuatuoGPT-Vision: Injecting Medical Visual Knowledge into Multimodal
  LLMs at Scale** — Chen et al., 2024.
  [arXiv:2406.19280](https://arxiv.org/abs/2406.19280) —
  **the current baseline.** LLaVA-v1.5 architecture, Qwen2-7B backbone;
  authors publish merged weights, bundled eval data, and a one-command
  reproduction pipeline across six benchmarks.
- **LLaVA-Med: Training a Large Language-and-Vision Assistant for
  Biomedicine in One Day** — Li et al., NeurIPS 2023.
  [arXiv:2306.00890](https://arxiv.org/abs/2306.00890) —
  the original Week-1/Week-2 baseline; pivoted away from on May 21,
  but the harness and reproduction findings are preserved.
- **LLaVA: Visual Instruction Tuning** — Liu et al., NeurIPS 2023.
  [arXiv:2304.08485](https://arxiv.org/abs/2304.08485) —
  upstream architecture that LLaVA-Med and HuatuoGPT-Vision (v1.5)
  are both built on.

### Visual token pruning (the actual core of this project)

- **Token Merging: Your ViT But Faster (ToMe)** — Bolya et al.,
  ICLR 2023 (notable top-5%).
  [OpenReview](https://openreview.net/forum?id=JroZRaRw7Eu) —
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

- **GridPrune: From "Where to Look" to "What to Select" in Visual
  Token Pruning for MLLMs** — Duan et al., arXiv November 2025.
  [arXiv:2511.10081](https://arxiv.org/abs/2511.10081) —
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
  _Source link pending — locate published / arXiv version._
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

- **ZSPAPrune: Zero-Shot Prompt-Aware Token Pruning for Vision-Language
  Models** — Zhang et al., arXiv October 2025.
  [arXiv:2510.17197](https://arxiv.org/abs/2510.17197) —
  Uses **the same mean-pooled question / cosine-similarity scoring
  as our QSim** as its "relevance" phase, then adds a diversity
  selection phase that picks tokens maximizing dissimilarity to the
  current selection. **Our QSim is the simpler "relevance only" half
  of ZSPAPrune.** Tier-1 candidate (add diversity term to QSim) is
  motivated directly by this paper.
- **ResPrune: Relevance-and-Smoothness Token Pruning**
  — Li et al., 2026.
  _Source link pending — locate published / arXiv version._
  Evaluates exactly our scoring formula as their *Setting-3*
  ablation and reports it as the **weakest of three** formulations
  (Setting-1: max-similarity-per-visual-token across text tokens →
  98.4%; Setting-2: averaged-similarity → 98.1%; Setting-3:
  pooled-text cosine → 95.4%). The Tier-1 max-similarity follow-up
  is motivated by this paper directly.
- **FasterVLM: [CLS] Attention is All You Need for Training-Free
  Visual Token Pruning** — Zhang et al., arXiv December 2024.
  [arXiv:2412.01818](https://arxiv.org/abs/2412.01818) —
  Text-agnostic; uses CLIP CLS attention as the scoring signal,
  prunes between vision encoder and LLM. Critiques in-LLM text-visual
  attention as inaccurate; relevant negative comparison for our
  text-aware angle.
- **VisionZip: Longer is Better but Not Necessary in Vision
  Language Models** — Yang et al., CVPR 2025.
  [arXiv:2412.04467](https://arxiv.org/abs/2412.04467) —
  Post-projector, pre-LLM pruning using CLS-attention. **v2 of our
  patcher operates at the same insertion point as VisionZip.**
- **ReDiPrune: Text-Relevance and Diversity Pruning**
  — 2025/2026 preprint.
  _Source link pending — locate published / arXiv version._
  Closest architectural neighbor to v2: text-relevance + diversity,
  post-projector, pre-LLM. Combines what ZSPAPrune does (relevance
  + diversity) with the v2 insertion point.
- **HoloV: Don't Just Chase "Highlighted Tokens" in MLLMs —
  Revisiting Visual Holistic Context Retention** — arXiv October 2025.
  [arXiv:2510.02912](https://arxiv.org/abs/2510.02912) —
  Identifies that attention-based pruning concentrates kept tokens
  in a few salient regions and **loses global context**. Direct
  critique of formulations like ours; motivates Tier-2 E
  (spatial-coherence-aware QSim) and Tier-1 A/C (diversity terms).
- **When Token Pruning is Worse than Random: Understanding Visual
  Token Information in VLLMs** — arXiv December 2025.
  [arXiv:2512.07580](https://arxiv.org/abs/2512.07580) —
  Strong null result: in deep LLM layers, existing token pruning
  methods perform similarly or worse than random pruning. Doesn't
  say all pruning is useless — says the chosen *metric* often
  isn't doing useful work; speedup comes from "any 50% of tokens"
  rather than "the right 50%". **Our random comparison floor at
  every keep_ratio is the experimental control that catches this
  regime.**
- **PyramidDrop (PDrop): Accelerating Your Large Vision-Language
  Models via Pyramid Visual Redundancy Reduction** — Xing et al.,
  CVPR 2025. [arXiv:2410.17247](https://arxiv.org/abs/2410.17247) —
  In-LLM pruning at multiple progressive layer depths.
- **PuMer: Pruning and Merging Tokens for Efficient Vision Language
  Models** — Cao et al., ACL 2023.
  [ACL Anthology](https://aclanthology.org/2023.acl-long.721/) —
  Text-informed pruning of irrelevant tokens + similarity-based
  merging of redundant ones, combined into a single end-to-end
  framework. The canonical "hybrid prune+merge" reference for our
  Tier-1 C experiment.
- **AIM: Adaptive Inference Merging for Multimodal LLMs**
  — 2024-2025.
  _Source link pending — locate published / arXiv version._
  Per-sample decides how much to prune vs merge based on image
  information density. Homogeneous radiograph → aggressive
  pruning; busy histology slide → more merging.

### Added Day 17 (from the medical-VQA-properties survey)

- **ViTAS: Visual Token Adaptive Selection for Medical VLMs**
  — Ahmed et al., 2026.
  _Source link pending — locate published / arXiv version._
  MIMIC-CXR summarization: *"selectively focusing on pathology-
  relevant visual patches rather than full images yields
  substantially better performance — less but more relevant
  visual input is not only sufficient but superior."* Direct
  evidence for the high-background-to-signal property of medical
  imaging.
- **HEAL-MedVQA: Diagnosing Shortcut Learning in Medical VQA**
  — 2025.
  _Source link pending — locate published / arXiv version._
  Diagnostic study showing current medical VLMs rely heavily on
  text-shortcut features, with visual grounding much weaker than
  accuracy numbers suggest. Motivates the Tier-3 G ablation
  (visual aphasia test).
- **Medical Visual Question Answering: A Survey**
  — Lin et al., *Artificial Intelligence in Medicine* 143:102611, 2023.
  [doi.org/10.1016/j.artmed.2023.102611](https://doi.org/10.1016/j.artmed.2023.102611)
  · [arXiv:2111.10056](https://arxiv.org/abs/2111.10056) —
  Establishes the question-type taxonomy (modality / plane /
  anatomy / abnormality) and the localization property:
  *"the task needs to focus on a fine-grained scale because a
  lesion is microscopic."* The conceptual backbone of the Methods
  Roadmap's medical-VQA-property arguments.

- _Add as you read them. A one-line note on why each paper is useful is
  more helpful than a long summary._

### Medical VQA benchmarks

The six benchmarks bundled with HuatuoGPT-Vision's
[`Medical_Multimodal_Evaluation_Data`](https://huggingface.co/datasets/FreedomIntelligence/Medical_Multimodal_Evaluation_Data)
release — used as a unified evaluation suite for every pruning
experiment on the HuatuoGPT-Vision-7B baseline.

- **VQA-RAD** — Lau et al., 2018. Radiology question-answering
  dataset.
  [Nature Scientific Data](https://www.nature.com/articles/sdata2018251) ·
  [HuggingFace](https://huggingface.co/datasets/flaviagiammarino/vqa-rad).
- **SLAKE** — Liu et al., ISBI 2021. Bilingual (English/Chinese)
  medical VQA with semantic labels across multiple imaging modalities.
  [arXiv:2102.09542](https://arxiv.org/abs/2102.09542).
- **PathVQA** — He et al., 2020. Pathology visual question answering;
  adds a third imaging domain alongside radiology (VQA-RAD) and
  general medical (SLAKE).
  [arXiv:2003.10286](https://arxiv.org/abs/2003.10286).
- **PMC-VQA** — Zhang et al., 2023. Large-scale medical VQA dataset
  (227k QA pairs / 149k images) drawn from PubMed Central; covers
  many modalities and diseases.
  [arXiv:2305.10415](https://arxiv.org/abs/2305.10415).
- **OmniMedVQA** — Hu et al., CVPR 2024. Large-scale comprehensive
  evaluation benchmark assembled from 73 medical classification
  datasets covering 12 imaging modalities and 20+ anatomical regions.
  [arXiv:2402.09181](https://arxiv.org/abs/2402.09181).
- **MMMU (Health & Medicine track)** — Yue et al., CVPR 2024.
  The medicine subset of MMMU's six-discipline benchmark; college-level
  multimodal questions requiring expert knowledge.
  [arXiv:2311.16502](https://arxiv.org/abs/2311.16502).

## Code

- [Leokuan0208/huatuo-llava-v15-med-pruning](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)
  — **this project's active evaluation harness and pruning code
  on the HuatuoGPT-Vision-7B baseline.** Houses the v2 patcher
  (pre-LLM pruning), the {Random, QSim_mean, QSim_max, GridPrune,
  FASP+GridPrune} method implementations, and the analysis pipeline.
- [FreedomIntelligence/HuatuoGPT-Vision](https://github.com/FreedomIntelligence/HuatuoGPT-Vision)
  — upstream **HuatuoGPT-Vision** repo. Provides the merged 7B
  weights via HuggingFace and the one-command `accelerate launch
  eval.py` pipeline that reproduces paper Table 4 across six
  benchmarks.
- [Leokuan0208/llava-med-pruning-v1](https://github.com/Leokuan0208/llava-med-pruning-v1)
  — historical LLaVA-Med v1.0 evaluation harness (Week 1-2). Frozen
  after the May 21 pivot; kept for the v1.0 reproduction numbers
  and the kr=0.75 ablation result that motivated the early version
  of the project's thesis.
- [Leokuan0208/llava-med-pruning](https://github.com/Leokuan0208/llava-med-pruning)
  — original LLaVA-Med v1.5 evaluation harness (Week 1). Houses the
  E00 baseline row.
- [Leokuan0208/Qwen-v25-vl-med-pruning](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)
  — Qwen2.5-VL-7B sandbox repo (Week 3 Day 1). Frozen at
  `c5ce256` after the May 25 pivot to HuatuoGPT-Vision; the
  20/20 MCQ-letter compliance smoke test is preserved as an
  artifact.
- [microsoft/LLaVA-Med](https://github.com/microsoft/LLaVA-Med) —
  upstream LLaVA-Med (the Week 1-2 baseline).
- [haotian-liu/LLaVA](https://github.com/haotian-liu/LLaVA) —
  upstream LLaVA (v1.5) — the architecture HuatuoGPT-Vision-7B
  and LLaVA-Med v1.0 are both built on.
- [facebookresearch/ToMe](https://github.com/facebookresearch/ToMe) —
  reference implementation of token merging.
- [pkunlp-icler/FastV](https://github.com/pkunlp-icler/FastV) — FastV
  reference code; useful for seeing where in the LM to intervene.

## Tools

- :material-language-python: **Python 3.10** — bundled with the
  NGC PyTorch 23.10 base image; all packages installed via **`pip3`**
  directly into the container's system Python. No virtual environments,
  no Conda. (Container isolation is enough; the throwaway-image-per-
  rebuild workflow makes a second isolation layer unnecessary.)
- :material-docker: **Docker** (via HONGHU KUBERUN) — every dependency
  pinned in the Dockerfile, rebuilt on KUBERUN when packages change.
  See the [HuatuoGPT-Vision baseline page](baseline/huatuo-vision.md#the-dockerfile)
  for the active Dockerfile.
- :material-microsoft-visual-studio-code: **VS Code** with the Python
  and Pylance extensions
- :material-jupyter: **JupyterLab** — the KUBERUN VM's launch interface;
  used as an in-container terminal and file browser
- :material-github: **Git** for version control (HuatuoGPT-Vision
  pruning repo + frozen v1.0 harness + this documentation repo)
- :material-laptop: **tmux** for keeping long-running training and
  inference sessions alive over SSH
- :material-chart-line: **Weights & Biases** _(optional, decide in
  Phase 3)_ for experiment tracking

## Reading-in-progress

Things I've started but not finished. Keeping the list visible makes it
more likely I actually go back.

- [ ] _Paper / blog post / chapter._
- [ ] _..._
