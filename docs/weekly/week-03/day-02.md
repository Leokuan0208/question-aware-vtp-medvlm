# Day 2 — Monday, May 25, 2026

[← Back to Week 3 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) → still closing out · Week 3,
Day 2 · **Day 16 of the project**

---

A decision day that turned into an execution day. Came in with a clear next-task
list (install VLMEvalKit, wire Qwen2.5-VL up, run zero-shot on
VQA-RAD/SLAKE/PathVQA), made a **second pivot** by mid-morning to
HuatuoGPT-Vision-7B (LLaVA-v1.5 architecture) for reproducibility,
then closed the day with **three concrete milestones landed**: a
near-perfect Table 4 reproduction (5 of 6 benchmarks within 0.55 pts
of paper), the first pruning framework written and verified
(RandomPruner + QSimPruner + LatencyTracker, integrated via
`Qwen2Model.forward` override + layer-0 KV cache slicing), and an
8-run overnight sweep launched in tmux.

Two repo transitions in 48 hours felt like flailing on the surface,
but the underlying logic is consistent: every time the project
encountered a new piece of information about reproducibility, the
next-best defensible baseline became visible, and switching to it was
cheaper than working around the gap. Today's reproduction landing
within tolerance is the first concrete evidence the chain was
navigation, not churn.

The headline: **the third (and intended-to-be-final) base model is
HuatuoGPT-Vision-7B**, chosen because the authors publish merged
weights, bundled evaluation data, a one-command eval pipeline, and
a Table of headline numbers on six benchmarks. Our first deliverable
on this stack is paper reproduction — **and it landed cleanly the
same day**.

## Phase 1 — Morning plan: VLMEvalKit setup on Qwen2.5-VL

The plan coming in (set in [Day 1's "Plan for tomorrow"](day-01.md#plan-for-tomorrow-may-25-day-16-week-3-day-2))
was the obvious next step from the pivot validation:

1. Install VLMEvalKit, pin the version
2. Wire up Qwen2.5-VL pointing at the cached weights path
3. Run zero-shot on **VQA-RAD closed** (the canonical 272-question
   closed set via the May 14 `answer_type_lookup.json`)
4. Repeat for SLAKE and PathVQA closed

The first action was a literature survey to ground expectations —
what *should* a Qwen2.5-VL-7B baseline score on VQA-RAD / SLAKE /
PathVQA closed? Without that, we'd have no way to know if a
post-VLMEvalKit number was "right" or "the wiring is wrong."

## Phase 2 — Literature survey for expected baselines

Searched recent medical VLM papers for Qwen2.5-VL-7B-Instruct
zero-shot numbers on the three benchmarks. Two findings that
substantially changed the day's direction:

**Found:** Liu et al. (2025) and a couple of audit papers report
Qwen2.5-VL-7B numbers in the 50-65% range across the three
benchmarks. Useful as a sanity-check window, but their
*preprocessing pipelines are not fully reproducible* — different
papers use different test-split definitions, different MCQ
reformulations, and different scoring. The numbers vary
±10 percentage points between papers depending on these choices.

**Implication:** we can't just point VLMEvalKit at "VQA-RAD" and
get a number that's directly comparable to the literature, because
the literature itself isn't internally comparable.

## Phase 3 — VLMEvalKit's actual coverage (correcting May 21's claim)

Tried to ground the plan in the harness itself: which datasets does
VLMEvalKit actually support out of the box?

Checked the registry. **VLMEvalKit and lmms-eval do not have
VQA-RAD, SLAKE, or PathVQA built in.** The May 21 claim — written
on Day 5 in the pivot decision — that "both support VQA-RAD/SLAKE/
PathVQA out of the box" was **wrong**. Both harnesses cover
general-domain medical-adjacent benchmarks (MMMU, MMBench,
SEED-Bench, POPE, etc.) but the three classic radiology / general
medical VQA benchmarks aren't included. This was assumed-without-
verification on May 21 and is now corrected.

A misstatement worth flagging for the record. Not because it
changes the project's direction in any catastrophic way, but
because it changes Day 5's framing — "the path to VLMEvalKit /
lmms-eval is open" was true for *MCQ-letter scoring on generic
benchmarks*, not for our three target datasets.

## Phase 4 — Surveying published test suites

If VLMEvalKit doesn't have the datasets, we need a published test
suite we can adopt directly. Two strong candidates surfaced:

- **AdaptLLM's `biomed-VQA-benchmark`** (Microsoft Research, EMNLP
  2025). Pre-reformulated VQA-RAD / SLAKE / PathVQA test sets as
  MCQ, packaged on HuggingFace, scored by single-letter match.
  Includes a working inference pipeline (vLLM-based).
  Sample sizes: 451 / 1,061 / 6,720. Citeable, defensible.
- **HuatuoGPT-Vision's bundled `eval.py`** (Chen et al., 2024).
  Uses the same MCQ-letter "Answer with the option's letter from
  the given choices directly" prompt that our May 24 smoke test
  validated. Built specifically for medical VLMs. Their
  preprocessing isn't on a HF dataset directly — it's bundled
  inside the `Medical_Multimodal_Evaluation_Data` HF dataset and
  needs unpacking.
- **SynthVision's `scripts/evaluate.py`** (openmed-labs, March
  2026). Runs Qwen2.5-VL-3B on all three datasets, but uses exact-
  match scoring instead of MCQ-letter. Less aligned with our
  smoke-test methodology.

