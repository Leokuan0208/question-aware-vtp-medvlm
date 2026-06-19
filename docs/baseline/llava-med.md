# Baseline: LLaVA-Med v1.5 / v1.0

<span class="pill pill--done">Frozen — May 24, 2026</span>

!!! warning "Legacy baseline (visual-token-pruning era)"
    This was the project's **original** baseline. The project has since pivoted
    to **model cascading** on [MedVLThinker](medvlthinker.md) — see [The
    research journey](../project.md#the-research-journey-how-we-got-here). This
    page is preserved as history.

LLaVA-Med was the original baseline for this project (May 10–May 21,
2026). This page documents the exact environment used to reproduce
that baseline so anyone — including future-me — can rebuild it
identically.

!!! info "Track frozen on May 24, 2026"
    The project pivoted to **[Qwen2.5-VL-7B-Instruct](qwen25-vl.md)**
    as the active baseline on May 21, 2026, after identifying two
    unreproducibility issues with LLaVA-Med v1.0: a substring-match
    bug in the closed-set scorer (inflated reported accuracy by 9-12
    pts), and 0/11 MCQ-letter compliance on an
    instruction-following smoke test (blocked use of standardized
    evaluation harnesses). The full pivot writeup is in
    [Week 2, Day 5](../weekly/week-02/day-05.md). This page is kept
    as a historical reference; the active baseline is on the
    [Qwen2.5-VL](qwen25-vl.md) page.

The pruning module and evaluation harness for the LLaVA-Med track
live in two frozen repos —
[Leokuan0208/llava-med-pruning](https://github.com/Leokuan0208/llava-med-pruning)
(v1.5 harness) and
[Leokuan0208/llava-med-pruning-v1](https://github.com/Leokuan0208/llava-med-pruning-v1)
(v1.0 track, frozen with a status notice on the README as of May 24).
This page is only about getting the upstream LLaVA-Med baseline
running.

## Hardware

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
| cuDNN | 8.9.5 | base image |
| NCCL | 2.19.3 | base image |
| PyTorch | 2.1.0a0+32f93b1 | base image |
| transformers | 4.36.2 | pinned (from `pyproject.toml`) |
| tokenizers | ≥0.15.0 | pinned |
| sentencepiece | 0.1.99 | pinned |
| accelerate | 0.21.0 | pinned |
| peft | 0.4.0 | pinned |
| bitsandbytes | 0.41.0 | pinned |
| deepspeed | 0.9.5 | pinned |
| timm | 0.9.12 | pinned |
| flash-attn | 2.3.6 | built from source, `--no-build-isolation` |

The version choices are dictated by LLaVA-Med's `pyproject.toml`. The
NGC 23.10 container is chosen because its bundled PyTorch (2.1) and
CUDA (12.2) are the closest match to LLaVA-Med's late-2023 dependency
era — and because A100 (sm_80) is fully supported.

## The Dockerfile

This is the exact image definition used for the reproduction.

```dockerfile
# Dockerfile for reproducing LLaVA-Med on A100
# Base: NGC PyTorch 23.10 -> Python 3.10, CUDA 12.2.2, PyTorch 2.1
FROM nvcr.io/nvidia/pytorch:23.10-py3

# Ubuntu packages
# git-lfs is needed to pull model weights from HuggingFace
RUN apt update -y && apt install -y \
    git \
    git-lfs \
    python3-pip \
 && rm -rf /var/lib/apt/lists/*

# JupyterLab - required by the HONGHU KUBERUN VM launch interface
RUN pip3 install --no-cache-dir jupyter jupyterlab

# LLaVA-Med core dependencies, pinned to match microsoft/LLaVA-Med pyproject.toml
RUN pip3 install --no-cache-dir \
    "transformers==4.36.2" \
    "tokenizers>=0.15.0" \
    "sentencepiece==0.1.99" \
    "accelerate==0.21.0" \
    "peft==0.4.0" \
    "bitsandbytes==0.41.0" \
    "deepspeed==0.9.5" \
    "timm==0.9.12" \
    "einops==0.6.1" \
    "einops-exts==0.0.4" \
    "pydantic<2,>=1" \
    "scikit-learn==1.2.2" \
    "gradio==3.35.2" \
    "gradio_client==0.2.9" \
    "httpx==0.24.0" \
    "openai==1.12.0" \
    "markdown2[all]" \
    shortuuid fastapi uvicorn tiktoken backoff ninja wandb

# Flash-Attention 2 - must build against the container's PyTorch.
# 2.3.6 is contemporary with LLaVA-Med and exposes
# flash_attn_varlen_qkvpacked_func that the repo imports.
RUN pip3 install --no-cache-dir flash-attn==2.3.6 --no-build-isolation

# Symlink so /data shows up in the JupyterLab file browser
# (KUBERUN mounts the shared /data volume at runtime; the symlink target
# does not need to exist at build time).
RUN ln -s /data /root/data

CMD ["jupyter", "lab", "--port=8888", "--ip=0.0.0.0", "--allow-root", "--no-browser"]
```

## Storage layout

| Path | Purpose | Notes |
| ---- | ------- | ----- |
| `/data/` | Shared mount, multi-user | Created by platform |
| `/data/dan/` | Personal namespace | My own folder; the `dan` prefix prevents collisions with other users |
| `/data/dan/weights/` | Model weights | `llava-med-v1.5-mistral-7b/` lives here (~15 GB) |
| `/data/dan/dataset/` | Datasets | _Empty so far — population planned for Phase 2_ |
| `/root/LLaVA-Med/` | Cloned codebase, editable install | Inside the container |
| `/root/data` | Symlink to `/data` | For JupyterLab file-browser visibility |
| `/workspace/` | Container scratch, **persistent** | Confirmed with platform admin — survives rebuilds on KUBERUN |

## Setup commands (in execution order)

These are the commands actually run, in the order they were run,
starting May 10, 2026.

### 1. Build the image via KUBERUN

Submitted the Dockerfile above through the HONGHU KUBERUN interface;
the platform builds the image and brings up a container with the GPU
attached and `/data` mounted. JupyterLab is the entry point.

### 2. Sanity-check the stack

From a JupyterLab terminal:

```bash
python -c "
import torch
print('PyTorch:', torch.__version__)
print('CUDA available:', torch.cuda.is_available())
print('CUDA version:', torch.version.cuda)
print('GPU:', torch.cuda.get_device_name(0))
print('GPU count:', torch.cuda.device_count())

import transformers; print('transformers:', transformers.__version__)
import accelerate;   print('accelerate:',   accelerate.__version__)
import peft;         print('peft:',         peft.__version__)

# bitsandbytes 0.41.0 does not expose __version__; use importlib.metadata.
import bitsandbytes as bnb
from importlib.metadata import version
print('bitsandbytes:', version('bitsandbytes'))

import flash_attn; print('flash_attn:', flash_attn.__version__)
from flash_attn.flash_attn_interface import flash_attn_varlen_qkvpacked_func
print('flash_attn varlen API: OK')
"
```

**Confirmed output:**

```text
PyTorch: 2.1.0a0+32f93b1
CUDA available: True
CUDA version: 12.2
GPU: NVIDIA A100 80GB PCIe
GPU count: 1
transformers: 4.36.2
accelerate: 0.21.0
peft: 0.4.0
bitsandbytes: 0.41.0
flash_attn: 2.3.6
flash_attn varlen API: OK
```

!!! note "First gotcha — `bitsandbytes.__version__`"
    The first attempt of this script used `bnb.__version__` and crashed
    with `AttributeError`. bitsandbytes 0.41.0 does not expose
    `__version__` as a module attribute. Fix: use
    `importlib.metadata.version('bitsandbytes')`, which reads the pip
    metadata directly and works for any installed package.

### 3. Clone LLaVA-Med and install editable

```bash
cd ~
git clone https://github.com/microsoft/LLaVA-Med.git
cd LLaVA-Med
pip install -e . --no-deps
```

- `-e` (editable install) lets us patch files in `~/LLaVA-Med/llava/`
  and have changes take effect immediately. Critical when we patched
  the CLI bug later.
- `--no-deps` prevents pip from re-resolving dependencies; everything
  is already pinned in the image.

### 4. Download the model weights

```bash
cd /data/dan/weights
git lfs install
git clone https://huggingface.co/microsoft/llava-med-v1.5-mistral-7b
```

End result: `/data/dan/weights/llava-med-v1.5-mistral-7b/` containing 3
safetensors shards (~5 GB each, total ~15 GB), tokenizer files, and
metadata. Verified with `du -sh` and `ls -lh`.

### 5. First inference

The repo does not ship a `run_llava` module (that is upstream LLaVA
only); use the CLI:

```bash
cd ~/LLaVA-Med
python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png
```

This step initially produced single-word responses — see
[Bugs & Issues](../bugs.md) for the full diagnostic trail and the one-line
patch.

### 6. After patching the CLI

The CLI now returns full multi-turn medical responses for the
`mistral_instruct` template. Multi-turn conversation verified working.

## Baseline metrics

To be measured in Phase 1, Week 2.

| Metric                          | Value | Notes |
| ------------------------------- | ----- | ----- |
| VQA-RAD accuracy (closed)       | _TBD_ | Baseline, no pruning |
| VQA-RAD accuracy (open)         | _TBD_ |       |
| SLAKE accuracy (closed)         | _TBD_ |       |
| SLAKE accuracy (open)           | _TBD_ |       |
| Visual tokens per forward pass  | 576   | Standard ViT-L/14 at 336² |
| Inference latency (per query)   | _TBD_ | Wall-clock, batch=1 |
| Peak VRAM (inference)           | _TBD_ |       |

## Reproducibility checklist

- [x] Dockerfile committed to project repo (will be added when the
      separate code repo goes up)
- [x] Exact Python, CUDA, PyTorch versions recorded
- [x] Hardware specs recorded
- [x] Model identifier and approximate size recorded
- [ ] `pip freeze` output from inside the container saved alongside this
      page
- [ ] Model weight checksums noted (sha256 of each shard)
- [ ] First inference output saved as a sanity-check baseline transcript

## Known issues with the baseline

See [Bugs & Issues](../bugs.md) for full writeups:

- :material-bug-check: **#1** `llava.serve.cli` stop-criterion logic
  truncates Mistral-template generation to one token —
  <span class="pill pill--done">patched locally</span>.
