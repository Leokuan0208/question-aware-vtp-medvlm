# Week 1 — Baseline setup & first contact

<span class="pill pill--wip">In progress</span>

**Phase 1 of 7** (Baseline & Literature) · **Week 1 of 2 in this phase**

**Goal of the week** — get the LLaVA-Med baseline running end-to-end,
confirm we can do inference, document the setup reproducibly, and start
reading the visual-token-pruning literature.

This page is the **overview** — a short summary of each day. Click any
day's heading to open its full detail page, which has the complete
notes, code, troubleshooting trails, and the day's git push.

---

### [Day 1 — Sunday, May 10, 2026](day-01.md)

Project kick-off. Read the LLaVA-Med paper end-to-end, drafted the
12-week project plan, and oriented in the codebase. Pure preparation —
no commands run yet.

### [Day 2 — Monday, May 11, 2026](day-02.md)

Hardware online. Built the Docker image, brought up the A100 VM,
cloned LLaVA-Med, and downloaded the `llava-med-v1.5-mistral-7b`
weights. First inference attempt surfaced a CLI stop-string bug —
root-caused and patched locally (→ [Bug #1](../../bugs.md#1-llavaservecli-stops-generation-immediately-for-the-mistral-variant)).

### [Day 3 — Tuesday, May 12, 2026](day-03.md)

Set up this documentation site locally with MkDocs + Material, picked
the structure and palette, and started the visual-token-pruning
reading list. Hit and fixed the PowerShell execution-policy gotcha
that was sending `pip install` to the wrong Python.

### [Day 4 — Wednesday, May 13, 2026](day-04.md)

A long day: wrote up the CLI bug formally, deployed the site to GitHub
Pages, did a first read-through of the LLaVA-Med architecture
(`prepare_inputs_labels_for_multimodal`, 576 visual tokens per image),
decided to skip the full v1.0 reproduction, scaffolded the evaluation
harness, and downloaded all three benchmark datasets — surviving a
`pip --force-reinstall` regression that briefly broke the container
(→ [Bug #2](../../bugs.md#2-pip-install-force-reinstall-cascaded-and-clobbered-the-ngc-pinned-stack)).

### [Day 5 — Thursday, May 14, 2026](day-05.md)

Implemented the evaluation harness end-to-end for the VQA-RAD path,
then spent most of the day tracing a ~29-point baseline-vs-literature
gap — concluding (via the reference `model_vqa.py`) that the harness
is correct and the gap is evaluation methodology. Found and fixed an
`answer_type` labeling bug (→ [Bug #3](../../bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions)),
banked the E00 baseline (closed 0.537, open recall 0.340), and put the
harness under git version control.

---

## Plan for the rest of the week (May 15 – May 16)

- [ ] Read ToMe end-to-end; take structured notes in `resources.md`.
- [ ] Skim FastV (closest prior art) to understand their pruning
      insertion point inside the LM.
- [ ] Skim SparseVLM (text-aware pruning, closest in *spirit* to this
      project).
- [ ] Skim GAP (position-ID correction after token drop — important
      for RoPE-based Mistral).
- [ ] **Batch 3** — implement the SLAKE and PathVQA dataset loaders
      (the last two harness stubs), then run E00 on all three
      benchmarks for a complete baseline row.
- [ ] Address the `closed_ended_accuracy` scoring-leniency issue —
      now a clean, isolated task (whole-word match is too lenient
      toward verbose answers).
- [ ] Resume the architecture deep-dive: do the print-statement
      instrumentation exercise on `prepare_inputs_labels_for_multimodal`
      to verify the 576-visual-tokens-at-contiguous-positions
      assumption with our own eyes.
- [ ] File the CLI fix upstream on `microsoft/LLaVA-Med` (deferred
      from earlier in the week; not blocking).

---

## Reflections (end-of-week)

_Write this at the end of the week. A few sentences on what went well,
what was harder than expected, what to do differently next week. The
cumulative habit is the highest-value thing in a research log._