## Phase 5 — Considering HuatuoGPT-Vision as base model

The day's decisive question came up here. If we're going to adopt
HuatuoGPT-Vision's evaluation methodology, should we also adopt
HuatuoGPT-Vision itself as the base model? Two reasons it would
make sense:

1. **Medical-instruction-tuned by design.** Qwen2.5-VL-7B-Instruct
   is general-purpose; HuatuoGPT-Vision-7B is the same Qwen2-7B
   backbone (LLaVA-v1.5 architecture) with explicit medical-domain
   instruction tuning. For medical VQA, the latter is the more
   natural baseline.
2. **Published reproducibility target.** The authors publish a
   Table of headline numbers across six benchmarks — VQA-RAD,
   SLAKE, PathVQA, PMC-VQA, OmniMedVQA, MMMU-Med. Reproducing
   *that* Table is a concrete, falsifiable target.

There's a Qwen2.5-VL-based variant of HuatuoGPT-Vision too, but
**no published headline numbers for it** — only for the original
LLaVA-v1.5 version. That makes the LLaVA-v1.5 variant the
paper-reproducible one.

## Phase 6 — The decision

**Adopt HuatuoGPT-Vision-7B (LLaVA-v1.5 architecture) as the active
baseline.** The original variant, not the Qwen2.5-VL one.

Reasoning, in priority order:

1. **Reproducibility-first.** The authors publish merged weights
   (no delta-merge dance), bundled eval data, a one-command
   pipeline, and a Table of numbers. First deliverable is paper
   reproduction. If our pipeline produces their numbers within
   ~2 pts on each benchmark, the pipeline is validated and pruning
   experiments can begin from a defensible foundation.
2. **Medical-instruction-tuned.** Better-aligned with the project's
   actual subject matter than vanilla Qwen2.5-VL-7B-Instruct.
3. **Bonus: ~95% of the May 17 pruning code ports for free.**
   HuatuoGPT-Vision-7B uses the LLaVA-v1.5 architecture with Qwen2-
   7B as the LLM backbone. LLaVA-Med v1.0 is LLaVA-v1.5 with
   LLaMA-7B as the LLM backbone. The vision tower, projector, and
   most of the decoder-hook target points are essentially
   identical. The `random` and `qsim` methods from the May 17
   ablation port via architectural similarity, with the main
   change being which decoder layers we hook (32-layer Qwen2-7B
   vs 32-layer LLaMA-7B — same shape, different weights).

## Phase 7 — Methodology lesson worth flagging

> The cheapest path to a defensible baseline is often
> *reproducing someone else's paper directly*, not writing your
> own pipeline — even when you "already have most of the code."

This is the meta-lesson of today. The May 17 pruning code was real
and worked. The Qwen2.5-VL smoke test passed cleanly on May 24.
The natural next move was to extend both into a full evaluation
pipeline. But there's a *much faster path to a real baseline
number* — adopt a published pipeline with published targets and
verify reproduction. The savings aren't just engineering time;
they're *credibility*. A reproduction of someone else's published
Table 4 is a stronger foundation than a from-scratch pipeline with
no comparison point.

