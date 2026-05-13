# Week 1 — Baseline setup & first contact

<span class="pill pill--wip">In progress</span>

**Phase 1 of 7** (Baseline & Literature) · **Week 1 of 2 in this phase**

**Goal of the week** — get the LLaVA-Med baseline running end-to-end,
document the environment reproducibly, find and fix any blockers, and
start reading the visual-token-pruning literature.

## Summary so far

- Dockerfile authored and image built on HONGHU KUBERUN (NGC PyTorch
  23.10 base, all LLaVA-Med pinned deps, flash-attn 2.3.6 from source).
- Stack sanity-check passes: PyTorch 2.1, CUDA 12.2, A100 80GB PCIe
  visible, transformers / accelerate / peft / bitsandbytes / flash-attn
  all importable.
- LLaVA-Med cloned, editable-installed, model weights downloaded
  (~15 GB) to `/data/dan/weights/llava-med-v1.5-mistral-7b/`.
- Discovered a moderate bug in `llava/serve/cli.py`: stop-criterion
  selection truncates Mistral-template generation to a single token.
- Patched the bug; CLI now returns full multi-turn medical responses.
- Bug write-up filed in [Bugs & Issues](../bugs.md), patch ready for
  upstream PR.
- This documentation site set up and deployed.

---

## Day 1 — Sunday, May 10, 2026

Environment setup day. Goal: have a working container with the right
PyTorch/CUDA/flash-attn versions, with GPU and `/data` both visible.

### Container build

Drafted a Dockerfile targeting `nvcr.io/nvidia/pytorch:23.10-py3` and
adding:

- Ubuntu packages: `git`, `git-lfs`, `python3-pip`.
- JupyterLab (required by the KUBERUN VM launch interface).
- LLaVA-Med's pinned Python dependencies in one `pip install` layer.
- `flash-attn==2.3.6 --no-build-isolation` (compiled from source —
  the slow step, roughly 15 minutes).

Full Dockerfile is in [Baseline (LLaVA-Med)](../setup.md#the-dockerfile).

### `/data` mount not visible in JupyterLab — fix

After the first build, `/data` was reachable by `cd /data` but didn't
appear in the JupyterLab file browser sidebar. Root cause: Jupyter only
shows files underneath its starting directory, and the KUBERUN
container starts inside `/root` while `/data` is at the filesystem
root.

Fix: added `RUN ln -s /data /root/data` to the Dockerfile and rebuilt.
The flash-attn layer cached, so the rebuild finished in under a minute.
`~/data` then showed up in the sidebar as expected.

### Stack sanity check

Ran a Python one-liner that imports torch, transformers, accelerate,
peft, bitsandbytes, flash-attn, and confirms the `flash_attn_varlen`
API. Full script and expected output are in
[Baseline (LLaVA-Med)](../setup.md#2-sanity-check-the-stack).

**First gotcha — `AttributeError: module 'bitsandbytes' has no
attribute '__version__'`.** bitsandbytes 0.41.0 doesn't expose
`__version__` as a module attribute. Switched to
`importlib.metadata.version('bitsandbytes')`, which reads pip metadata
directly. Lesson: `__version__` is a convention, not a guarantee — for
robust version checks across packages, use `importlib.metadata`.

Confirmed GPU is **NVIDIA A100 80GB PCIe** (PCIe variant, not SXM4 — the
form factor matters for inter-GPU bandwidth but is irrelevant on a
single card).

## Day 2 — Monday, May 11, 2026

The "actually run the model" day. Cloned the repo, downloaded weights,
got inference going, found and fixed the CLI bug.

### Code install

```bash
cd ~
git clone https://github.com/microsoft/LLaVA-Med.git
cd LLaVA-Med
pip install -e . --no-deps
```

`pip show llava_med` confirmed `Version: 1.5.0` and editable install
pointing at `/root/LLaVA-Med/llava/`.

### Model weight download

`/data` is shared, so created `/data/dan/` as a personal namespace
with `weights/` and `dataset/` subfolders. Verified writability with
`touch /data/dan/weights/.write_test && rm` — passed.

```bash
cd /data/dan/weights
git lfs install
git clone https://huggingface.co/microsoft/llava-med-v1.5-mistral-7b
```

End state: 3 safetensors shards (~5 GB each, total 15 GB), index file,
tokenizer files. Confirmed with `du -sh` and `ls -lh`.

### First inference attempt

Originally tried the upstream LLaVA entry point:

```bash
python -m llava.eval.run_llava \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./images/xray.jpg \
    --query "Describe this medical image."
```

Got `No module named llava.eval.run_llava` — LLaVA-Med doesn't ship
that module (it's upstream-only). Switched to `llava.serve.cli` (the
interactive equivalent).

Also discovered that the `./images/` directory only contains paper
branding assets (logos, pipeline diagrams). The actual sample
biomedical images live in `./llava/serve/examples/`. Used
`bio_patch.png` from there.

### The CLI bug

CLI loaded the model cleanly but produced **single-word responses** to
every question. Full diagnostic trail is in
[Bugs & Issues #1](../bugs.md#1-llavaservecli-stops-generation-immediately-for-the-mistral-variant).

In one paragraph: the stopping-criteria construction in `cli.py` does

```python
stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
```

For the `mistral_instruct` template, `sep_style` is `LLAMA_2` and `sep`
is the empty string, so `stop_str = ''`. The
`KeywordsStoppingCriteria` halts on the first generated token because
the empty string is trivially present in any output. Patched with:

```python
stop_str = conv.sep2 if conv.sep_style in (SeparatorStyle.TWO, SeparatorStyle.LLAMA_2) else conv.sep
```

After the patch, the CLI returns full multi-turn medical responses.

### Snippet to remember

```bash
# The minimum-viable end-to-end inference command, post-patch:
cd ~/LLaVA-Med
python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct
```

## Day 3 — Tuesday, May 12, 2026

Set up this documentation site with MkDocs + Material. Started a
reading list for the visual-token-pruning literature (ToMe, FastV,
PruMerge, SparseVLM, GAP) and dropped them into
[Resources](../resources.md).

## Day 4 — Wednesday, May 13, 2026 &nbsp; _(today)_

- Wrote up the CLI bug formally in `bugs.md` with the full
  troubleshooting trail per advisor-friendly bug-report conventions.
- Populated the site with real environment details and the actual
  commands run during setup.
- Confirmed that the visual encoder in LLaVA-Med v1.5 (Mistral) uses
  CLIP ViT-L/14 at 336² → 576 tokens per image, matching the
  assumptions in the project plan.

### Plan for the rest of the week (May 14 – May 16)

- [ ] File the CLI fix upstream on `microsoft/LLaVA-Med` (issue + PR).
- [ ] Read ToMe end-to-end; take structured notes in `resources.md`.
- [ ] Skim FastV (closest prior art) to understand their pruning
      insertion point inside the LM.
- [ ] Skim SparseVLM (text-aware pruning, closest in *spirit* to this
      project).
- [ ] Skim GAP (position-ID correction after token drop — important
      for RoPE-based Mistral).
- [ ] Sketch the Week 2 plan: profile the baseline (latency, VRAM,
      token-count breakdown), locate the visual-token pipeline in the
      LLaVA-Med code, identify candidate pruning insertion points.

---

## Reflections (end-of-week)

_Write this at the end of the week. A few sentences on what went well,
what was harder than expected, what to do differently next week. The
cumulative habit is the highest-value thing in a research log._
