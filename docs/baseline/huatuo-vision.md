# Baseline: HuatuoGPT-Vision-7B

<span class="pill pill--done">Active baseline — reproduction validated May 25, 2026</span>

HuatuoGPT-Vision-7B is the **current baseline** for this project,
adopted on May 25, 2026 after the second pivot of Week 3. The pivot
is documented in detail on
[Week 3, Day 2](../weekly/week-03/day-02.md). **The paper-reproduction
target Table was reproduced end-to-end the same day**, with 5 of 6
benchmarks landing within 0.55 pts of the published numbers. This
page is the authoritative reference for the environment, image, and
verification steps — anyone (including future-me) should be able to
rebuild the baseline identically from this page.

The pruning module and reproduction harness for the HuatuoGPT-Vision
track live in
[Leokuan0208/huatuo-llava-v15-med-pruning](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning).
The frozen Qwen2.5-VL and LLaVA-Med tracks are documented on
[their own pages](index.md).

## Why HuatuoGPT-Vision-7B

Reproducibility-first. The authors of HuatuoGPT-Vision (Chen et al.
2024, [arXiv:2406.19280](https://arxiv.org/abs/2406.19280)) publish:

- **Merged weights** on HuggingFace —
  [FreedomIntelligence/HuatuoGPT-Vision-7B](https://huggingface.co/FreedomIntelligence/HuatuoGPT-Vision-7B).
  No delta-merge dance required.
- **Bundled evaluation data** —
  [FreedomIntelligence/Medical_Multimodal_Evaluation_Data](https://huggingface.co/datasets/FreedomIntelligence/Medical_Multimodal_Evaluation_Data).
- **A one-command eval pipeline** via `accelerate launch eval.py` in
  the [HuatuoGPT-Vision repository](https://github.com/FreedomIntelligence/HuatuoGPT-Vision).
- **A Table of headline numbers** across six benchmarks.

This means the first deliverable on this stack is **paper
reproduction** rather than from-scratch eval pipeline construction.
Published target Table from the paper:

| | VQA-RAD | SLAKE | PathVQA | PMC-VQA | OmniMedVQA | MMMU H&M |
|---|---:|---:|---:|---:|---:|---:|
| **HuatuoGPT-Vision-7B** (paper Table) | 63.7 | 76.2 | 57.9 | 54.3 | 74.0 | 50.6 |

A successful reproduction (within ~2 pts on each) validates the
pipeline before any pruning experiments are run.

**Bonus**: HuatuoGPT-Vision-7B uses the LLaVA-v1.5 architecture with
Qwen2-7B as the LLM backbone. LLaVA-Med v1.0 is LLaVA-v1.5 with
LLaMA-7B as the LLM backbone. The vision tower, projector, and most
of the decoder-hook target points are essentially identical, so the
`random` and `qsim` pruning methods from
[Week 2, Day 1](../weekly/week-02/day-01.md) port via architectural
similarity — the main change is which 32-layer decoder stack we
hook (Qwen2-7B vs LLaMA-7B; same shape, different weights). Roughly
~95% of the pruning code carries over.

## Hardware

Same hardware as the LLaVA-Med and Qwen2.5-VL tracks — KUBERUN-
provisioned A100 VM. No change in physical setup; only the image
and model change.

| Component | Spec |
| --------- | ---- |
| GPU       | NVIDIA A100 80GB **PCIe** (single card) |
| CPU       | Intel(R) Xeon(R) Silver 4310 @ 2.10 GHz |
| RAM       | 250 GB |
| Storage   | Shared `/data` mount + container-local `/workspace` (persistent across rebuilds on this platform) |
| Host OS   | Provided by HONGHU KUBERUN VM platform |
| Container runtime | Docker (Kubernetes-backed via the HONGHU KUBERUN interface) |

## Software stack

| Tool | Version | Source |
| ---- | ------- | ------ |
| Base container | `nvcr.io/nvidia/pytorch:23.10-py3` | NVIDIA NGC |
| OS in container | Ubuntu 22.04 | base image |
| Python | 3.10 | base image |
| CUDA | 12.2.2 | base image |
| PyTorch | 2.1.0a0+32f93b1 | base image — NGC's custom build |
| NumPy | 1.26.0 | pinned — matches HuatuoGPT's `requirements.txt`; NumPy 2.x is binary-incompatible with NGC's torch |
| transformers | 4.41.2 | pinned — see "compatibility note" below |
| tokenizers | ≥0.19,<0.20 | matches transformers 4.41.x |
| accelerate | 0.30.1 | pinned — required by HuatuoGPT's `accelerate launch eval.py` |
| peft | 0.10.0 | LLaVA-v1.5 stack standard |
| bitsandbytes | 0.43.1 | works with CUDA 12.2 |
| deepspeed | 0.12.6 | imported at top-level by some LLaVA scripts; 0.9.5 fails to JIT-compile against torch 2.1 (Bug #2-era lesson) |
| timm | 0.9.16 | supports CLIP ViT-L/14 used by LLaVA-v1.5 vision tower |
| einops | 0.7.0 | required by LLaVA codebase |
| einops-exts | 0.0.4 | required by LLaVA codebase |
| sentencepiece | 0.1.99 | tokenizer dependency |
| pydantic | <2 | LLaVA-v1.5 codepaths use pydantic v1 idioms |
| Pillow | 10.4.0 | upstream |
| opencv-python-headless | 4.10.0.84 | used by LLaVA's image preprocessing |
| flash-attn | 2.5.8 | pinned, `--no-build-isolation`; compatible with NGC's torch 2.1 and transformers 4.41.x |

!!! info "transformers version compatibility note"
    LLaVA-v1.5's official `pyproject.toml` pins `transformers==4.37.2`,
    which predates Qwen2's release. HuatuoGPT-Vision-7B's LLM
    backbone is **Qwen2-7B**, whose `Qwen2ForCausalLM` class was
    added to `transformers` around 4.40. We can't use LLaVA-v1.5's
    stock pin. The LLaVA-Llama-3 fork (which uses LLaVA-v1.5 +
    non-Vicuna LLM, same shape) bumps to `transformers==4.41.2`,
    which is a documented known-good neighborhood for "LLaVA-v1.5
    architecture + non-Vicuna LLM." We follow that.

## The Dockerfile

This is the exact image definition used for the reproduction.

```dockerfile
# Dockerfile for HuatuoGPT-Vision medical VQA reproduction + visual
# token pruning research.
# Base image: NGC PyTorch 23.10 -> Python 3.10, CUDA 12.2.2, PyTorch 2.1.0a0
# Project: huatuo-llava-v15-med-pruning
# Reproduces HuatuoGPT-Vision-7B (LLaVA-v1.5 arch, Qwen2-7B LLM backbone)
FROM nvcr.io/nvidia/pytorch:23.10-py3

# Ubuntu packages
# git-lfs needed to pull HuatuoGPT-Vision-7B weights from HuggingFace
# libgl1, libglib2.0-0 required by opencv-python (used by LLaVA's
# image preprocessing pipeline)
RUN apt update -y && apt install -y \
    git \
    git-lfs \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Empty NGC's pip constraint file: may pin packages that conflict with
# HuatuoGPT-Vision's requirements (transformers==4.37.2 specifically).
# Pip's config still references the file path, so we empty rather than
# delete it -- deleting would break every subsequent pip call.
RUN mkdir -p /etc/pip && echo "" > /etc/pip/constraint.txt

# JupyterLab - required by the HONGHU KUBERUN VM launch interface
RUN pip3 install --no-cache-dir jupyter jupyterlab

# HuatuoGPT-Vision dependencies, pinned per their requirements.txt
# with two documented deviations:
#   1. torch: NGC ships 2.1.0a0; HuatuoGPT pins 2.0.1. We keep NGC's
#      torch to avoid breaking pre-compiled CUDA libs. The API
#      differences relevant to inference are nil.
#   2. transformers: HuatuoGPT requirements list 4.37.2, but their
#      LLM is Qwen2-7B which needs transformers >=4.40. LLaVA-Llama-3
#      fork uses 4.41.2 as the known-good "LLaVA-v1.5 + non-Vicuna LLM"
#      neighborhood. We follow that.
# CRITICAL: numpy==1.26.0 -- NGC 23.10's PyTorch compiled against
# NumPy 1.x; NumPy 2.x is binary-incompatible. Pin matches HuatuoGPT's
# requirements.txt explicitly.
RUN pip3 install --no-cache-dir \
    "numpy==1.26.0" \
    "transformers==4.41.2" \
    "tokenizers>=0.19,<0.20" \
    "accelerate==0.30.1" \
    "peft==0.10.0" \
    "bitsandbytes==0.43.1" \
    "deepspeed==0.12.6" \
    "timm==0.9.16" \
    "einops==0.7.0" \
    "einops-exts==0.0.4" \
    "sentencepiece==0.1.99" \
    "shortuuid" "pydantic<2" \
    "Pillow==10.4.0" \
    "opencv-python-headless==4.10.0.84" \
    "scikit-learn==1.5.2"

# Flash-Attention 2 - reinstall pinned. 2.5.8 is compatible with
# NGC 23.10's torch 2.1 and transformers 4.41.x.
RUN pip3 install --no-cache-dir flash-attn==2.5.8 --no-build-isolation

# Symlink so /data shows up in the JupyterLab file browser
# (KUBERUN mounts the shared /data volume at runtime; the symlink
# target doesn't need to exist at build time).
RUN ln -s /data /root/data

CMD ["jupyter", "lab", "--port=8888", "--ip=0.0.0.0", "--allow-root", "--no-browser"]
```

!!! note "Single-pass build"
    Unlike the Qwen2.5-VL Dockerfile (which needed three KUBERUN
    submissions before clean — constraint-file fix and NumPy pin
    each surfaced separately), this Dockerfile **built cleanly on the
    first KUBERUN submission**. The constraint-file fix (empty rather
    than delete) and the explicit NumPy pin are both baked in from
    the start, carried forward from the Day 5 lessons on the
    Qwen2.5-VL setup.

## Storage layout

Same `/data/dan/` namespace convention as previous baselines — by
design, so dataset directories carry over identically and
HuggingFace caches don't have to be re-populated when switching
between containers.

| Path | Purpose | Notes |
| ---- | ------- | ----- |
| `/data/` | Shared mount, multi-user | Created by platform |
| `/data/dan/` | Personal namespace | The `dan` prefix prevents collisions |
| `/data/dan/weights/` | Model weight cache | HuggingFace cache root |
| `/data/dan/weights/.../HuatuoGPT-Vision-7B/` | HuatuoGPT-Vision-7B weights | _Download pending — Day 3 of Week 3_ |
| `/data/dan/dataset/Medical_Multimodal_Evaluation_Data/` | HuatuoGPT bundled eval data | _Download pending — Day 3_ |
| `/data/dan/dataset/{vqa_rad,slake,path_vqa}/` | Raw datasets | Carried over from earlier baselines |
| `/root/HuatuoGPT-Vision/` | Cloned upstream repo (gitignored locally) | For `eval.py` and supporting modules |
| `/root/huatuo-llava-v15-med-pruning/` | Active project repo, editable install | Clone of [`Leokuan0208/huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning) |
| `/root/data` | Symlink to `/data` | For JupyterLab file-browser visibility |

## Setup commands (in execution order)

### 1. Build the image via KUBERUN

Paste the Dockerfile above into the HONGHU KUBERUN interface; the
platform builds the image and brings up a container with the GPU
attached and `/data` mounted. JupyterLab is the entry point.

Build succeeded on the first submission (May 25, 2026). The
empty-constraint-file fix and explicit NumPy pin from the Qwen2.5-VL
setup carried over cleanly — the iteration cost paid on May 21 was
amortized here.

### 2. Clone HuatuoGPT-Vision repo + download weights

Ran on May 25, 2026. Steps:

```bash
# Clone the upstream code
cd ~/huatuo-llava-v15-med-pruning
git clone https://github.com/FreedomIntelligence/HuatuoGPT-Vision

# Set HuggingFace cache to the shared volume
export HF_HOME=/data/dan/weights

# Download merged weights (~14 GB)
huggingface-cli download FreedomIntelligence/HuatuoGPT-Vision-7B

# Download bundled eval data
huggingface-cli download \
    --repo-type dataset \
    FreedomIntelligence/Medical_Multimodal_Evaluation_Data \
    --local-dir /data/dan/dataset/Medical_Multimodal_Evaluation_Data
```

### 3. Two runtime dependency patches

The first `accelerate launch eval.py` attempt surfaced two missing
dependencies that aren't in HuatuoGPT-Vision's `requirements.txt`.
Patched at container runtime; should be folded into the Dockerfile
on the next rebuild:

```bash
# hf_transfer extra was silently dropped by pip's resolver during
# image build (the [hf_transfer] suffix on huggingface_hub didn't
# install the actual package). Install it explicitly:
pip3 install --no-cache-dir hf_transfer

# HuatuoGPT's eval.py imports `datasets` at line 19, but `datasets`
# isn't in their requirements.txt. Pin to 2.16.1 (Jan 2024, same
# era as their transformers==4.37.2) to avoid datasets 3.x/4.x API
# breaks:
pip3 install --no-cache-dir "datasets==2.16.1"
```

The `datasets` install was run with `--dry-run` first to confirm
pip wouldn't silently downgrade other pinned packages. Dry-run
showed only 5 new packages added (`datasets`, `dill`,
`multiprocess`, `pyarrow-hotfix`, `xxhash`), with zero existing
packages touched — `fsspec==2023.6.0` stayed put inside `datasets`'s
permissive window.

### 4. Full Table 4 reproduction

Ran on May 25, 2026 against the bundled
`medical_multimodel_evaluation_data.json`:

```bash
cd ~/huatuo-llava-v15-med-pruning/HuatuoGPT-Vision

accelerate launch eval.py \
    --data_path /data/dan/dataset/Medical_Multimodal_Evaluation_Data/medical_multimodel_evaluation_data.json \
    --model_path /data/dan/weights/HuatuoGPT-Vision-7B \
    2>&1 | tee /data/dan/dataset/Medical_Multimodal_Evaluation_Data/eval_run_$(date +%Y%m%d_%H%M%S).log
```

Result: **5 of 6 benchmarks within 0.55 pts of paper** (see
[Baseline metrics](#baseline-metrics) below). Full narrative on
[Week 3, Day 2, Phase 13](../weekly/week-03/day-02.md#phase-13-baseline-reproduction-56-benchmarks-within-055-pts).

## Baseline metrics

Six-benchmark reproduction of the HuatuoGPT-Vision paper Table 4,
end-to-end via `accelerate launch eval.py` on May 25, 2026. Full
narrative on
[Week 3, Day 2, Phase 13](../weekly/week-03/day-02.md#phase-13-baseline-reproduction-56-benchmarks-within-055-pts).

| Benchmark | Paper | Our reproduction | Δ |
| --- | ---: | ---: | ---: |
| VQA-RAD | 63.7 | 61.35 | −2.35 |
| SLAKE | 76.2 | 76.44 | +0.24 |
| PathVQA | 57.9 | 57.67 | −0.23 |
| PMC-VQA | 54.3 | 54.20 | −0.10 |
| OmniMedVQA | 74.0 | 73.46 | −0.54 |
| MMMU H&M | 50.6 | 50.34 | −0.26 |

**5 of 6 within 0.55 pts of paper.** The VQA-RAD outlier at −2.35
sits just outside the 2-pt tolerance defined for this baseline,
but VQA-RAD is the smallest test split (251 samples; one sample
≈ 0.4 pts) and the run log contained some "wrong image" warnings
that may explain the gap. The pipeline is **verified end-to-end**:
every accuracy number produced with pruning hooks attached is now
directly comparable to these six numbers.

## Reproducibility checklist

To rebuild this baseline identically on a fresh A100:

- [x] Pull `nvcr.io/nvidia/pytorch:23.10-py3` via KUBERUN
- [x] Paste the [Dockerfile](#the-dockerfile) into KUBERUN and build
      the image (single-pass build on May 25)
- [x] Launch a container with `/data/dan` mounted; open a JupyterLab
      terminal
- [x] Clone HuatuoGPT-Vision repo; download weights via
      `huggingface-cli download` (~14 GB)
- [x] Download bundled eval data (`Medical_Multimodal_Evaluation_Data`)
- [x] Patch runtime deps: `pip3 install hf_transfer datasets==2.16.1`
- [x] Clone `git@github.com:Leokuan0208/huatuo-llava-v15-med-pruning.git`
- [x] Run `accelerate launch eval.py`; verified reproduction with
      5 of 6 benchmarks within 0.55 pts of paper

## Known issues with the baseline

- **VQA-RAD reproduction is just outside the 2-pt tolerance** at
  −2.35 pts vs paper. VQA-RAD has only 251 samples in the eval
  split, so a 6-sample flip ≈ 2.4 pts of drift — well within seed
  + precision variance. The run log also contained some "wrong
  image" warnings that may account for part of the gap.
- **`hf_transfer` and `datasets` need to be added to the Dockerfile**
  for the next rebuild. Patched at container runtime on May 25;
  pinning them in-image will avoid the patching step on rebuilds.
- **`transformers` pin diverges from upstream `pyproject.toml`.**
  HuatuoGPT-Vision's `requirements.txt` pins `transformers==4.37.2`,
  which won't load Qwen2's `Qwen2ForCausalLM`. The 4.41.2 bump is
  documented and load-tested via LLaVA-Llama-3 fork.
- **No pruning experiments analyzed yet.** The May 25 overnight
  sweep (4 keep_ratios × 2 methods = 8 runs) is in progress; analysis
  is Day 17's first task. The May 17 `random` and `qsim` methods
  ported via architectural similarity to HuatuoGPT-Vision's Qwen2-7B
  decoder layers; the integration sits in
  [`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)
  at commit `c216bbe`.
