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

### [Day 6 — Friday, May 15, 2026](day-06.md)

Finished Batch 3 (SLAKE + PathVQA loaders) and completed the v1.5
baseline row — SLAKE closed 0.587, PathVQA closed 0.587. With all
three numbers side-by-side, the 24-32 point gap to published v1.0
fine-tuned figures made the case to pivot: **switching to LLaVA-Med
v1.0's per-dataset fine-tuned delta weights** is faster than
fine-tuning v1.5 ourselves. Forked the harness to
`~/llava-med-pruning-v1`, ran the VQA-RAD delta-merge successfully
(~13 GB merged model), wrote v1.0's `model_loader.py` — then lost
the evening to a torch/numpy ABI battle in the v1.0 venv. Server
crashed before any push.

---

## Plan for the rest of the week (May 16)

- [ ] Bring up a fresh container from the v1.0 Dockerfile draft —
      avoids the in-place pip patching that bit the env yesterday.
- [ ] Push the locally-banked `~/llava-med-pruning-v1` scaffold to a
      new GitHub repo (didn't push yesterday — server crashed).
- [ ] Finish the v1.0 harness adaptations: `eval/metrics.py`
      (candidate-set argmax classification), `eval/runner.py` (v1.0
      prompt with `<im_patch>×256`, stop-string `'###'`,
      `temperature=0.7`), and the `train_open_answers.json`
      candidate-set builder.
- [ ] Run E00 against the merged VQA-RAD-fine-tuned model — the real
      v1.0 baseline, comparable directly to the ~0.84 published
      figure.
- [ ] Investigate the missing SLAKE delta on HuggingFace, or accept
      that the SLAKE v1.0 track is blocked.
- [ ] Read ToMe end-to-end; take structured notes in `resources.md`
      (slipped two days — still the next-most-important thing once
      v1.0 is moving).
- [ ] Address the `closed_ended_accuracy` scoring-leniency issue
      (deferred — likely supplanted by the new candidate-set scoring
      coming from the v1.0 work).
- [ ] File the CLI fix upstream on `microsoft/LLaVA-Med` (still
      deferred; not blocking).

---

## Reflections (end-of-week)

_Write this at the end of the week. A few sentences on what went well,
what was harder than expected, what to do differently next week. The
cumulative habit is the highest-value thing in a research log._
