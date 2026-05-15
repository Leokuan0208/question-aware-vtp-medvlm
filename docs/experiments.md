# Experiments

Running log of pruning experiments. Each experiment gets a short ID
(e.g. `E01`, `E02`) and follows the same template so they're easy to
compare.

!!! note "When to log an experiment"
    Anything you train, fine-tune, or benchmark gets an entry — even
    failed runs. Especially failed runs. The first ablation you'll wish
    you'd documented is the one you didn't.

## Evaluation harness

All experiments are run through a shared harness at
`~/llava-med-pruning/` (separate repo from LLaVA-Med itself, to keep
the pruning work cleanly isolated). The code is on GitHub at
[Leokuan0208/llava-med-pruning](https://github.com/Leokuan0208/llava-med-pruning).
Design decisions:

- **CLI** — `argparse` (over Hydra). Hydra is more powerful but adds a
  config-system learning curve I don't need for a 12-week project.
- **Output format** — JSON for the summary metrics of each run, plus
  JSONL with one line per sample (for error analysis and re-aggregation
  later).
- **Pruning interface** — `PruningMethod` with `attach(model)` and
  `detach(model)` lifecycle hooks, so a single evaluation run can swap
  pruning strategies without reloading the 15 GB model.
- **Datasets handled** — VQA-RAD, SLAKE (English-only), PathVQA.

Status (May 15, 2026): **Batch 3 complete — all 11 harness files
implemented and verified.** The full v1.5 baseline row is banked
across all three benchmarks (see E00 below). A sibling harness
`~/llava-med-pruning-v1` (forked from this one) is in early scaffold
state for the LLaVA-Med v1.0 reproduction track — see the
[v1.0 reproduction note](#on-the-v10-reproduction-track) at the
bottom of this page.

## Summary table

| ID  | Date | Pruning strategy | K (drop %) | VQA-RAD acc | SLAKE acc | PathVQA acc | Notes |
| --- | ---- | ---------------- | ---------- | ----------- | --------- | ----------- | ----- |
| E00 | May 14–15 | None (baseline, v1.5) | 0% | 0.537 closed / 0.340 open | 0.587 closed / 0.395 open | 0.587 closed / 0.106 open | v1.5 reference row complete; per-dataset latency 843 / 788 / 1073 ms |
| E01 | _TBD_ | _e.g. random_    | _25%_      | _TBD_       | _TBD_     | _TBD_       | Sanity floor |
| E02 | _TBD_ | _e.g. attention-based_ | _25%_ | _TBD_     | _TBD_     | _TBD_       | Question-agnostic baseline |
| E03 | _TBD_ | _Question-conditioned MLP v1_ | _25%_ | _TBD_ | _TBD_ | _TBD_       | First real attempt |

The cells in italics get filled in as we go. **E00** and **E01** (the
baseline and the random-pruning sanity floor) are the two reference
points every later experiment should beat.

---

## E00 — Baseline (no pruning, v1.5)

<span class="pill pill--done">Complete</span>

**Goal** — establish the reference accuracy and latency numbers we'll
compare every pruning experiment against. No model changes.

**Setup**
- Model: LLaVA-Med v1.5 (Mistral-7B), off-the-shelf weights, frozen
- Datasets: VQA-RAD test (451 samples), SLAKE English test (1,061),
  PathVQA test (6,719) — total 8,231 test questions across the row
- Hardware: see [Baseline (LLaVA-Med)](setup.md#hardware)
- Pruning method: `BaselineMethod` (no-op — runs the model unmodified)
- Decoding: single-turn, greedy (`temperature = 0.0`)

**Results**

| Dataset | Closed acc | Open recall | Overall | Mean latency | Peak GPU |
| --- | --- | --- | --- | --- | --- |
| VQA-RAD | 0.537 | 0.340 | 0.459 | 842.5 ms | 14.86 GiB |
| SLAKE (English) | 0.587 | 0.395 | 0.470 | 787.9 ms | 14.86 GiB |
| PathVQA | 0.587 | 0.106 | 0.347 | 1072.9 ms | 14.86 GiB |

**Notes**

- **Closed-accuracy clustering at 0.587 (SLAKE and PathVQA).** Both
  datasets' closed questions are almost entirely yes/no, so they
  produce essentially the same yes/no performance on this model —
  not a coincidence, but a structural signal that the model isn't
  doing anything dataset-specific for closed questions.
- **Open recall drops sharply on PathVQA** (0.106 vs. 0.340 / 0.395).
  PathVQA's open answers are long descriptive phrases
  (`'thick with abundance of eosinophilic cytoplasm'`) where
  multi-word token recall is intrinsically harder — same metric, very
  different dataset difficulty. Not an indictment of the model.
- **Latency varies with image size, not benchmark.** PathVQA's
  heterogeneous and larger images add ~36% to the mean latency vs.
  SLAKE's uniform 512×512. The image processor's resize step is the
  bottleneck.
- **Peak GPU memory identical across all three** (14.86 GiB) —
  memory is dominated by model weights, not data. Useful to know:
  the memory savings from pruning experiments will come from
  sequence-length reduction, not data loading.
- **On the literature gap.** Published figures for LLaVA-Med v1.0
  (fine-tuned per dataset) sit at ~0.84 closed for VQA-RAD,
  ~0.83 for SLAKE, ~0.91 for PathVQA — 24-32 points above the v1.5
  zero-shot numbers above. The harness inference path is verified
  correct against the reference `model_vqa.py` (see
  [Week 1, Day 5](weekly/week-01/day-05.md#the-baseline-underperformance-investigation));
  the gap is the difference between **v1.5 zero-shot** and **v1.0
  per-dataset fine-tuned**, not a code bug. That gap is exactly what
  motivates the v1.0 reproduction track below.
- **On the closed-ended numbers specifically.** VQA-RAD is computed
  over the corrected 272 closed questions (after [Bug #3](bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions)
  fixed the `answer_type` labels); SLAKE and PathVQA use those
  datasets' real `answer_type` fields (no heuristic needed).
- **Known open issue.** `closed_ended_accuracy` uses lenient
  whole-word matching, which may over- or under-credit verbose
  answers. This will likely be supplanted by the candidate-set argmax
  scoring coming from the v1.0 reproduction work, not patched in
  place.

---

## On the v1.0 reproduction track

As of May 15, the project has a second harness in early scaffold —
`~/llava-med-pruning-v1`, forked from the v1.5 harness — targeting
LLaVA-Med **v1.0** with the per-dataset fine-tuned delta weights
published by `katielink/llava-med-7b-{vqarad,slake,pathvqa}-delta`.

**Why a second track:** the pruning method is inference-only, so the
choice of base model affects only the *strength of the baseline* we
compare against. v1.0's per-dataset fine-tuned weights sit roughly
24-32 points above v1.5's zero-shot numbers (above), which is the
right comparison point for a project that's claiming "preserves
accuracy while reducing compute."

**Status:** VQA-RAD delta merged successfully into a ~13 GB merged
model. The SLAKE delta on HuggingFace turned out to be empty (the
weights were never actually uploaded under that name) — that track
is currently blocked on locating an alternative source. PathVQA
delta downloaded but not yet merged. The v1.0 evaluation harness
itself is partial: `model_loader.py` written, `metrics.py` (with
candidate-set argmax) and `runner.py` (with v1.0's prompt format,
`'###'` stop string, and `temperature=0.7` stochastic decoding)
pending. Full Day 6 writeup:
[Week 1, Day 6](weekly/week-01/day-06.md#the-strategic-pivot-switching-to-llava-med-v10).

Once the v1.0 track produces an E00 row directly comparable to
published figures, the project decides whether the v1.0 harness
becomes the primary track or stays a separate reference.

---

## E01 — Random pruning (sanity floor)

<span class="pill pill--planned">Planned</span>

**Goal** — drop K% of visual tokens uniformly at random. This is the
floor: any "smart" pruning strategy must beat this. If it doesn't, we
haven't actually learned anything.

**Setup**
- Same as E00, plus: at the projector output, randomly drop K of the 576
  visual tokens (independent uniform sampling per forward pass).
- Run for K ∈ {10%, 25%, 50%, 75%}.

**Results**

| K   | VQA-RAD | SLAKE | PathVQA | Latency |
| --- | ------- | ----- | ------- | ------- |
| 10% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |
| 25% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |
| 50% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |
| 75% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |

**Conclusion**

_Fill in after running._

---

## Template for new experiments

Copy this block, paste it above the previous experiment, and bump the ID.

```markdown
## EN — Short descriptive name

<span class="pill pill--planned">Planned</span>

**Goal** — one sentence.

**Setup**
- Model:
- Dataset:
- Pruning strategy:
- K:
- Training config (if applicable):

**Results**
- Metric 1:
- Metric 2:
- Latency:

**Conclusion**
- What did this tell us?
- What's the next experiment?
```
