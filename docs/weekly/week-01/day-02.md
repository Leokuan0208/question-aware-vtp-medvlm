# Day 2 — Monday, May 11, 2026

[← Back to Week 1 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 1, Day 2 · **Day 2 of the project**

---

Hardware came online today and the environment got built end-to-end,
ending with the first real bug of the project.

## Environment build

Wrote the Dockerfile (based on `nvcr.io/nvidia/pytorch:23.10-py3`),
built the image via the HONGHU KUBERUN interface, and brought up the
A100 80GB PCIe VM with JupyterLab. Then:

- Cloned LLaVA-Med v1.5.
- Ran `pip install -e . --no-deps` to install the package editable
  without letting pip touch the carefully pinned NGC dependency stack.
- Downloaded the `llava-med-v1.5-mistral-7b` weights (~15 GB) to
  `/data/dan/weights/`.

## First inference attempt — and the CLI bug

The first CLI inference attempt produced **single-word responses**
instead of the expected paragraphs. After a long troubleshooting
trail — every hypothesis tried and eliminated in order — this was
root-caused to a stop-string selection bug in `llava/serve/cli.py`
that fails to handle `SeparatorStyle.LLAMA_2` (the style used by
`mistral_instruct`). The `KeywordsStoppingCriteria` was halting on the
very first generated token because the empty string is trivially
present in any output.

Patched locally with:

```python
stop_str = conv.sep2 if conv.sep_style in (SeparatorStyle.TWO, SeparatorStyle.LLAMA_2) else conv.sep
```

After the patch, the CLI returns full multi-turn medical responses.
The full troubleshooting trail is written up in
[Bugs & Issues #1](../../bugs.md#1-llavaservecli-stops-generation-immediately-for-the-mistral-variant).

## Snippet to remember

```bash
# The minimum-viable end-to-end inference command, post-patch:
cd ~/LLaVA-Med
python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct
```
