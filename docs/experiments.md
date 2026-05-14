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

Status (May 14, 2026): **VQA-RAD path complete end-to-end** — all 11
files implemented except the SLAKE and PathVQA dataset loaders, which
remain stubs (Batch 3). The harness is under git version control. Its
inference path is verified correct: running the reference
`llava/eval/model_vqa.py` on VQA-RAD test questions produces
word-for-word identical predictions.

## Summary table

| ID  | Date | Pruning strategy | K (drop %) | VQA-RAD acc | SLAKE acc | Latency Δ | Notes |
| --- | ---- | ---------------- | ---------- | ----------- | --------- | --------- | ----- |
| E00 | May 14 | None (baseline) | 0%      | 0.537 closed / 0.340 open | _pending_ | — (843 ms/sample) | Reference run; VQA-RAD done, SLAKE/PathVQA pending |
| E01 | _TBD_ | _e.g. random_    | _25%_      | _TBD_       | _TBD_     | _TBD_     | Sanity floor |
| E02 | _TBD_ | _e.g. attention-based_ | _25%_ | _TBD_     | _TBD_     | _TBD_     | Question-agnostic baseline |
| E03 | _TBD_ | _Question-conditioned MLP v1_ | _25%_ | _TBD_ | _TBD_ | _TBD_ | First real attempt |

The cells in italics get filled in as we go. **E00** and **E01** (the
baseline and the random-pruning sanity floor) are the two reference
points every later experiment should beat.

---

## E00 — Baseline (no pruning)

<span class="pill pill--wip">VQA-RAD done · SLAKE & PathVQA pending</span>

**Goal** — establish the reference accuracy and latency numbers we'll
compare every pruning experiment against. No model changes.

**Setup**
- Model: LLaVA-Med v1.5 (Mistral-7B), off-the-shelf weights, frozen
- Datasets: VQA-RAD test split (451 samples) — **done**; SLAKE English
  test split (1,061 samples) and PathVQA test split (6,719 samples)
  pending the Batch 3 dataset loaders
- Hardware: see [Baseline (LLaVA-Med)](setup.md#hardware)
- Pruning method: `BaselineMethod` (no-op — runs the model unmodified)
- Decoding: single-turn, greedy (`temperature = 0.0`)

**Results — VQA-RAD test (451 samples: 272 closed, 179 open)**

| Metric | Value |
| --- | --- |
| Closed-ended accuracy | 0.537 |
| Open-ended recall | 0.340 |
| Overall accuracy | 0.459 |
| Mean latency | 842.5 ms / sample |
| Peak GPU memory | 14.86 GiB |

SLAKE and PathVQA numbers pending — those loaders are the Batch 3 work.

**Notes**

- **On the literature gap.** Published figures put LLaVA-Med on
  VQA-RAD around ~0.84 closed-ended. The ~29-point gap was investigated
  at length (see [Week 1, Day 5](weekly/week-01/day-05.md#the-baseline-underperformance-investigation)).
  Conclusion: the harness inference path is verified correct against
  the reference `model_vqa.py`, and the gap is **evaluation
  methodology**, not a code bug — the official v1.5 eval scores via
  GPT-4-as-judge on a 50-question chat benchmark, not closed/open
  exact-match on the full test set. The ~0.84 is a "neighbourhood"
  target, not an exact figure to reproduce.
- **On the closed-ended number specifically.** It is computed over
  the corrected 272 closed questions (after [Bug #3](bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions)
  fixed the `answer_type` labels). An earlier pre-fix run reported
  0.546, but that was over a mislabeled set and is **not comparable** —
  0.537 is the honest, valid reference.
- **Known open issue.** `closed_ended_accuracy` uses lenient
  whole-word matching, which may over- or under-credit verbose
  answers. Tightening this is a tracked next-step; it could shift the
  closed-ended number again, but in a *known and documented* way.

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
