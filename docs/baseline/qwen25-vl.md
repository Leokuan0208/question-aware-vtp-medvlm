# Baseline: Qwen2.5-VL-7B-Instruct

<span class="pill pill--done">Frozen — May 25, 2026</span>

!!! warning "Legacy baseline (visual-token-pruning era)"
    A one-day baseline during the pruning era. The project has since pivoted to
    **model cascading** on [MedVLThinker](medvlthinker.md) — see [The research
    journey](../project.md#the-research-journey-how-we-got-here). Preserved as
    history.

Qwen2.5-VL-7B-Instruct was the active baseline for one day
(May 24-25, 2026). The MCQ-letter compliance smoke test passed
20/20 strict — confirming the LLaVA-Med v1.0 → Qwen2.5-VL pivot
was the right move — but a literature survey on May 25 revealed
that VLMEvalKit / lmms-eval don't actually support the three
target datasets (VQA-RAD, SLAKE, PathVQA) out of the box, which
made the reproducibility story weaker than expected. **The project
pivoted again to HuatuoGPT-Vision-7B (LLaVA-v1.5 architecture)** on
May 25, since the HuatuoGPT-Vision authors publish merged weights,
bundled eval data, a one-command pipeline, and a Table of headline
numbers — i.e. a paper-reproducible target. The full pivot writeup
is on [Week 3, Day 2](../weekly/week-03/day-02.md).

!!! info "Track frozen on May 25, 2026"
    This page is kept as a historical reference. The active
    baseline is now **[HuatuoGPT-Vision-7B](huatuo-vision.md)**.
    The Qwen2.5-VL 20/20 MCQ-letter compliance smoke test is
    preserved as a real artifact on the frozen
    [`Qwen-v25-vl-med-pruning`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)
    repository (`scripts/mcq_compliance_smoke.py`, frozen at
    [`c5ce256`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning/commit/c5ce256026f4f7b0dd291af4cd40b2b381897ba4)).

The frozen repository for this baseline is
[Leokuan0208/Qwen-v25-vl-med-pruning](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)
(renamed from `medical-vlm-pruning` on May 25). The active baseline
is on the [HuatuoGPT-Vision](huatuo-vision.md) page.

## Hardware

Same hardware as the LLaVA-Med track — KUBERUN-provisioned A100 VM.
No change in physical setup; only the image and model changed.

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
| Base container | `nvcr.io/nvidia/pytorch:25.06-py3` | NVIDIA NGC |
| OS in container | Ubuntu 24.04 | base image |
| Python | 3.12 | base image |
| CUDA | 12.9.1 | base image |
| PyTorch | 2.8.0a0+5228986c39.nv25.06 | base image |
| NumPy | 1.26.4 | pinned (`numpy<2.0`) — NGC's PyTorch was built against NumPy 1.x |
| transformers | 4.49.0 | pinned — first stable Qwen2.5-VL release |
| qwen-vl-utils | 0.0.10 with `[decord]` extra | pinned — official preprocessing helper |
| accelerate | latest | unpinned, current stable |
| pydantic | ≥2.0 | flipped from the LLaVA-Med pin of `<2` (v1.x); Qwen2.5-VL's ecosystem needs v2 |
| vlmeval | latest | upstream — standardized evaluation backbone |
| flash-attn | 2.7.4.post1 | pinned, `--no-build-isolation`; stable for Qwen2.5-VL on CUDA 12.9 |
| Pillow | 10.4.0 | upstream |
| opencv-python | 4.13.0 | upstream — required by `qwen_vl_utils` image preprocessing |
| tifffile | 2026.5.15 | upstream — used by VLMEvalKit's medical-imaging loaders |

NGC 25.06 was chosen over the more recent 26.04 release because it's
the **last CUDA 12.x NGC release** before NGC moved to CUDA 13. Two
practical consequences: `flash-attn` has pre-built wheels for CUDA
12.x (forcing a CUDA-13 build takes 30-60 min and often fails on
missing nvcc symbols), and the R555+ driver requirement is widely
deployed on KUBERUN. The 11 months of library maturity since NGC
25.06 released means every Qwen2.5-VL dependency has tested wheels
for this stack.

## The Dockerfile

This is the exact image definition used for the reproduction.

```dockerfile
# Dockerfile for Qwen2.5-VL medical VQA + visual token pruning research
# Base image: NGC PyTorch 25.06 -> Python 3.12, CUDA 12.9.1, PyTorch 2.8
FROM nvcr.io/nvidia/pytorch:25.06-py3

# Ubuntu packages
# git-lfs needed to pull model weights from HuggingFace
# libgl1, libglib2.0-0 required by opencv-python (used by
# qwen_vl_utils image preprocessing)
RUN apt update -y && apt install -y \
    git \
    git-lfs \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Empty NGC's pip constraint file: it pins transformers to an older
# version than Qwen2.5-VL needs (>=4.49). Pip's config still references
# the file path, so we empty rather than delete it -- deleting would
# break every subsequent pip call.
RUN mkdir -p /etc/pip && echo "" > /etc/pip/constraint.txt

# JupyterLab - required by the HONGHU KUBERUN VM launch interface
RUN pip3 install --no-cache-dir jupyter jupyterlab

# Qwen2.5-VL core dependencies, version-pinned to a known-good
# combination tested with Qwen/Qwen2.5-VL-7B-Instruct as of mid-2025.
# CRITICAL: numpy<2.0 -- NGC 25.06's PyTorch was compiled against
# NumPy 1.x; NumPy 2.x is binary-incompatible and breaks torch.export
# silently. The pin blocks transitive deps from upgrading numpy.
RUN pip3 install --no-cache-dir \
    "numpy<2.0" \
    "transformers==4.49.0" \
    "qwen-vl-utils[decord]==0.0.10" \
    "vlmeval" \
    "accelerate" \
    "pydantic>=2.0" \
    "pillow" \
    "opencv-python" \
    "tifffile"

# Flash-Attention 2 - reinstall pinned, since NGC's pre-installed
# version could vary between image pulls. 2.7.4.post1 has stable
# Qwen2.5-VL support and CUDA 12.9 wheels.
RUN pip3 install --no-cache-dir flash-attn==2.7.4.post1 --no-build-isolation

# Symlink so /data shows up in the JupyterLab file browser
# (KUBERUN mounts the shared /data volume at runtime; the symlink
# target doesn't need to exist at build time).
RUN ln -s /data /root/data

CMD ["jupyter", "lab", "--port=8888", "--ip=0.0.0.0", "--allow-root", "--no-browser"]
```

!!! warning "Two non-obvious gotchas in this Dockerfile, both expensive to discover"
    1. **Empty `/etc/pip/constraint.txt`, don't delete it.** NGC 25.06's
       `/etc/pip.conf` references the constraint file as an absolute
       path. Deleting the file leaves a dangling reference that crashes
       every subsequent `pip install` with
       `ERROR: Could not open requirements file`. Emptying the file
       (so pip finds a valid empty constraint) avoids the issue.
    2. **`numpy<2.0` must be pinned *before* VLMEvalKit is installed.**
       NGC 25.06's PyTorch was compiled against NumPy 1.x. VLMEvalKit's
       transitive dependencies pull in NumPy 2.x by default, which
       is binary-incompatible with the compiled PyTorch — code paths
       like `torch.export` crash with opaque errors mid-eval. Pinning
       `numpy<2.0` first blocks the upgrade.

    Both lessons logged on
    [Week 2, Day 5, Phase 8](../weekly/week-02/day-05.md#phase-8-first-kuberun-build-constraint-file-failure-rebuild)
    and
    [Phase 9](../weekly/week-02/day-05.md#phase-9-step-1-import-check-numpy-2x-conflict-second-rebuild).

## Storage layout

Same `/data/dan/` namespace convention as the LLaVA-Med track —
preserved deliberately so the dataset directories (VQA-RAD, SLAKE,
PathVQA) are reachable identically from both images.

| Path | Purpose | Notes |
| ---- | ------- | ----- |
| `/data/` | Shared mount, multi-user | Created by platform |
| `/data/dan/` | Personal namespace | The `dan` prefix prevents collisions with other users |
| `/data/dan/weights/` | Model weight cache | HuggingFace cache root for the container's `HF_HOME` |
| `/data/dan/weights/hub/models--Qwen--Qwen2.5-VL-7B-Instruct/` | Qwen2.5-VL weights | ~16 GB across 5 safetensors shards + config / tokenizer / processor files |
| `/data/dan/dataset/` | Datasets | VQA-RAD, SLAKE, PathVQA (carried over from LLaVA-Med track) |
| `/root/Qwen-v25-vl-med-pruning/` | Active project repo, editable install | Clone of [`Leokuan0208/Qwen-v25-vl-med-pruning`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning) |
| `/root/data` | Symlink to `/data` | For JupyterLab file-browser visibility |
| `/workspace/` | Container scratch, **persistent** | Survives rebuilds on KUBERUN |

## Setup commands (in execution order)

These are the commands actually run, in the order they were run,
starting May 21, 2026 (Dockerfile draft) through May 24, 2026
(validation).

### 1. Build the image via KUBERUN

Submitted the Dockerfile above through the HONGHU KUBERUN interface;
the platform builds the image and brings up a container with the GPU
attached and `/data` mounted. JupyterLab is the entry point.

Two attempts were needed because of the gotchas called out above —
the first build failed on a dangling `/etc/pip/constraint.txt`
reference (deleted the file rather than emptying it); the third build
included the `numpy<2.0` pin after a NumPy 2.x warning surfaced
during Step 1 below. Full debugging narrative on
[Week 2, Day 5](../weekly/week-02/day-05.md#phase-7-drafting-the-qwen25-vl-dockerfile).

### 2. Sanity-check the stack

From a JupyterLab terminal:

```bash
python << 'EOF'
import torch
print(f"PyTorch:        {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version:   {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU:            {torch.cuda.get_device_name(0)}")
    print(f"GPU count:      {torch.cuda.device_count()}")
import numpy
print(f"NumPy:          {numpy.__version__}")
import transformers
print(f"transformers:   {transformers.__version__}")
import qwen_vl_utils
print(f"qwen_vl_utils:  OK")
import flash_attn
print(f"flash-attn:     {flash_attn.__version__}")
import vlmeval
print(f"vlmeval:        OK")
import PIL; print(f"Pillow:         {PIL.__version__}")
import cv2; print(f"opencv:         {cv2.__version__}")
import tifffile; print(f"tifffile:       {tifffile.__version__}")
EOF
```

**Confirmed output (May 24, 2026):**

```text
PyTorch:        2.8.0a0+5228986c39.nv25.06
CUDA available: True
CUDA version:   12.9
GPU:            NVIDIA A100 80GB PCIe
GPU count:      1
NumPy:          1.26.4
transformers:   4.49.0
qwen_vl_utils:  OK
flash-attn:     2.7.4.post1
vlmeval:        OK
Pillow:         10.4.0
opencv:         4.13.0
tifffile:       2026.5.15
All imports succeeded with no warnings.
```

The "no warnings" outcome is what the `numpy<2.0` pin buys — without
it, this same command emits a multi-line "A module that was compiled
using NumPy 1.x cannot be run in NumPy 2.x as it may crash..." warning
that points at lurking bugs in `torch.export`-style code paths.

### 3. Download Qwen2.5-VL-7B-Instruct weights

From inside the container, with `HF_HOME=/data/dan/weights` set so
the cache lives on the shared volume:

```bash
huggingface-cli download Qwen/Qwen2.5-VL-7B-Instruct \
    --local-dir-use-symlinks True
```

Downloads ~16 GB across 5 safetensors shards plus config, tokenizer,
processor files. First run took ~3 days due to a network hiccup mid-
download (started May 21 evening, completed May 22 afternoon); after
that, weights are cached and subsequent loads are instant. Verify
the download with:

```bash
du -sh /data/dan/weights/hub/models--Qwen--Qwen2.5-VL-7B-Instruct/
# Should print: 16G ...
ls -L /data/dan/weights/hub/models--Qwen--Qwen2.5-VL-7B-Instruct/snapshots/*/
# Should list 5 safetensors shards + config.json, tokenizer.json,
# preprocessor_config.json, generation_config.json, merges.txt, vocab.json
```

### 4. Model load smoke test

Loads Qwen2.5-VL onto the GPU in bf16, confirms parameter count,
GPU memory footprint, and the chosen attention implementation:

```bash
python << 'EOF'
import torch, time
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"

for attn in ("flash_attention_2", "sdpa"):
    try:
        t0 = time.time()
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16,
            device_map="cuda:0",
            attn_implementation=attn,
        )
        print(f"loaded with {attn} in {time.time()-t0:.1f}s")
        break
    except Exception as e:
        print(f"failed with {attn}: {e}")

processor = AutoProcessor.from_pretrained(MODEL_ID, use_fast=True)
n_params  = sum(p.numel() for p in model.parameters()) / 1e9
alloc_gb  = torch.cuda.memory_allocated() / 1e9
print(f"params: {n_params:.2f}B  ·  GPU alloc: {alloc_gb:.2f} GB")
print(f"attn:   {model.config._attn_implementation}")
print(f"dtype:  {model.dtype}  ·  device: {model.device}")
print(f"tokenizer: {type(processor.tokenizer).__name__}")
print(f"image:     {type(processor.image_processor).__name__}")
EOF
```

**Confirmed output (May 24, 2026):**

```text
loaded with flash_attention_2 in 8.8s
params: 8.29 B
GPU alloc: 16.64 GB
attn:   flash_attention_2
dtype:  torch.bfloat16  ·  device: cuda:0
tokenizer: Qwen2TokenizerFast
image:     Qwen2VLImageProcessor
```

All in range: 8.29B parameters (expected ~8.3B with the vision
encoder included), 16.64 GB GPU allocated (plenty of headroom on the
80 GB A100 for KV cache during generation), `flash_attention_2`
loaded without falling back to SDPA. Cold load in 8.8 s; subsequent
loads from cache are faster.

### 5. MCQ-letter compliance smoke test

The decision-validating test of the pivot. 20 random yes/no closed
questions from the VQA-RAD test parquet, reformatted as MCQ with
A/B option-order shuffled per sample, greedy decoding,
`max_new_tokens=16`, seed=42. Script lives at
[`scripts/mcq_compliance_smoke.py`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning/blob/main/scripts/mcq_compliance_smoke.py)
in the active repo.

**Confirmed output (May 24, 2026):**

```text
strict MCQ compliance: 20/20 (100.0%)
letter correct:        15/20 (75.0%)
Wrote: results/mcq_compliance_smoke_20260524_HHMMSS.json
```

For comparison: LLaVA-Med v1.0 scored **0/11** on the equivalent test
on May 20, which is what triggered the model swap. Full writeup on
[Week 3, Day 1, Phase 3](../weekly/week-03/day-01.md#phase-3-mcq-letter-compliance-smoke-test-step-3).

## Baseline metrics

The canonical benchmark numbers — VQA-RAD, SLAKE, PathVQA closed /
open via VLMEvalKit — are pending. VLMEvalKit setup is scheduled for
May 25 (Day 16 / Week 3 Day 2). Until then, the only baseline
numbers on Qwen2.5-VL are:

| Test | Result | Notes |
| ---- | ------ | ----- |
| MCQ-letter strict compliance | **20/20** (100%) | 20-sample VQA-RAD smoke test |
| MCQ-letter correctness | 15/20 (75%) | Same 20 samples; directional only, not a benchmark |

Once VLMEvalKit runs land, this table grows to include the full
272-question canonical VQA-RAD closed set, plus SLAKE (1,061 test)
and PathVQA (6,719 test).

## Reproducibility checklist

To rebuild this baseline identically on a fresh A100:

- [ ] Pull `nvcr.io/nvidia/pytorch:25.06-py3` via KUBERUN
- [ ] Paste the [Dockerfile](#the-dockerfile) into KUBERUN and build
      the image (~25 min)
- [ ] Launch a container with `/data/dan` mounted; open a JupyterLab
      terminal
- [ ] Run the [Step 2 sanity-check heredoc](#2-sanity-check-the-stack);
      confirm "No warnings" line
- [ ] `huggingface-cli download Qwen/Qwen2.5-VL-7B-Instruct` (~16 GB);
      verify with `du -sh` and `ls -L`
- [ ] Run the [Step 4 load smoke test](#4-model-load-smoke-test);
      confirm `params: 8.29 B` and `loaded with flash_attention_2`
- [ ] Clone `git@github.com:Leokuan0208/Qwen-v25-vl-med-pruning.git`;
      run [`scripts/mcq_compliance_smoke.py`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning/blob/main/scripts/mcq_compliance_smoke.py);
      confirm 20/20 strict compliance

## Known issues with the baseline

- **Two cosmetic transformer warnings** when running the smoke test
  from a fresh inline heredoc (the committed `mcq_compliance_smoke.py`
  silences both):
    - `use_fast` defaults to the slow PIL-based image processor —
      explicit `AutoProcessor.from_pretrained(..., use_fast=True)`
      switches to the torchvision-v2 compiled path (~5-10% faster on
      VQA-RAD; minor floating-point differences from the kernel
      implementation, doesn't affect generation).
    - `temperature=1e-6` (Qwen2.5-VL's baked-in
      `generation_config.json` default) triggers a warning under
      `do_sample=False` because sampling parameters are meaningless
      in greedy decoding. Cosmetic — greedy ran as intended. Silenced
      by passing an explicit `GenerationConfig(do_sample=False,
      max_new_tokens=16, temperature=None)`.
- **vLLM not yet installed.** The Dockerfile keeps the image minimal;
  vLLM (the production inference server) adds ~3 GB and isn't needed
  for VLMEvalKit / smoke testing. If batched serving becomes the
  bottleneck during the pruning sweep, add `pip install
  "vllm>=0.7.2"` inside the running container and persist it via a
  Dockerfile bump.
- **No medical-domain instruction tuning yet.** Qwen2.5-VL-7B-Instruct
  is the general-purpose instruction-tuned variant. The medical-
  domain HuatuoGPT-Vision-7B (Qwen2.5-VL-based) is an option for a
  later experiment, but starting with vanilla Qwen2.5-VL-7B-Instruct
  is intentional — every recent pruning paper benchmarks on it,
  which makes our numbers directly comparable to FastV, SparseVLM,
  GAP, MedPruner, SwiftVLM, etc.
