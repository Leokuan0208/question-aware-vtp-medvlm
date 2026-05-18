# Week 1 — Baseline setup & first contact

<span class="pill pill--done">Complete</span>

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

### [Day 7 — Saturday, May 16, 2026](day-07.md)

The most substantive day so far. Rebuilt a clean v1.0 Docker image,
finished the v1.0 harness (model_loader, runner, metrics) and pushed
it to GitHub at
[`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1).
The headline finding: **all three published per-dataset fine-tuned
delta weights are unusable** — VQA-RAD-merged scored 0.21 closed vs.
paper's ~0.84, PathVQA the same pattern, SLAKE delta is an empty repo
on HuggingFace. Differential diagnosis via the **stage-2 zero-shot
checkpoint reproduced the paper's stage-2 row (0.58 closed, within 8
pts of ~0.50)**, validating the entire harness. The reproducibility
gap is upstream in v1.0's public release. Three new bug entries on
the project: the trailing assistant-role prompt bug
(→ [Bug #4](../../bugs.md#4-llava-med-v10s-model_vqa_medpy-missing-trailing-assistant-role)),
the broken-deltas reproducibility finding
(→ [Bug #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)),
and a corrected memory-budget analysis for 8-bit AdamW
(→ [Bug #6](../../bugs.md#6-wrong-memory-accounting-for-8-bit-adamw)).
Built a DeepSpeed Zero-2 full-FT pipeline through 8 troubleshooting
iterations; it didn't launch tonight (one activation-policy fix away)
and rolls into Week 2.

---

## End-of-week status

Week 1 closes here (May 16 is Saturday; Week 2 starts tomorrow). All
Week-1-scope items completed except the literature reading, which
genuinely slipped — that's the one thing to carry into Week 2 as
explicit priority.

**Items completed during Week 1:**

- [x] LLaVA-Med v1.5 baseline running end-to-end with verified inference
- [x] CLI stop-string bug found, root-caused, patched
      (→ [Bug #1](../../bugs.md#1-llavaservecli-stops-generation-immediately-for-the-mistral-variant))
- [x] Documentation site live at
      [leokuan0208.github.io/question-aware-vtp-medvlm](https://leokuan0208.github.io/question-aware-vtp-medvlm/)
- [x] First read-pass of `prepare_inputs_labels_for_multimodal`
- [x] Evaluation harness scaffolded then completed across all 11 files
      (`llava-med-pruning` on GitHub) — VQA-RAD path verified bit-for-bit
      against reference `model_vqa.py`
- [x] All three benchmark datasets downloaded and verified
- [x] `answer_type` mislabeling bug fixed
      (→ [Bug #3](../../bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions))
- [x] **Complete v1.5 baseline row banked** —
      VQA-RAD 0.537 / SLAKE 0.587 / PathVQA 0.587 closed
      (→ [Experiments](../../experiments.md#e00-baseline-no-pruning-v15))
- [x] Strategic pivot to LLaVA-Med v1.0 reasoned through with the
      complete v1.5 row in hand
- [x] Fresh v1.0 Docker image built (replaces yesterday's failed venv)
- [x] v1.0 evaluation harness completed — model loader, runner,
      metrics — and pushed to
      [`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
- [x] v1.0 stage-2 zero-shot baseline reproduces the paper (0.58
      closed vs paper's ~0.50)
- [x] **All three published v1.0 per-dataset fine-tuned delta weights
      confirmed unusable** — VQA-RAD/PathVQA both score 0.21 vs paper's
      0.84/0.91; SLAKE delta is an empty repo
      (→ [Bug #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible))
- [x] Full-FT pipeline at ~95% — scripts, candidate sets, DeepSpeed
      Zero-2 config — one activation-policy fix away from launch

**Items rolling into Week 2:**

- [x] DeepSpeed activation-checkpointing setting fixed (Day 7 carry-over)
- [ ] **5-epoch VQA-RAD full FT launched** — running as a first pass
      to gauge wall time and accuracy trajectory before committing to
      the paper's 15-epoch best-performance setting
- [ ] Read ToMe end-to-end; take structured notes in
      [resources.md](../../resources.md) (slipped four days; explicit
      Week-2 priority)
- [ ] Skim FastV (closest prior art), SparseVLM (question-aware
      pruning), GAP (position-ID correction after token drop)
- [ ] Run E0_v1.0 on all three datasets against the stage-2 merged
      model — produces a v1.0 baseline row directly comparable to
      the v1.5 row already on the Experiments page
- [ ] Begin Phase 2 of the project plan: codebase deep-dive with
      print-statement instrumentation on
      `prepare_inputs_labels_for_multimodal`
- [ ] File the CLI fix upstream on `microsoft/LLaVA-Med` (deferred
      throughout Week 1; consider grouping with the Bug #4 PR)

---

## Reflections (end-of-week)

Week 1 was supposed to be "get the baseline running and read some
papers." It became something quite different. The baseline ran on
Day 2; the rest of the week was building infrastructure (an
evaluation harness, then a second evaluation harness) and chasing a
gap to published numbers that turned out to be a real reproducibility
problem with the upstream release. The literature reading didn't
happen, and that's the biggest miss.

**What worked.** Documenting troubleshooting in detail as we went
made the bug-page entries genuinely useful — Bug #2 (the
`--force-reinstall` regression) and Bug #5 (the broken deltas) both
needed careful reasoning that would have been impossible to
reconstruct days later. The discipline of one harness file per
batch, isolation-test before integration, paid off when the
`answer_type` bug surfaced.

**What was harder than expected.** Environment work on someone
else's container kept biting — the `pip --force-reinstall`
regression on Day 4, the v1.0 venv ABI battle on Day 6, the
DeepSpeed/pydantic/transformers three-way version conflict on Day 7.
Three of seven days lost meaningful time to "the env isn't right."
The Dockerfile-first approach (used on Day 7) is the way forward;
in-place pip patching of a pinned environment is not.

**What to do differently in Week 2.** Carve out a *fixed* block of
each day for literature reading, decoupled from the engineering work.
A "no reading happens until X engineering task lands" framing was a
mistake — the engineering kept expanding and the reading never
started.