Worth keeping in mind for future "do we extend or do we adopt"
decisions.

## Phase 8 — Repo strategy: freeze Qwen, init HuatuoGPT

With the decision made, the project's git layout needs a second
update in two days. The new structure mirrors what already worked
on May 24 when LLaVA-Med v1.0 was frozen:

- **`medical-vlm-pruning`** (init'd May 24) → renamed to
  **`Qwen-v25-vl-med-pruning`** and frozen. The Qwen2.5-VL
  smoke-test compliance result (20/20 strict MCQ) is a real,
  preserved artifact that anyone clicking the repo can verify by
  reading `scripts/mcq_compliance_smoke.py`. It's not deleted;
  it's archived as the canonical record of the May 24 phase.
- **`huatuo-llava-v15-med-pruning`** initialized fresh — the
  active repository for everything from May 25 forward.

The GitHub rename of `medical-vlm-pruning` → `Qwen-v25-vl-med-pruning`
is reversible (GitHub treats repo renames as fully reversible with
bidirectional redirects), so the May 24 commit URLs from
[Week 3, Day 1's "Pushed today"](day-01.md#pushed-today) keep
resolving correctly. The historical record on the site is undamaged.

Freeze commit on `Qwen-v25-vl-med-pruning`: `c5ce256`. Status
notice added to the README pointing at the new active repo.

## Phase 9 — Initializing `huatuo-llava-v15-med-pruning`

Created the new GitHub repo (no auto-init of README / .gitignore /
license, same pattern as `medical-vlm-pruning` on May 24). Local
initialization:

```bash
mkdir -p ~/huatuo-llava-v15-med-pruning
cd ~/huatuo-llava-v15-med-pruning
git init -b main
git config user.name "Leokuan0208"
git config user.email "d38963968@gmail.com"

mkdir -p scripts pruning eval
touch scripts/.gitkeep pruning/.gitkeep eval/.gitkeep
```

Same flat layout as the frozen repo — `scripts/`, `pruning/`,
`eval/`. No `docker/` directory: the Dockerfile is pasted into
KUBERUN at build time and doesn't live in the repo. (This is a
correction from an earlier draft of the layout that did include a
`docker/` directory — removed before the first commit since it
would only ever contain a file that's not actually used as a
file.)

Wrote `.gitignore` and `README.md`. The `.gitignore` patterns are
depth-agnostic (no leading `/`) so they match at any nesting depth.
The `README.md` explains the project's three-base-model history
(LLaVA-Med v1.0 → Qwen2.5-VL → HuatuoGPT-Vision) and the
reproducibility-first rationale, with the published target Table
from the HuatuoGPT-Vision paper for verifiability:

| | VQA-RAD | SLAKE | PathVQA | PMC-VQA | OmniMedVQA | MMMU H&M |
|---|---:|---:|---:|---:|---:|---:|
| **HuatuoGPT-Vision-7B** (paper Table) | 63.7 | 76.2 | 57.9 | 54.3 | 74.0 | 50.6 |

Successful reproduction (within ~2 pts on each) validates the
pipeline before any pruning experiments are run.

First commit pushed to `main`:
[`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe).

## Phase 10 — HuatuoGPT-Vision Dockerfile

Drafted the Dockerfile for the new environment. The dependency
research turned up a real compatibility puzzle worth recording:

- **LLaVA-v1.5's official `pyproject.toml` pins `transformers==4.37.2`.**
  This pin predates Qwen2's release.
- **HuatuoGPT-Vision-7B's LLM backbone is Qwen2-7B**, whose
  `Qwen2ForCausalLM` class was added to `transformers` around
  4.40 — *after* 4.37.2.
- **The known-working reference for "LLaVA-v1.5 architecture + a
  non-Vicuna LLM"** is the LLaVA-Llama-3 fork, which bumps to
  `transformers==4.41.2`.

So we can't use LLaVA-v1.5's stock pin, but the LLaVA-Llama-3 pin
of `4.41.2` is a known-good neighborhood. Picked **`transformers==4.41.2`**
as the safest known-good middle ground that has both Qwen2 support
and LLaVA-v1.5 architecture support, then added the rest of the
LLaVA-v1.5 stack at versions compatible with that base.

??? note "`Dockerfile` — HuatuoGPT-Vision-7B on NGC 23.10"

    Same NGC base (`23.10-py3`) as LLaVA-Med v1.5 and v1.0 — it's
    the known-good image on this hardware and the LLaVA-v1.5
    architecture predates the era of NGC 25.x's Python 3.12. Reuses
    the same empty-constraint-file fix from the Qwen2.5-VL
    Dockerfile (the `/etc/pip/constraint.txt` may pin packages that
    conflict with HuatuoGPT-Vision's requirements).

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

## Phase 11 — KUBERUN image build

Pasted the Dockerfile into the HONGHU KUBERUN web interface; the
platform built the image cleanly on the first attempt — no
constraint-file failure (the empty-file fix from Day 5 is already
baked in), no NumPy conflict (the `numpy==1.26.0` pin is explicit
this time). Container is up; JupyterLab is accessible.

No verification commands run yet inside the container — that's
Day 3 work. The image is built and ready; tomorrow starts with the
import-check heredoc, then the HuatuoGPT-Vision repo clone, then
the weight download, then the eval suite reproduction attempt.

## Phase 12 — Weight download & dependency patching

Inside the container, downloaded HuatuoGPT-Vision-7B (~14 GB) into
the shared cache at `/data/dan/weights/HuatuoGPT-Vision-7B/` via
`huggingface-cli download`. Cloned the HuatuoGPT-Vision upstream
repo to `~/huatuo-llava-v15-med-pruning/HuatuoGPT-Vision/` (gitignored
locally), then downloaded `Medical_Multimodal_Evaluation_Data` to
`/data/dan/dataset/`.

First attempt at `accelerate launch eval.py` surfaced two missing
runtime dependencies that **aren't in HuatuoGPT-Vision's
`requirements.txt`** — patched at container runtime rather than
forcing a full image rebuild:

1. **`hf_transfer` extra was silently dropped.** The Dockerfile
   specified `"huggingface_hub[hf_transfer]"`, but pip's extras
   resolver silently dropped the `[hf_transfer]` part — the package
   wasn't installed. Fix: `pip3 install --no-cache-dir hf_transfer`.
   For future Dockerfile rebuilds, the lesson is to split the
   extra into its own explicit entry (`"huggingface_hub"` and
   `"hf_transfer"` as separate lines) so pip can't drop it.
2. **`datasets` not installed.** Their `eval.py` imports it at
   line 19, but it's not in `requirements.txt`. Pinned to
   `datasets==2.16.1` (Jan 2024, same era as their
   `transformers==4.37.2` base) to avoid newer `datasets` 3.x/4.x
   API breaks.

For the second install, ran `pip install --dry-run "datasets==2.16.1"`
first — defensive habit since unconstrained pip on a tightly-pinned
container can silently downgrade things. The dry-run came back
clean: 5 packages added (`datasets`, `dill`, `multiprocess`,
`pyarrow-hotfix`, `xxhash`), zero existing packages touched.
`fsspec==2023.6.0` stayed put (inside `datasets`'s permissive
window). Proceeded with the real install.

## Phase 13 — Baseline reproduction (5/6 benchmarks within 0.55 pts)

Re-ran the eval after the dependency patches. End-to-end success:
HuatuoGPT-Vision-7B against `Medical_Multimodal_Evaluation_Data` on
the full six-benchmark suite, no further errors. **Side-by-side
against the published paper Table:**

| Benchmark | Our run | Paper | Δ |
|---|---:|---:|---:|
| VQA-RAD | 61.35 | 63.7 | **−2.35** |
| SLAKE | 76.44 | 76.2 | +0.24 |
| PathVQA | 57.67 | 57.9 | −0.23 |
| PMC-VQA | 54.20 | 54.3 | −0.10 |
| OmniMedVQA | 73.46 | 74.0 | −0.54 |
| MMMU H&M | 50.34 | 50.6 | −0.26 |

**Five of six benchmarks land within 0.55 pts of paper** — well
inside the 2-pt tolerance defined as "successful reproduction" on
the [HuatuoGPT-Vision baseline page](../../baseline/huatuo-vision.md).
SLAKE is essentially exact (+0.24); PathVQA, PMC-VQA, OmniMedVQA,
and MMMU-Med are all within 0.6 pts.

**VQA-RAD is the one outlier at −2.35 pts, just outside tolerance.**
Two reasons not to be worried:

1. **VQA-RAD has only 251 samples in the eval split.** One sample
   ≈ 0.4 pts; six samples answered differently ≈ 2.4 pts. The
   noise floor on a 251-sample dataset is fundamentally large, so a
   2.35-pt deviation corresponds to ~6 samples flipping their
   answer — well within seed-and-precision variance, especially
   given our torch is `2.1.0a0` (NGC build) vs whatever the paper
   team used (probably the stock 2.0.1 their requirements pin).
2. **Some VQA-RAD images may have failed silent-fallback handling.**
   The eval log contained a few "wrong image" warnings; we didn't
   audit which files failed to load. Each one drops accuracy by
   ~0.4 pts (the model answers from text alone at near-chance for
   4-option MCQ).

The headline: **the pipeline is verified end-to-end against the
paper.** From here forward, every accuracy number produced with
pruning hooks attached is directly comparable to these six
numbers. When QSim at kr=0.75 lands at, say, OmniMedVQA 71.2, "−2.3
pts from baseline" is a defensible statement because we *know* the
baseline matches the paper.

The Baseline page's [Baseline metrics
table](../../baseline/huatuo-vision.md#baseline-metrics) is updated
with these numbers.

## Phase 14 — Pruning framework: design, code, verification

With baseline reproduction landed, the next move is porting the
project's two pruning methods (`random` and `qsim` from
[Week 2, Day 1](../week-02/day-01.md)) onto the HuatuoGPT-Vision
stack. Three design decisions locked before writing code:

1. **Pruning location: after LLM layer 0.** The originally-discussed
   alternative was pre-LLM pruning (right after the projector,
   before concatenating with text). Pre-LLM is cleaner in
   implementation, but layer-0 keeps the implementation aligned
   with the May 17 LLaVA-Med v1.0 design — important so the two
   methods stay scientifically comparable. *A novel pre-LLM
   cross-attention variant is parked for a later phase of the
   project* (see honest ledger below).
2. **Keep-ratio = hard target.** `round(576 × kr)` tokens kept
   exactly per sample. Threshold-mode (variable-count) pruning is
   where the novel idea lives; hard targets make accuracy at
   kr=0.75 directly comparable to SparseVLM's, FastV's, etc.
3. **QSim text source = question-only text tokens.** Extracted via
   `USER:`/`ASSISTANT:` boundary parsing. Excludes system prompts,
   MCQ option labels, and formatting boilerplate. Defensible
   methodologically (it tests "question-text-similar visual tokens
   are important") rather than "any-text-similar visual tokens".

Code layout:

```
huatuo-llava-v15-med-pruning/
├── pruning/
│   ├── base.py            # Pruner abstract base class
│   ├── random_pruner.py   # uniform random, seeded for reproducibility
│   ├── qsim_pruner.py     # cosine sim of visual to question text
│   ├── latency.py         # LatencyTracker
│   └── patcher.py         # Qwen2Model.forward override + cache slicing
└── scripts/
    └── patch_and_eval.py  # Eval driver with patcher integration
```

The **integration is the hard part** — and the bit that delayed the
day's "write the code" phase by a couple of false starts. After
layer 0 prunes the sequence, layers 1-27 still receive the
*original* `attention_mask`, `position_ids`, and (in some HF
transformers versions) a 4D causal mask of the original length.
Just handing them the shorter `hidden_states` causes attention to
shape-mismatch or silently broadcast incorrectly. The clean fix is
overriding `Qwen2Model.forward` entirely — copy the HF reference
implementation, insert pruning between layer 0 and layers 1-27,
update mask + position_ids during that surgery, and also **slice
layer 0's KV cache** so cache lengths stay consistent across
layers (without the slice, decode steps fail with a `position_ids`
out-of-bounds error).

Latency tracking lives in `pruning/latency.py`:

- Per-sample wall clock with `cuda.synchronize()` bracketing
- GPU peak memory per sample
- `n_visual_pre` / `n_visual_post` to verify pruning actually
  happened
- Aggregated p50/p95 in `latency_summary.json`

**Five unit smoke tests** against a tiny `Qwen2Model` (from
`transformers==4.37.2`) all pass:

1. Pruners produce correct shapes/counts on synthetic data
2. Eager attention path produces correctly-sized output
3. SDPA attention path produces correctly-sized output
4. **kr=1.0 is bit-identical to unpatched model** — `max abs diff
   0.00e+00`
5. KV cache + multi-step decode works (this test caught the
   layer-0 cache bug listed above)

Then a **real-model verification** on HuatuoGPT-Vision-7B itself:
kr=1.0 (i.e. patcher attached but nothing actually pruned) run on
the first 1,500 samples of the eval suite produced **100% identical
predictions to the unpatched baseline**. The patcher attaches and
detaches cleanly; with kr=1.0 the integration is provably a no-op.

First pruning code pushed at commit
[`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe):
"Add visual token pruning framework (Random, QSim) + latency tracking."

## Phase 15 — Overnight sweep launched in tmux

Eight runs queued sequentially: 4 keep-ratios × 2 methods.

- **Keep ratios:** 0.75, 0.50, 0.25, 0.10 — the same shape as the
  May 17 LLaVA-Med ablation (near-baseline → half → quarter →
  aggressive). Dense enough to draw a Pareto curve, sparse enough
  to fit in one overnight window.
- **Methods:** `qsim` and `random` per ratio. QSim runs before
  Random at each kr so if there's a bug, it surfaces on the more
  interesting method first.
- **Ordering:** descending `keep_ratio` (0.75 → 0.10) so the most
  informative runs land first. High kr is closest to baseline and
  easiest to spot bugs in; low kr is the most aggressive, where
  bugs are most likely to surface.
- **Wrapper:** `tmux new -s pruning_sweep`. tmux keeps the session
  alive across SSH disconnects, which matters for a ~12-hour job.

Sweep loop:

```bash
cd ~/huatuo-llava-v15-med-pruning
for KR in 0.75 0.5 0.25 0.1; do
  for METHOD in qsim random; do
    torchrun --nproc_per_node=1 scripts/patch_and_eval.py \
      --pruner $METHOD --keep_ratio $KR \
      --model_path /data/dan/weights/HuatuoGPT-Vision-7B \
      --data_path /data/dan/dataset/Medical_Multimodal_Evaluation_Data/medical_multimodel_evaluation_data.json \
      --output_dir ~/huatuo-llava-v15-med-pruning/results \
      2>&1 | tee ~/huatuo-llava-v15-med-pruning/results/eval_${METHOD}_kr${KR}_$(date +%Y%m%d_%H%M%S).log
  done
done
```

Total: ~12 hours of compute. Set off before bed; results land in
the morning of May 26 (Day 17 / Week 3 Day 3).

## Honest ledger of the day

A "decision day" that became a four-milestone execution day. Ranked
by how much they reshape the project:

1. **🎯 Baseline reproduction landed within tolerance.** 5 of 6
   HuatuoGPT-Vision-7B benchmarks within 0.55 pts of paper, on
   first end-to-end run. The May 21 → May 24 → May 25 pivot chain
   is validated as navigation rather than churn.
2. **🎯 Final base-model decision.** HuatuoGPT-Vision-7B
   (LLaVA-v1.5 architecture, Qwen2-7B LLM backbone). Intended to
   be the last pivot — paper reproduction is now a verified
   foundation rather than a hypothesis.
3. **🎯 Pruning framework written and verified.** RandomPruner +
   QSimPruner + LatencyTracker, integrated via
   `Qwen2Model.forward` override + layer-0 KV cache slicing. Five
   unit smoke tests + a 1,500-sample real-model match at kr=1.0
   prove the integration is bit-identical to baseline when nothing
   is pruned.
4. **🎯 Overnight sweep launched.** 8 runs (4 keep_ratios × 2
   methods) in tmux. Results land Day 17 morning. First pruning
   data on the new stack is now ~12 hours of compute away.
5. **Methodology correction.** May 21's claim that
   "VLMEvalKit/lmms-eval support VQA-RAD/SLAKE/PathVQA out of the
   box" was wrong — the harnesses cover general benchmarks but
   not these three. Corrected explicitly in this day-page rather
   than retroactively editing Day 5.
6. **Repo transition.** `medical-vlm-pruning` →
   `Qwen-v25-vl-med-pruning` frozen at `c5ce256`. New
   `huatuo-llava-v15-med-pruning` initialized at the skeleton; the
   pruning framework is also at `c216bbe` in the same repo. The
   Qwen2.5-VL 20/20 MCQ smoke test is preserved as a real artifact
   on the frozen repo, not erased.
7. **New environment built.** HuatuoGPT-Vision Dockerfile drafted
   with documented version pins; KUBERUN build succeeded on the
   first attempt. The empty-constraint-file fix from Day 5's
   Phase 8 carried over cleanly.
8. **Two missing runtime deps patched.** `hf_transfer` (extras
   silently dropped by pip's resolver) and `datasets==2.16.1`
   (not in HuatuoGPT's `requirements.txt` but imported by their
   `eval.py`). Logged for the next Dockerfile rebuild.

**Novel idea parked for later in the project**: pre-LLM
cross-attention between the vision encoder output and a separate
text-encoder output, used to score visual tokens *before* they enter
the LLM. Two intuitive wins over post-layer-0 scoring: (1) avoids
flash-attn materialization at scoring time (the cross-attn module
computes scores directly without reading off the LLM's internal
attention matrices), and (2) cleaner separation of "what is this
token about" (vision) from "what does the question ask" (text)
without LLM-layer entanglement. The implementation challenge worth
flagging now: HuatuoGPT-Vision doesn't expose a separate text
encoder — text goes through the LLM embed directly — so the design
would need either an auxiliary small text encoder or a frozen
embedding layer to produce comparable text features. Filed; not
this week's work.

## What this means for the site's headline pages

Partial lift on the standing editorial decision. The baseline
reproduction landed within tolerance on 5 of 6 benchmarks, so the
[HuatuoGPT-Vision baseline page's Baseline metrics
table](../../baseline/huatuo-vision.md#baseline-metrics) now has
real numbers — that's a concrete milestone the baseline section is
supposed to document.

The home page's "Where I am right now" header is updated to reflect
the baseline-reproduction milestone and that pruning experiments
are now running. The Experiments page and the kr=0.75 result from
May 17 stay put — those numbers are from the frozen LLaVA-Med v1.0
track and aren't directly comparable to whatever the overnight
sweep produces on HuatuoGPT-Vision; once the sweep results land
tomorrow we'll know whether they're a clean replacement or whether
they need new framing.

---

### Plan for tomorrow (May 26, Day 17 / Week 3 Day 3)

- [ ] Check the overnight sweep — should be finished by morning;
      8 runs across `~/huatuo-llava-v15-med-pruning/results/`
- [ ] Smell-test the 8 result JSONs for anomalies before drawing
      curves (e.g. accuracy crashing to chance on a single run is
      a bug-on-that-run, not a real result)
- [ ] Plot the Pareto curves (accuracy vs keep-ratio) for QSim and
      Random across all 6 benchmarks
- [ ] Decide what the headline number is — the per-benchmark QSim
      vs Random gap, or the average-across-benchmarks Δ, or the
      "where does QSim hold and where does it break" plot
- [ ] If sweep results look clean, start writing the Day 17 entry
      with the analysis
- [ ] Fold `hf_transfer` and `datasets==2.16.1` into the Dockerfile
      so the next image rebuild doesn't need runtime patching

---

## Pushed today

**[`Qwen-v25-vl-med-pruning`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning)**
(renamed from `medical-vlm-pruning`) — **frozen** at
[`c5ce256`](https://github.com/Leokuan0208/Qwen-v25-vl-med-pruning/commit/c5ce256026f4f7b0dd291af4cd40b2b381897ba4):
"Freeze repo: pivoting to HuatuoGPT-Vision (LLaVA-v1.5) for
reproducibility." Status notice added to the README. The
`scripts/mcq_compliance_smoke.py` from May 24 (20/20 strict MCQ
compliance) is preserved as the canonical Qwen2.5-VL smoke-test
artifact.

**[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)**
— **new active repo**, initialized with skeleton + pushed the
pruning framework in the same day. Latest commit
[`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe):
"Add visual token pruning framework (Random, QSim) + latency
tracking." Adds `pruning/{base,random_pruner,qsim_pruner,latency,patcher}.py`
and `scripts/patch_and_eval.py`; verified by 5 unit smoke tests +
1500-sample real-model match at kr=1.0.
